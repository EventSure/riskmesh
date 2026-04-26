# Deployment Guide — Frontend + Solana Contract 연동

새로 컨트랙트를 배포한 후 프론트엔드를 연결하기 위한 설정 가이드입니다.

## 변경 체크리스트

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `frontend/.env` and `frontend/.env.example` | Set `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`, and `VITE_STAGING_PROGRAM_ID` |
| 2 | `src/lib/constants.ts` (line 7) | `CURRENCY_MINT` → 승인된 고정 devnet mint `A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w` |
| 3 | `src/lib/idl/open_parametric.json` | **빌드 결과 IDL로 전체 교체** |

## 1. IDL 파일 교체

```bash
# 컨트랙트 빌드
cd contract
anchor build

# 빌드된 IDL을 프론트엔드로 복사
cp target/idl/open_parametric.json ../frontend/src/lib/idl/open_parametric.json
```

### 왜 전체 교체인가?

IDL(Interface Definition Language)은 컨트랙트의 instruction 시그니처, 계정 레이아웃, 타입 정의를 포함합니다.
`address` 필드만 바꾸면 아래 문제가 발생할 수 있습니다:

- 계정 구조체의 필드 순서나 크기가 다르면 → **직렬화/역직렬화 실패**
- instruction discriminator(8바이트 해시)가 다르면 → **instruction 매칭 실패**
- 추가/삭제된 instruction이 있으면 → **프론트엔드에서 호출 불가**

`anchor build` 시 생성되는 `target/idl/open_parametric.json`이 배포된 프로그램과 정확히 일치하는 유일한 IDL입니다.

## Program ID selection

The frontend selects one active program id from environment variables:

```env
VITE_PROGRAM_STAGE=stable
VITE_PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
VITE_STAGING_PROGRAM_ID=
```

Use `VITE_PROGRAM_STAGE=staging` only after the shared devnet staging program
has been deployed and `VITE_STAGING_PROGRAM_ID` has been filled.

Do not edit `src/lib/constants.ts` to switch programs. PDA derivation and
Anchor calls must use the same active program id, and the env resolver keeps
that selection in one place.

### 왜 별도로 설정하는가?

프론트엔드에서 프로그램 주소를 두 경로에서 참조합니다:

| 위치 | 용도 |
|------|------|
| Active program id resolver | `PublicKey.findProgramAddressSync(seeds, programId)` — PDA 파생 |
| `useProgram()` | env에서 선택된 program id로 IDL `address`를 덮어쓴 뒤 `new Program(...)` 생성 |

즉, 현재 프런트엔드는 `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`,
`VITE_STAGING_PROGRAM_ID`에서 선택된 program id 하나를 PDA 파생과 Anchor 호출에
공통으로 사용합니다.

그래도 IDL 전체 교체는 계속 필요합니다. `address`만의 문제가 아니라 instruction,
account layout, discriminator가 바뀌면 직렬화/호출 자체가 깨지기 때문입니다.

## 3. CURRENCY_MINT 설정

```typescript
// src/lib/constants.ts
export const CURRENCY_MINT = new PublicKey('A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w');
```

Stable/devnet의 `create_master_agreement`는 위 approved mint만 허용합니다.
새 SPL 토큰을 만들어 `CURRENCY_MINT`에 넣으면 MasterAgreement 생성과 이후
premium/payout 경로가 `InvalidInput`으로 실패합니다.

### approved mint 테스트 자금 준비

```bash
cd contract

# operator ATA에 approved mint 추가 발행
./scripts/mint-test-token-to-operator.sh

# leader / participants / reinsurer에 approved mint 분배
./scripts/prefund-parties.sh

# 선택 사항: 지갑/익스플로러에서 토큰 이름 표시
./scripts/apply-test-token-metadata.sh
```

### 왜 필요한가?

컨트랙트의 모든 금융 흐름이 SPL 토큰으로 처리됩니다:

- `create_master_agreement` — `currency_mint` 필드에 mint 주소 저장
- `create_flight_policy_from_master` — premium을 `payer_token` → `leader_deposit_token`으로 전송
- `settle_flight_claim` / `settle_flight_no_claim` — payout 분배

