# Deployment Guide — Frontend + Solana Contract 연동

새로 컨트랙트를 배포한 후 프론트엔드를 연결하기 위한 설정 가이드입니다.

## 변경 체크리스트

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `src/lib/constants.ts` (line 5) | `PROGRAM_ID` → 새로 배포한 프로그램 주소 |
| 2 | `src/lib/constants.ts` (line 7) | `CURRENCY_MINT` → 본인이 만든 SPL 토큰 mint 주소 |
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

## 2. PROGRAM_ID 업데이트

```typescript
// src/lib/constants.ts
export const PROGRAM_ID = new PublicKey('<새 프로그램 주소>');
```

프로그램 주소 확인:
```bash
anchor keys list
# 또는
solana address -k contract/target/deploy/open_parametric-keypair.json
```

### 왜 별도로 설정하는가?

프론트엔드에서 프로그램 주소를 두 곳에서 사용합니다:

| 위치 | 용도 |
|------|------|
| `idl/open_parametric.json` → `address` 필드 | `new Program(idl, provider)` — Anchor Program 인스턴스 생성 |
| `constants.ts` → `PROGRAM_ID` | `PublicKey.findProgramAddressSync(seeds, programId)` — PDA 파생 |

**두 값이 다르면:**
- Program 인스턴스는 프로그램 A를 호출하는데
- PDA는 프로그램 B 기준으로 파생됨
- → 모든 PDA 기반 계정(MasterPolicy, FlightPolicy 등)이 불일치
- → `AccountNotInitialized`, `AccountOwnedByWrongProgram` 등의 에러 발생

## 3. CURRENCY_MINT 설정

```typescript
// src/lib/constants.ts
export const CURRENCY_MINT = new PublicKey('<SPL 토큰 mint 주소>');
```

### SPL 토큰이 없다면 생성

```bash
# Devnet 기준
solana config set --url devnet

# 새 토큰 생성 (6 decimals = USDC와 동일)
spl-token create-token --decimals 6
# 출력: Creating token <MINT_ADDRESS>

# 본인 지갑에 토큰 계정(ATA) 생성
spl-token create-account <MINT_ADDRESS>

# 테스트용 토큰 발행 (1000개)
spl-token mint <MINT_ADDRESS> 1000
```

### 왜 필요한가?

컨트랙트의 모든 금융 흐름이 SPL 토큰으로 처리됩니다:

- `create_master_policy` — `currency_mint` 필드에 mint 주소 저장
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

## 4. 지갑 사전 준비

| 항목 | 필요량 | 용도 |
|------|--------|------|
| SOL | ~0.5 SOL | TX 수수료 + 계정 rent |
| SPL 토큰 | 최소 1개 | Flight policy 생성 시 premium 지불 |

```bash
# SOL 에어드롭 (devnet)
solana airdrop 2

# 토큰 잔액 확인
spl-token balance <MINT_ADDRESS>
```

## 전체 설정 요약 (Quick Start)

```bash
# 1. 컨트랙트 빌드 & 배포
cd contract
anchor build
anchor deploy --provider.cluster devnet

# 2. 프로그램 주소 확인
anchor keys list
# → 출력된 주소를 PROGRAM_ID에 사용

# 3. IDL 복사
cp target/idl/open_parametric.json ../frontend/src/lib/idl/open_parametric.json

# 4. SPL 토큰 생성 (최초 1회)
spl-token create-token --decimals 6
spl-token create-account <MINT_ADDRESS>
spl-token mint <MINT_ADDRESS> 1000

# 5. constants.ts 수정
#    PROGRAM_ID = '<anchor keys list 출력값>'
#    CURRENCY_MINT = '<spl-token create-token 출력값>'

# 6. 프론트엔드 실행
cd ../frontend
npm run dev
```

## 트러블슈팅

| 에러 | 원인 | 해결 |
|------|------|------|
| `DeclaredProgramIdMismatch (4100)` | lib.rs의 `declare_id!`와 배포된 프로그램 주소 불일치 | `anchor build` 후 재배포 |
| `AccountOwnedByWrongProgram (3007)` | raw wallet 주소를 SPL token account 자리에 전달 | ATA 주소 사용 확인 |
| `AccountNotInitialized (3012)` | ATA가 생성되지 않음 | `spl-token create-account` 실행 |
| `InvalidInput (6010)` | mint 불일치 또는 wallet 미등록 | `CURRENCY_MINT` 확인 |
| PDA 불일치 | `PROGRAM_ID`와 `idl.address`가 다름 | 두 값을 동일하게 설정 |
| IDL mismatch | 배포된 프로그램과 IDL 버전 불일치 | `anchor build` 후 IDL 재복사 |
