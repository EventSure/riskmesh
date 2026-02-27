# 프론트엔드 단위 테스트 가이드

## 1. 목적

프론트엔드 핵심 비즈니스 로직(보험료 분배, 클레임 티어 판정, 정산 집계 등)의 정확성을 단위 테스트로 검증한다.
UI 컴포넌트 렌더링 및 Solana RPC 호출은 테스트 범위에서 제외한다.

---

## 2. 실행 방법

```bash
cd frontend

# 전체 테스트 1회 실행
npm test

# 워치 모드 (파일 저장 시 자동 재실행)
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

---

## 3. 테스트 환경

| 항목 | 내용 |
|------|------|
| 테스트 러너 | Vitest 4.0 (Vite 네이티브) |
| DOM 환경 | jsdom (기본) / node (PDA 테스트) |
| React 훅 테스트 | @testing-library/react |
| 설정 파일 | `frontend/vite.config.ts` → `test` 블록 |
| 공통 초기화 | `frontend/src/test/setup.ts` (i18n 초기화) |

---

## 4. 테스트 파일 목록

### 4.1 유틸리티 함수 — `src/lib/__tests__/tx.test.ts`

**대상:** `src/lib/tx.ts`

| 테스트 | 내용 |
|--------|------|
| `shortenAddress` | 기본 4자 절삭, 커스텀 길이 |
| `getExplorerUrl` | tx/address 타입 × devnet/mainnet-beta 4가지 조합 |
| `sendTx` | 성공 케이스, Anchor 에러 코드 추출(`Error Code: XYZ`), 일반 에러, 비-Error throw |

```bash
# 이 파일만 실행
npx vitest run src/lib/__tests__/tx.test.ts
```

---

### 4.2 PDA 파생 함수 — `src/lib/__tests__/pda.test.ts`

**대상:** `src/lib/pda.ts`

> **환경:** `// @vitest-environment node` — jsdom에서 Web Crypto 미지원으로 node 환경 사용

| 함수 | 검증 항목 |
|------|----------|
| `getMasterPolicyPDA` | 결정론적 출력, 다른 masterId→다른 PDA, 다른 leader→다른 PDA, bump 범위(0~255) |
| `getFlightPolicyPDA` | 결정론적 출력, 다른 childPolicyId→다른 PDA |
| `getPolicyPDA` | 결정론적 출력, master_policy 시드와 다른 결과 확인 |
| `getUnderwritingPDA` | 결정론적 출력, 다른 policy→다른 PDA |
| `getRiskPoolPDA` | 결정론적 출력, underwriting PDA와 다른 결과 |
| `getClaimPDA` | 결정론적 출력, 다른 oracleRound→다른 PDA |
| `getRegistryPDA` | 결정론적 출력, pool/underwriting PDA와 모두 다른 결과 |

```bash
npx vitest run src/lib/__tests__/pda.test.ts
```

---

### 4.3 스토어 순수 함수 — `src/store/__tests__/pure-functions.test.ts`

**대상:** `src/store/useProtocolStore.ts` (내보내기 함수)

#### `getTier(delay: number)`

| 입력(delay) | 기대 결과 |
|-------------|----------|
| 0, 60, 119 | `null` (미발동) |
| 120~179 | `TIERS[0]` (delay2h) |
| 180~239 | `TIERS[1]` (delay3h) |
| 240~359 | `TIERS[2]` (delay4to5h) |
| 360~9999 | `TIERS[3]` (delay6hOrCancelled) |
| 10000+ | `null` |
| TIERS 연속성 | `TIERS[n+1].min === TIERS[n].max + 1` |

#### `fakePubkey(seed: string)`

- 동일 입력 → 동일 출력 (결정론적)
- 다른 입력 → 다른 출력
- 길이 44자
- base58 문자셋만 포함

#### `formatNum(n: number, d?: number)`

- 천 단위 콤마 포맷 (`1,234.50`)
- 소수점 자릿수 제어
- 0, 큰 수, 반올림 처리

```bash
npx vitest run src/store/__tests__/pure-functions.test.ts
```

---

### 4.4 스토어 액션 — `src/store/__tests__/useProtocolStore.test.ts`

**대상:** `src/store/useProtocolStore.ts` (Zustand 액션)

각 테스트 전 `resetAll()`로 스토어 초기화.

#### `setTerms()`

| 시나리오 | 기대 결과 |
|----------|----------|
| role=leader, 지분합=100 | `ok: true`, processStep=1 |
| role=operator | `ok: true` |
| role=partA | `ok: false` (리더 전용) |
| 지분합≠100 (50+30+10=90) | `ok: false` |

#### `confirmParty(key)`

| 확인 조합 | processStep |
|----------|------------|
| partA만 | 2 |
| partA + partB | 3 |
| partA + partB + rein | 4 |
| partB만 | 변화 없음 |

