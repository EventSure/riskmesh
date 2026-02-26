# Riskmesh (Open Parametric)

English version below. / 영문 버전은 아래에 있습니다.

Solana 기반 파라메트릭 보험 프로토콜의 온체인 프로그램과 운영용 프런트엔드를 함께 담은 레포지토리입니다. MVP는 항공편 지연 보험을 기준으로 설계되어 있으며, 공동 인수, 리스크 풀, 오라클 검증 기반 청구/정산 흐름을 제공합니다.

## 구성
- `contract/`: Anchor 기반 온체인 프로그램 (Rust)
- `frontend/`: 운영용 대시보드 (React + Vite + Emotion)
- `docs/`: 컨트랙트 상세 가이드 및 문서
- `OpenParametric.md`: MVP/설계 초안

## 주요 기능(요약)
- 보험상품 생성 및 공동 인수(리더/참여사 비율 관리)
- 예치 자금 리스크 풀 관리 및 정산 흐름
- 오라클 기반 지연 판정 및 청구 생성
- 운영자 승인 후 지급(현재 MVP 설계)
- 대시보드 탭 기반 운영 UI (Contract/Feed/Oracle/Settlement/Inspector)

## 빠른 시작

### 1) 프런트엔드 실행
```
cd frontend
npm install
npm run dev
```
- 빌드: `npm run build`
- 배포 프리뷰: `npm run preview`
- 이 앱은 `BrowserRouter`의 `basename`이 `/riskmesh`로 설정되어 있습니다. 정적 호스팅 시 서브경로 배포에 맞춰 설정하세요.

### 2) 컨트랙트 빌드/테스트
```
cd contract
anchor build
anchor test
```
- 실제 프로그램 ID는 아직 placeholder입니다. 아래 경로를 업데이트해야 합니다.
- `contract/programs/open_parametric/src/lib.rs`
- `contract/Anchor.toml`

## 문서
- 컨트랙트 상세 가이드: `docs/CONTRACT_GUIDE.md`
- 설계 초안: `OpenParametric.md`
- 컨트랙트 셋업 노트: `contract/README.md`

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

## 상태 머신(요약)
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
- Anchor 0.30 기준 설계
- 오라클: Switchboard On-Demand 연동 가정
- SPL 토큰을 예치/지급에 사용

---

# Riskmesh (Open Parametric) — English

This repository contains the on-chain program and the operator dashboard for a Solana-based parametric insurance protocol. The MVP targets flight delay insurance with co-underwriting, risk pools, oracle verification, and claim/settlement flows.

## Structure
- `contract/`: Anchor-based on-chain program (Rust)
- `frontend/`: Operator dashboard (React + Vite + Emotion)
- `docs/`: Contract guide and documentation
- `OpenParametric.md`: MVP/design draft (Korean)

## Key Features (Summary)
- Policy creation and co-underwriting (leader/participant ratios)
- Escrowed risk pool and settlement flow
- Oracle-based delay verification and claim creation
- Manual approval before payout (MVP)
- Tab-based operator UI (Contract/Feed/Oracle/Settlement/Inspector)

## Quick Start

### 1) Run Frontend
```
cd frontend
npm install
npm run dev
```
- Build: `npm run build`
- Preview: `npm run preview`
- The app uses `BrowserRouter` with `basename` set to `/riskmesh`. Configure subpath hosting accordingly.

### 2) Build/Test Contract
```
cd contract
anchor build
anchor test
```
- Program ID is currently a placeholder. Update both:
- `contract/programs/open_parametric/src/lib.rs`
- `contract/Anchor.toml`

## Docs
- Contract guide: `docs/CONTRACT_GUIDE.md`
- Design draft: `OpenParametric.md`
- Contract setup notes: `contract/README.md`

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

## State Machines (Summary)
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
- Designed for Anchor 0.30
- Oracle: Switchboard On-Demand (assumed)
- SPL tokens used for escrow/payout
