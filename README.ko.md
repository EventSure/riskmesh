# Riskmesh (Open Parametric)

**Solana 기반 파라메트릭 보험의 프로그래머블 정산 인프라.**

파라메트릭 보험은 정확한 피해를 측정한 뒤가 아니라, 이벤트가 발생하는 순간 지급합니다. 시장 규모는 $40B를 향해 성장 중이지만, 정산 인프라는 여전히 수동입니다 — 보험상품은 디지털로 발행되지만 정산은 사후에 수작업으로 이루어집니다.

**Open Parametric**은 정산을 프로그래머블하게 만듭니다. 이벤트 발생 후 대사(reconciliation)하는 대신, 이벤트가 공유된 금융 상태를 직접 업데이트합니다 — 하나의 온체인 진실, 분쟁 없음, 지연 없음. 아키텍처는 3계층 시스템: 보험사용 운영 프런트엔드, 실제 이벤트를 검증하는 오프체인 오라클 워커, 자본과 상태 전이를 결정적으로 관리하는 Solana 온체인 프로그램.

MVP는 **항공편 지연 보험** (주요 공항 30% 지연율의 $10B+ 시장)을 대상으로 하며, 기상, 공급망, 자연재해로 확장 가능한 모듈식 아키텍처를 제공합니다.

## 구성

- `contract/` — Anchor 기반 온체인 프로그램 (Rust)
- `frontend/` — 운영용 대시보드 (React + Vite + Emotion)
- `docs/` — 컨트랙트 가이드, 테스트 가이드, 설계 문서
- `OpenParametric.md` — MVP / 설계 초안

## 주요 기능

- **이벤트 기반 정산** — 이벤트 발생과 동시에 온체인 청구 정산, 대사 단계 없음
- 보험상품 생성 및 공동 인수 (리더/참여사 비율 관리)
- 온체인 자본 관리가 포함된 예치 리스크 풀
- 모듈식 오라클 연동 — 중앙화 (항공 API) 또는 탈중앙화 (Switchboard)
- 대시보드 탭 기반 운영 UI (Contract / Feed / Oracle / Settlement / Inspector)

## 데모 모드

프런트엔드 대시보드는 헤더에서 전환할 수 있는 두 가지 운영 모드를 지원합니다:

| 모드 | 설명 | 지갑 필요 |
|------|------|-----------|
| **DEVNET** (기본값) | 온체인 모드 — 연결된 지갑을 통해 Solana devnet과 상호작용 | 예 |
| **SIM** | 시뮬레이션 모드 — 모든 데이터가 로컬, 온체인 트랜잭션 없음 | 아니오 |

우측 상단 헤더의 **DEVNET / SIM** 토글로 전환합니다. SIM 모드는 지갑 연결 없이 오프라인 테스트에 사용할 수 있습니다.

## 오라클 아키텍처

