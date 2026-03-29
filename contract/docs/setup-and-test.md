# 개발 환경 설치 및 테스트 가이드

## 1) 툴체인 설치

Solana 공식 Quick Installation으로 Rust, Solana CLI, Anchor CLI를 한 번에 설치합니다.

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

설치 후 버전 확인:

```bash
rustc --version        # 1.84.1 (BPF toolchain)
solana --version       # 2.3.13
anchor --version       # 0.31.x
node --version         # 18 이상
yarn --version
```

> Quick Installation이 실패하면 Solana 문서의 `Install Dependencies` 섹션에서 개별 설치를 진행하세요.

---

## 2) 단위 테스트

### Rust 단위 테스트

```bash
# contract/programs/open_parametric/ 에서
cargo test
```

특정 테스트만 실행:

```bash
cargo test settle_flight_claim_test
cargo test settle_flight_no_claim_test
cargo test activate_master_test
```

### Anchor/TypeScript 통합 테스트

`contract/` 디렉토리에서 실행합니다.

```bash
# 전체 테스트 (로컬 validator 포함 자동 시작)
anchor test

# 특정 파일만
yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/settle_flight_claim.ts
```

현재 테스트 파일:

| 파일 | 커버 범위 |
|---|---|
| `tests/settle_flight_claim.ts` | Master/Flight 전체 — Track A(Trusted Resolver) 기반, Claim·NoClaim 양 경로 |

> **Track B(Switchboard) 통합 테스트**: `QuoteVerifier`가 실제 온체인 Switchboard 환경을 요구하므로 localnet에서는 단위 테스트가 불가합니다. devnet 통합 테스트로 분류됩니다.

---

## 3) 데모 스크립트

모든 스크립트는 `contract/` 디렉토리에서 `yarn demo:<N>-<이름>` 형태로 실행합니다.

### 스크립트 목록 및 실행 순서

| 번호 | 명령어 | 파일 | 설명 |
|---|---|---|---|
| 1 | `demo:1-setup` | `01-setup.ts` | 리더 키페어 + SPL 민트 생성, `.state.json` 초기화 |
| 2 | `demo:2-feed-create` | `02-feed-create.ts` | **Track B 전용** — Switchboard Pull Feed 생성 (1회) |
| 3 | `demo:3-master-setup` | `03-master-setup.ts` | MasterPolicy 생성·활성화 + 토큰 계정 셋업 |
| 4 | `demo:4-flight-create` | `04-flight-create.ts` | FlightPolicy 발행 (프리미엄 이체) |
| 5a | `demo:5a-resolve` | `05a-resolve.ts` | **Track A** — AviationStack API → `resolve_flight_delay` |
| 5b | `demo:5b-claim` | `05b-claim.ts` | **Track B** — Switchboard oracle → `check_oracle_and_resolve_flight` |
| 6 | `demo:6-settle` | `06-settle.ts` | 상태에 따라 `settle_flight_claim` 또는 `settle_flight_no_claim` 실행 |

스크립트 간 상태는 `scripts/.state.json` 파일로 공유됩니다.

---

### Track A 전체 실행 순서 (AviationStack Trusted Resolver)

```bash
cd contract

# 1. 초기 셋업 (키페어·민트 생성)
yarn demo:1-setup

# 2. MasterPolicy 생성 및 활성화
#    oracle_feed = PublicKey.default (Track A 전용)
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn demo:3-master-setup

# 3. FlightPolicy 발행
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
FLIGHT_NO=KE017 \
yarn demo:4-flight-create

# 4. AviationStack API로 지연 데이터 조회 → 온체인 반영
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
yarn demo:5a-resolve

# 5. 정산
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn demo:6-settle
```

---

### Track B 전체 실행 순서 (Switchboard On-Demand)

```bash
cd contract

# 1. 초기 셋업
yarn demo:1-setup

# 2. Switchboard Pull Feed 생성 (1회, devnet)
#    생성된 feedPubkey가 .state.json에 저장됨
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
yarn demo:2-feed-create

# 3. MasterPolicy 생성 및 활성화
#    oracle_feed = state.json의 feedPubkey (자동으로 읽어 등록)
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn demo:3-master-setup

# 4. FlightPolicy 발행
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
FLIGHT_NO=KE017 \
yarn demo:4-flight-create

# 5. Switchboard oracle → check_oracle_and_resolve_flight
#    1~2분 대기 후 실행 (oracle 노드 처리 시간)
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn demo:5b-claim

# 6. 정산
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn demo:6-settle
```

---

### 주요 환경변수

| 변수 | 대상 스크립트 | 설명 |
|---|---|---|
| `ANCHOR_PROVIDER_URL` | 2–6 | RPC 엔드포인트 (기본: `http://localhost:8899`) |
| `AVIATIONSTACK_API_KEY` | `2-feed-create`, `5a-resolve` | AviationStack API 키 |
| `FLIGHT_NO` | `2-feed-create`, `4-flight-create`, `5a-resolve` | 항공편 코드 (기본: `KE017`) |
| `FLIGHT_DATE` | `5a-resolve` | 날짜 `YYYY-MM-DD` (기본: FlightPolicy의 departure_ts) |
| `CHILD_POLICY_ID` | `5a-resolve`, `5b-claim`, `6-settle` | 처리할 FlightPolicy ID (기본: 마지막 항목) |
| `PROGRAM_ID` | 전체 | 프로그램 ID override |

---

### .state.json 구조

스크립트들이 순서대로 실행되면서 `.state.json`에 데이터를 채워나갑니다.

```jsonc
{
  "mint": "...",                    // 1-setup이 생성
  "leaderKey": [...],               // 1-setup이 생성
  "feedPubkey": "...",              // 2-feed-create가 저장 (Track B만)
  "masterId": 1,                    // 3-master-setup이 저장
  "masterPda": "...",               // 3-master-setup이 저장
  "leaderAta": "...",               // 3-master-setup이 저장
  "leaderDepositWallet": "...",     // 3-master-setup이 저장
  "reinsurerPoolWallet": "...",     // 3-master-setup이 저장
  "leaderPoolWallet": "...",        // 3-master-setup이 저장
  "flightPolicies": [               // 4-flight-create가 추가
    {
      "childId": 1,
      "pda": "...",
      "flightNo": "KE017",
      "departureTs": 1234567890
    }
  ]
}
```