프론트엔드에서는 `CURRENCY_MINT`를 사용해 ATA(Associated Token Address)를 파생합니다:
```typescript
const ata = await getAssociatedTokenAddress(CURRENCY_MINT, wallet.publicKey);
```

mint 주소가 실제 컨트랙트에 등록된 것과 다르면:
- ATA가 다른 토큰의 계정을 가리킴
- → `InvalidInput` 에러 (mint 불일치)
- → 또는 `AccountNotInitialized` 에러 (ATA 미생성)

`03-master-setup`도 같은 fixed mint를 직접 사용하므로, frontend/contract가 같은
mint 주소를 공유해야 새 agreement 생성 경로가 일관되게 동작합니다.

## 4. 지갑 사전 준비

| 항목 | 필요량 | 용도 |
|------|--------|------|
| SOL | ~0.5 SOL | TX 수수료 + 계정 rent |
| Approved SPL 토큰 | 최소 1개 | Flight policy 생성 시 premium 지불 |

```bash
# SOL 에어드롭 (devnet)
solana airdrop 2

# approved mint 잔액 확인
spl-token balance A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w
```

## 전체 설정 요약 (Quick Start)

```bash
# 1. 컨트랙트 빌드 & 배포
cd contract
yarn deploy:stable

# 2. IDL 복사
cp target/idl/open_parametric.json ../frontend/src/lib/idl/open_parametric.json

# 3. 프론트엔드 env 설정
cd ../frontend
# .env가 없으면 .env.example을 참고해 생성하고, 있으면 기존 .env를 수정
# Layout-changing 검증 배포:
#   VITE_PROGRAM_STAGE=staging
#   VITE_STAGING_PROGRAM_ID=<shared devnet staging program id>
# Stable 업그레이드를 의도한 경우에만:
#   VITE_PROGRAM_STAGE=stable
#   VITE_PROGRAM_ID=<stable devnet program id>

# 4. approved mint 테스트 자금 준비
cd ../contract
./scripts/mint-test-token-to-operator.sh
./scripts/prefund-parties.sh

# 5. constants.ts 수정
#    CURRENCY_MINT = 'A6ty3ZmdzFW9JS92QCc5n7XPUM2cfwKzdnPmyXP2hY8w'

# 6. 프런트엔드 실행
cd ../frontend
npm run dev:stable
```

Frontend run scripts:

```bash
cd frontend
npm run dev:stable
npm run dev:stage
```

`dev:stage` only selects `VITE_PROGRAM_STAGE=staging`; `VITE_STAGING_PROGRAM_ID`
still must be set in `frontend/.env` or the shell environment.

Backend local run:

```bash
cd backend
./run-stable.sh
./run-staging.sh
```

Contract staging demo scripts:

```bash
cd contract
npm run demo:3-master-setup:stage
npm run demo:stage -- demo:manual-list
```

These helpers do not deploy a Solana program. Staging program deployment still
requires a separate deploy workflow that aligns the program keypair, `declare_id!`,
`Anchor.toml`, and generated IDL.

## 트러블슈팅

| 에러 | 원인 | 해결 |
|------|------|------|
| `DeclaredProgramIdMismatch (4100)` | lib.rs의 `declare_id!`와 배포된 프로그램 주소 불일치 | `anchor build` 후 재배포 |
| `AccountOwnedByWrongProgram (3007)` | raw wallet 주소를 SPL token account 자리에 전달 | ATA 주소 사용 확인 |
| `AccountNotInitialized (3012)` | ATA가 생성되지 않음 | `spl-token create-account` 실행 |
| `InvalidInput (6010)` | mint 불일치 또는 wallet 미등록 | `CURRENCY_MINT` 확인 |
| PDA 불일치 | 선택된 frontend program id와 실제 배포 대상 프로그램이 다름 | `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`, `VITE_STAGING_PROGRAM_ID`를 확인하고 backend/contract deploy 대상과 같은 주소인지 검증 |
| IDL mismatch | 배포된 프로그램과 IDL 버전 불일치 | `anchor build` 후 IDL 재복사 |