오라클 연동은 **모듈식 이중 트랙 설계**를 사용합니다 — 동일한 컨트랙트가 중앙화·탈중앙화 오라클 전략을 모두 지원하며, 배포 시나리오에 따라 선택할 수 있습니다. 두 트랙 모두 [AviationStack API](https://aviationstack.com)를 항공편 지연 데이터 소스로 사용합니다.

| 트랙 | 방식 | 신뢰 모델 | 대상 계정 |
|------|------|-----------|-----------|
| **Track A** — Trusted Resolver | 리더/오퍼레이터가 API 데이터를 가져와 `resolve_flight_delay` 온체인 호출 | 중앙화 (서명자 신뢰) | `FlightPolicy` |
| **Track B** — Switchboard On-Demand | Switchboard 오라클 노드가 API 데이터를 가져와 온체인 feed에 서명·기록; `check_oracle_and_create_claim`이 암호학적으로 검증 | 탈중앙화 (암호학적 검증) | `Policy` |

**데모/시뮬레이션 모드**에서는 대시보드 UI에서 오라클 해소를 수동으로 트리거합니다 — 외부 API나 오라클 네트워크가 필요하지 않습니다.

이 모듈식 설계로 유연한 도입이 가능합니다:
- **데모/로컬 테스트** — 수동 트리거, 외부 의존성 없음
- **중앙화 프로덕션** — Track A, 신뢰할 수 있는 오퍼레이터와 실시간 항공 API 사용
- **탈중앙화 프로덕션** — Track B, Switchboard 오라클 네트워크로 무신뢰 검증

상세 내용은 [`contract/docs/oracle.md`](contract/docs/oracle.md)를 참고하세요.

## 왜 Solana인가

항공편이 2시간 지연됩니다. 오라클이 데이터를 올리는 그 트랜잭션 안에서, 청구가 자동 생성되고, 세 보험사의 비율대로 정산이 원자적으로 실행됩니다. 중간에 사람이 개입하거나, 서류가 오가거나, 시스템이 멈추는 구간이 없습니다.

이 워크플로우를 레거시 인프라 위에 구축하려면 — 오라클 검증, 다자간 에스크로, 원자적 정산 — 최소 3개의 서로 다른 시스템과 수일의 정산 기간이 필요합니다. 솔라나에서는 400ms짜리 트랜잭션 하나입니다.

이 프로토콜이 솔라나를 필요로 하는 다섯 가지 아키텍처적 이유:

- **동일 트랜잭션 오라클 검증** — `check_oracle_and_create_claim`은 Ed25519 서명 검증, Switchboard 오라클 업데이트, 클레임 생성을 단일 트랜잭션에서 원자적으로 수행합니다. 솔라나의 Instructions sysvar — 같은 TX 내 다른 인스트럭션을 프로그램 안에서 검사할 수 있는 기능 — 덕분에 가능하며, EVM에서는 구조적으로 불가능합니다.
- **PDA 기반 무신뢰 수탁** — 리스크풀의 vault는 프로그램에서 파생된 주소(PDA)가 소유합니다. 멀티시그도, 관리자 키도, 외부 커스터디도 없습니다. 프로그램 자체가 수탁자이며, 탈취할 관리자 키가 존재하지 않습니다.
- **계정 수준 병렬성** — 각 Policy, Underwriting, RiskPool, Claim이 별도의 온체인 계정입니다. 솔라나 런타임은 서로 다른 계정을 건드리는 트랜잭션을 병렬로 처리합니다. KE081 인천→뉴욕 편의 클레임 처리가 OZ201 인천→LA 편의 인수 절차를 블로킹하지 않습니다. EVM의 단일 컨트랙트 모델에서는 모든 보험상품이 같은 스토리지를 경쟁합니다.
- **다자간 원자적 정산** — `settle_claim`은 PDA 서명 권한으로 vault에서 beneficiary로 토큰을 이체합니다. 최대 16개 참여사의 basis point 비율 계산과 이체가 하나의 트랜잭션에서 완결됩니다 — 전부 아니면 전무, 부분 정산은 없습니다.
- **온체인 상태 머신 = 보험 약관** — 8단계 상태 전이(Draft → Open → Funded → Active → Claimable → Approved → Settled / Expired)가 온체인에 강제됩니다. "인수 완료 전 보장 개시 불가"는 약관 조항이 아니라 프로그램이 거부하는 트랜잭션입니다.

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

### 커버리지 요약

| 영역 | 프레임워크 | 테스트 수 | 통과율 | 라인 커버리지 |
|------|-----------|----------|--------|--------------|
| 프런트엔드 | Vitest (v8) | 90 | 100% | 59% |
| 컨트랙트 (Rust) | cargo-llvm-cov | 15 | 100% | 26% |
| 컨트랙트 (정산 로직) | node --test | 4 | 100% | — |

프런트엔드 모듈별 커버리지:

| 모듈 | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| hooks/ | 100% | 100% | 100% | 100% |
| lib/ | 100% | 100% | 100% | 100% |
| store/ | 48% | 45% | 51% | 46% |
| **전체** | **60%** | **52%** | **65%** | **59%** |



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