#### `activateMaster()`

| 시나리오 | 기대 결과 |
|----------|----------|
| 전체 확인 + leader 역할 | `ok: true`, masterActive=true, processStep=5 |
| rein 미확인 | `ok: false` |
| role=partA | `ok: false` |

#### `addContract()` — 보험료 분배 계산

기준값: `shares={50,30,20}`, `cededRatioBps=5000`, `reinsCommissionBps=1000`, `premiumPerPolicy=3`

```
reinsEff = 0.50 × (1 - 0.10) = 0.45
lNet = 0.50 × 0.55 × 3 = 0.825
aNet = 0.30 × 0.55 × 3 = 0.495
bNet = 0.20 × 0.55 × 3 = 0.330
rNet = 0.45 × 3         = 1.350
```

- masterActive=false 시 무시
- 계약 추가 시 `acc.leaderPrem` 등 누적값 증가 확인

#### `runOracle(contractId, delay, fresh, cancelled)` — 핵심 비즈니스 로직

**입력 검증:**

| 조건 | 에러 코드 |
|------|----------|
| fresh < 0 또는 > 30 | `E_ORACLE_STALE` |
| delay < 0 또는 10 배수 아님 | `E_ORACLE_FORMAT` |
| 존재하지 않는 contractId | `E_CONTRACT_NOT_FOUND` |
| 이미 claimed 계약 | `E_ALREADY_CLAIMED` |

**티어별 발동:**

| delay(분) | 티어 | payout(USDC) |
|-----------|------|-------------|
| 110 | 미발동 | 클레임 미생성 |
| 120 | delay2h | 5 |
| 180 | delay3h | 8 |
| 240 | delay4to5h | 12 |
| 360 | delay6hOrCancelled | 15 |
| cancelled=true | delay6hOrCancelled | 15 (delay 무시) |

**보상금 분배 계산 (delay=120, payout=5 기준):**

```
lNet = 5 × 0.55 × 0.50 = 1.375
aNet = 5 × 0.55 × 0.30 = 0.825
bNet = 5 × 0.55 × 0.20 = 0.550
rNet = 5 × 0.45         = 2.250
```

#### `approveClaims()` / `settleClaims()`

| 액션 | 전이 | 반환값 |
|------|------|--------|
| `approveClaims()` | claimable → approved | 처리된 건수 |
| `settleClaims()` | approved → settled | 처리된 건수 |
| 빈 리스트 | 변화 없음 | 0 |

```bash
npx vitest run src/store/__tests__/useProtocolStore.test.ts
```

---

### 4.5 정산 훅 — `src/hooks/__tests__/useSettlementData.test.ts`

**대상:** `src/hooks/useSettlementData.ts`

`renderHook`으로 Zustand 스토어를 직접 설정한 뒤 계산값 검증.

| 시나리오 | 검증 항목 |
|----------|----------|
| 빈 클레임 | 모든 집계값 = 0 |
| claimable 클레임만 존재 | pendingCount 증가, settled 집계 = 0 |
| 정산 완료(settled) | settledCount, settledTotalClaim, settledTotalPremium 정확성 |
| mixed 상태 | settled만 집계, claimable 제외 확인 |
| 보험료 분배 계산 | `settledTotalPremium × lS × (1 - reinsEff)` 수식 검증 |
| 클레임 분배 계산 | 실제 Claim.lNet/aNet/bNet/rNet 합산 검증 |

```bash
npx vitest run src/hooks/__tests__/useSettlementData.test.ts
```

---

## 5. CI 워크플로우

파일: `.github/workflows/test-frontend.yml`

- **트리거:** `frontend/**` 경로 변경 시 push(main, feature/*) 및 PR
- **컨트랙트 CI와 완전 분리** (`deploy-frontend.yml`과도 분리)
- Node.js 20, `npm ci` 후 `npm test` 실행

```yaml
# 트리거 조건 요약
on:
  push:
    branches: [main, 'feature/**']
    paths: ['frontend/**']
  pull_request:
    branches: [main]
    paths: ['frontend/**']
```

---

## 6. 테스트 현황

```
Test Files  5 passed (5)
Tests       90 passed (90)
Duration    ~1s
```

| 파일 | 테스트 수 |
|------|----------|
| tx.test.ts | 11 |
| pda.test.ts | 16 |
| pure-functions.test.ts | 17 |
| useProtocolStore.test.ts | 40 |
| useSettlementData.test.ts | 6 |
| **합계** | **90** |

---

## 7. 테스트 제외 영역

| 영역 | 이유 |
|------|------|
| UI 컴포넌트 렌더링 | 스냅샷/e2e는 별도 도구 필요 |
| 온체인 훅 (`useProgram`, `useMasterPolicies` 등) | Solana RPC 연결 필요 |
| i18n 번역 문자열 | 번역 내용 변경에 취약, 별도 관리 |
