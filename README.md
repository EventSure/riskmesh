# Riskmesh (Open Parametric)

한국어 버전은 아래에 있습니다. / Korean version below.

This repository contains the on-chain program and the operator dashboard for a Solana-based parametric insurance protocol. The MVP targets flight delay insurance with co-underwriting, risk pools, oracle verification, and claim/settlement flows.

## Structure

- `contract/` — Anchor-based on-chain program (Rust)
- `frontend/` — Operator dashboard (React + Vite + Emotion)
- `docs/` — Contract guide, testing guides, and design documents
- `OpenParametric.md` — MVP / design draft (Korean)

## Key Features

- Policy creation and co-underwriting (leader/participant ratio management)
- Escrowed risk pool management and settlement flow
- Oracle-based delay verification and claim creation
- Manual approval before payout (MVP)
- Tab-based operator UI (Contract / Feed / Oracle / Settlement / Inspector)

## Demo Modes

The frontend dashboard supports two operating modes, toggled from the header:

| Mode | Description | Wallet Required |
|------|-------------|-----------------|
| **SIM** (default) | Simulation mode — all data is local, no on-chain transactions | No |
| **DEVNET** | On-chain mode — interacts with Solana devnet via connected wallet | Yes |

Switch modes via the **DEVNET / SIM** toggle in the top-right header. DEVNET mode requires a connected Solana wallet; attempting to switch without one will show a warning.

## Oracle Architecture

The oracle integration uses a **modular, dual-track design** — the same contract supports both centralized and decentralized oracle strategies, selectable per deployment scenario. Both tracks use [AviationStack API](https://aviationstack.com) as the flight delay data source.

| Track | Strategy | Trust Model | Target Account |
|-------|----------|-------------|----------------|
| **Track A** — Trusted Resolver | Leader/Operator fetches API data and calls `resolve_flight_delay` on-chain | Centralized (signer trust) | `FlightPolicy` |
| **Track B** — Switchboard On-Demand | Switchboard oracle nodes fetch API data, sign and write to an on-chain feed; `check_oracle_and_create_claim` verifies cryptographically | Decentralized (cryptographic verification) | `Policy` (Legacy) |

**In demo/simulation mode**, oracle resolution is triggered manually via the dashboard UI — no external API or oracle network is required.

This modular design allows flexible adoption:
- **Demo/local testing** — manual trigger, no external dependencies
- **Centralized production** — Track A with a trusted operator and real-time flight API
- **Decentralized production** — Track B with Switchboard oracle network for trustless verification

For full details, see [`contract/docs/oracle.md`](contract/docs/oracle.md).

## Quick Start

### 1) Run Frontend

```bash
cd frontend
npm install
npm run dev
```

- Build: `npm run build`
- Preview: `npm run preview`
- The app uses `BrowserRouter` with `basename` set to `/riskmesh`. Configure subpath hosting accordingly.

### 2) Build / Test Contract

```bash
cd contract
anchor build
anchor test
```

- Program ID is currently a placeholder. Update both:
  - `contract/programs/open_parametric/src/lib.rs`
  - `contract/Anchor.toml`

## CI / CD

Three GitHub Actions workflows automate quality checks and deployment:

| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| **Contract CI** | `.github/workflows/contract-ci.yml` | Push to `main` or PR — `contract/**` changes | `cargo fmt --check`, `cargo clippy`, `cargo test` |
| **Frontend Tests** | `.github/workflows/test-frontend.yml` | Push to `main`/`feature/**` or PR — `frontend/**` changes | `npm ci && npm test` |
| **Deploy Frontend** | `.github/workflows/deploy-frontend.yml` | Push to `main` — `frontend/**` changes | Build and deploy to GitHub Pages |

## Testing

### Contract

```bash
cd contract

# Rust unit tests (pure logic, no validator needed)
cargo test -p open_parametric --lib

# Anchor integration tests (requires local validator)
anchor test

# Settlement logic tests (Node.js)
node --test tests/master_settlement_logic.test.mjs
```

### Frontend

```bash
cd frontend

# Run all tests once
npm test

# Watch mode (re-run on file save)
npm run test:watch

# Coverage report
npm run test:coverage
```

For detailed guides, see:
- [`docs/CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) — Contract testing guide (Korean)
- [`docs/FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) — Frontend testing guide (Korean)

## Docs

### Root

| File | Description |
|------|-------------|
| [`OpenParametric.md`](OpenParametric.md) | MVP design draft — account schemas, state machines, oracle spec (Korean) |

### `docs/`

| File | Description |
|------|-------------|
| [`CONTRACT_GUIDE.md`](docs/CONTRACT_GUIDE.md) | Smart contract detailed spec — accounts, instructions, error codes, sequences (Korean) |
| [`CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) | Contract testing guide — unit, integration, and settlement tests (Korean) |
| [`FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) | Frontend unit testing guide — business logic tests (Korean) |
| [`FILE_STATE_LOGIC_FULL_KO.md`](docs/FILE_STATE_LOGIC_FULL_KO.md) | Full file-by-file state/logic reference for the entire repo (Korean) |
| [`MASTER_POLICY_REDESIGN_PLAN_KO.md`](docs/MASTER_POLICY_REDESIGN_PLAN_KO.md) | Master policy + child flight policy restructuring plan (Korean) |
| [`feature/settle_flight_settlement.md`](docs/feature/settle_flight_settlement.md) | Flight settlement logic — claim and no-claim flows (Korean) |
| [`emotion-migration-handoff.md`](docs/emotion-migration-handoff.md) | Emotion CSS-in-JS migration handoff notes |

### `contract/docs/`

| File | Description |
|------|-------------|
| [`oracle.md`](contract/docs/oracle.md) | Oracle integration guide — Track A (centralized) & Track B (decentralized) (Korean) |
| [`setup-and-test.md`](contract/docs/setup-and-test.md) | Development environment setup — Rust, Solana CLI, Anchor installation (Korean) |

### `contract/`

| File | Description |
|------|-------------|
| [`README.md`](contract/README.md) | Contract setup notes — program ID, build/test, CI trigger |

## Architecture

The on-chain program manages Policy, Underwriting, RiskPool, Claim, and PolicyholderRegistry accounts as PDAs. The risk pool owns an SPL Token vault (ATA). Oracle verification creates claims once delay conditions are met.

```
Policy
  ├─ Underwriting (participants, ratios, escrow)
  ├─ RiskPool (vault, balances)
  ├─ Claim (per oracle_round)
  └─ PolicyholderRegistry (optional)
```

What each element means:
- `Policy`: The insurance product itself. Stores route/flight, departure time, delay threshold, payout amount, oracle feed, and state.
- `Underwriting`: Co-underwriting structure. Tracks leader/participant ratios, acceptance status, and escrowed funds.
- `RiskPool`: Pool holding escrowed funds. Manages the SPL Token vault, available balance, and total escrowed amount.
- `Claim`: Per-oracle-round claim record. Stores delay value, verification time, approval status, and payout amount.
- `PolicyholderRegistry`: (Optional) Minimal policyholder registry. Stores external references and coverage data without PII.

## State Machines

Policy state flow:

```
Draft → Open → Funded → Active → Claimable → Approved → Settled
                                   └───────────────→ Expired
```

Underwriting state:

```
Proposed → Open → Finalized (or Failed)
```

Claim state:

```
None → PendingOracle → Claimable → Approved → Settled (or Rejected)
```

## Dev Notes

- Anchor 0.31.1
- Oracle: modular — Switchboard On-Demand (decentralized) or Trusted Resolver (centralized)
- SPL tokens used for escrow/payout
- Network: localnet (dev), devnet (demo), mainnet (production)

---

# Riskmesh (Open Parametric) — 한국어

Solana 기반 파라메트릭 보험 프로토콜의 온체인 프로그램과 운영용 프런트엔드를 함께 담은 레포지토리입니다. MVP는 항공편 지연 보험을 기준으로 설계되어 있으며, 공동 인수, 리스크 풀, 오라클 검증 기반 청구/정산 흐름을 제공합니다.

## 구성

- `contract/` — Anchor 기반 온체인 프로그램 (Rust)
- `frontend/` — 운영용 대시보드 (React + Vite + Emotion)
- `docs/` — 컨트랙트 가이드, 테스트 가이드, 설계 문서
- `OpenParametric.md` — MVP / 설계 초안

## 주요 기능

- 보험상품 생성 및 공동 인수 (리더/참여사 비율 관리)
- 예치 자금 리스크 풀 관리 및 정산 흐름
- 오라클 기반 지연 판정 및 청구 생성
- 운영자 승인 후 지급 (현재 MVP 설계)
- 대시보드 탭 기반 운영 UI (Contract / Feed / Oracle / Settlement / Inspector)

## 데모 모드

프런트엔드 대시보드는 헤더에서 전환할 수 있는 두 가지 운영 모드를 지원합니다:

| 모드 | 설명 | 지갑 필요 |
|------|------|-----------|
| **SIM** (기본값) | 시뮬레이션 모드 — 모든 데이터가 로컬, 온체인 트랜잭션 없음 | 아니오 |
| **DEVNET** | 온체인 모드 — 연결된 지갑을 통해 Solana devnet과 상호작용 | 예 |

우측 상단 헤더의 **DEVNET / SIM** 토글로 전환합니다. DEVNET 모드는 Solana 지갑 연결이 필요하며, 미연결 시 경고가 표시됩니다.

## 오라클 아키텍처

오라클 연동은 **모듈식 이중 트랙 설계**를 사용합니다 — 동일한 컨트랙트가 중앙화·탈중앙화 오라클 전략을 모두 지원하며, 배포 시나리오에 따라 선택할 수 있습니다. 두 트랙 모두 [AviationStack API](https://aviationstack.com)를 항공편 지연 데이터 소스로 사용합니다.

| 트랙 | 방식 | 신뢰 모델 | 대상 계정 |
|------|------|-----------|-----------|
| **Track A** — Trusted Resolver | 리더/오퍼레이터가 API 데이터를 가져와 `resolve_flight_delay` 온체인 호출 | 중앙화 (서명자 신뢰) | `FlightPolicy` |
| **Track B** — Switchboard On-Demand | Switchboard 오라클 노드가 API 데이터를 가져와 온체인 feed에 서명·기록; `check_oracle_and_create_claim`이 암호학적으로 검증 | 탈중앙화 (암호학적 검증) | `Policy` (Legacy) |

**데모/시뮬레이션 모드**에서는 대시보드 UI에서 오라클 해소를 수동으로 트리거합니다 — 외부 API나 오라클 네트워크가 필요하지 않습니다.

이 모듈식 설계로 유연한 도입이 가능합니다:
- **데모/로컬 테스트** — 수동 트리거, 외부 의존성 없음
- **중앙화 프로덕션** — Track A, 신뢰할 수 있는 오퍼레이터와 실시간 항공 API 사용
- **탈중앙화 프로덕션** — Track B, Switchboard 오라클 네트워크로 무신뢰 검증

상세 내용은 [`contract/docs/oracle.md`](contract/docs/oracle.md)를 참고하세요.

## 빠른 시작

### 1) 프런트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

- 빌드: `npm run build`
- 배포 프리뷰: `npm run preview`
- 이 앱은 `BrowserRouter`의 `basename`이 `/riskmesh`로 설정되어 있습니다. 정적 호스팅 시 서브경로 배포에 맞춰 설정하세요.

### 2) 컨트랙트 빌드/테스트

```bash
cd contract
anchor build
anchor test
```

- 실제 프로그램 ID는 아직 placeholder입니다. 아래 경로를 업데이트해야 합니다:
  - `contract/programs/open_parametric/src/lib.rs`
  - `contract/Anchor.toml`

## CI / CD

세 개의 GitHub Actions 워크플로우가 품질 검사와 배포를 자동화합니다:

| 워크플로우 | 파일 | 트리거 | 동작 |
|-----------|------|--------|------|
| **Contract CI** | `.github/workflows/contract-ci.yml` | `main` push 또는 PR — `contract/**` 변경 시 | `cargo fmt --check`, `cargo clippy`, `cargo test` |
| **Frontend Tests** | `.github/workflows/test-frontend.yml` | `main`/`feature/**` push 또는 PR — `frontend/**` 변경 시 | `npm ci && npm test` |
| **Deploy Frontend** | `.github/workflows/deploy-frontend.yml` | `main` push — `frontend/**` 변경 시 | 빌드 후 GitHub Pages 배포 |

## 테스트

### 컨트랙트

```bash
cd contract

# Rust 단위 테스트 (순수 로직, 밸리데이터 불필요)
cargo test -p open_parametric --lib

# Anchor 통합 테스트 (로컬 밸리데이터 필요)
anchor test

# 정산 수식 테스트 (Node.js)
node --test tests/master_settlement_logic.test.mjs
```

### 프런트엔드

```bash
cd frontend

# 전체 테스트 1회 실행
npm test

# 워치 모드 (파일 저장 시 자동 재실행)
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

상세 가이드:
- [`docs/CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) — 컨트랙트 테스트 가이드
- [`docs/FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) — 프런트엔드 테스트 가이드

## 문서

### 루트

| 파일 | 설명 |
|------|------|
| [`OpenParametric.md`](OpenParametric.md) | MVP 설계 초안 — 계정 스키마, 상태 머신, 오라클 스펙 |

### `docs/`

| 파일 | 설명 |
|------|------|
| [`CONTRACT_GUIDE.md`](docs/CONTRACT_GUIDE.md) | 스마트 컨트랙트 상세 스펙 — 계정, 인스트럭션, 에러코드, 시퀀스 |
| [`CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) | 컨트랙트 테스트 가이드 — 단위, 통합, 정산 테스트 |
| [`FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) | 프런트엔드 단위 테스트 가이드 — 비즈니스 로직 테스트 |
| [`FILE_STATE_LOGIC_FULL_KO.md`](docs/FILE_STATE_LOGIC_FULL_KO.md) | 전체 파일별 상태/로직 설명서 |
| [`MASTER_POLICY_REDESIGN_PLAN_KO.md`](docs/MASTER_POLICY_REDESIGN_PLAN_KO.md) | 마스터 계약 + 개별 항공 보험 구조 개편 계획 |
| [`feature/settle_flight_settlement.md`](docs/feature/settle_flight_settlement.md) | 항공 보험 정산 로직 — 클레임/무클레임 흐름 |
| [`emotion-migration-handoff.md`](docs/emotion-migration-handoff.md) | Emotion CSS-in-JS 마이그레이션 핸드오프 |

### `contract/docs/`

| 파일 | 설명 |
|------|------|
| [`oracle.md`](contract/docs/oracle.md) | 오라클 연동 가이드 — Track A (중앙화) & Track B (탈중앙화) |
| [`setup-and-test.md`](contract/docs/setup-and-test.md) | 개발 환경 설치 가이드 — Rust, Solana CLI, Anchor |

### `contract/`

| 파일 | 설명 |
|------|------|
| [`README.md`](contract/README.md) | 컨트랙트 셋업 노트 — 프로그램 ID, 빌드/테스트, CI 트리거 |

## 아키텍처

온체인 프로그램은 보험상품(Policy)과 공동 인수(Underwriting), 리스크 풀(RiskPool), 청구(Claim), 계약자 등록부(PolicyholderRegistry)를 PDA로 관리합니다. 리스크 풀은 SPL 토큰 Vault(ATA)를 소유하며, 오라클 검증으로 지연 조건이 충족되면 청구가 생성됩니다.

```
Policy
  ├─ Underwriting (participants, ratios, escrow)
  ├─ RiskPool (vault, balances)
  ├─ Claim (oracle_round별)
  └─ PolicyholderRegistry (옵션)
```

각 요소 의미:
- `Policy`: 보험상품 자체. 노선/항공편/출발시각, 지연 임계값, 지급액, 오라클 피드, 상태 등을 보관합니다.
- `Underwriting`: 공동 인수 구조. 리더/참여사 비율, 수락/거절 상태, 예치(escrow) 정보를 추적합니다.
- `RiskPool`: 예치 자금을 보관하는 풀. SPL 토큰 Vault와 가용 잔액/총 예치액을 관리합니다.
- `Claim`: 오라클 라운드별 청구 기록. 지연값, 검증 시각, 승인 상태, 지급액을 담습니다.
- `PolicyholderRegistry`: (옵션) 계약자 최소 정보 등록부. PII 없이 외부 참조와 보장 정보만 저장합니다.

## 상태 머신

Policy 상태 전이 흐름:

```
Draft → Open → Funded → Active → Claimable → Approved → Settled
                                   └───────────────→ Expired
```

Underwriting 상태:

```
Proposed → Open → Finalized (또는 Failed)
```

Claim 상태:

```
None → PendingOracle → Claimable → Approved → Settled (또는 Rejected)
```

## 개발 메모

- Anchor 0.31.1
- 오라클: 모듈식 — Switchboard On-Demand (탈중앙화) 또는 Trusted Resolver (중앙화)
- SPL 토큰을 예치/지급에 사용
- 네트워크: localnet (개발), devnet (데모), mainnet (프로덕션)
