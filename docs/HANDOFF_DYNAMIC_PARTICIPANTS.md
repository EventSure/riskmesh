# Handoff: Dynamic Participants & Optional Reinsurer

프론트엔드 동적 참여사/재보험사 리팩토링 완료 기준 handoff 문서.
백엔드/컨트랙트 개발자가 이어서 작업할 수 있도록 변경 사항과 연동 필요 항목을 정리합니다.

---

## 1. 변경 요약

| 항목 | 기존 | 변경 후 |
|------|------|---------|
| 참여사 수 | 고정 2개 (partA, partB) | 동적 1~4개 |
| 재보험사 | 필수 포함 | 선택 (0 또는 1개) |
| 역할 타입 | `'leader' \| 'partA' \| 'partB' \| 'rein'` | `'leader' \| 'participant' \| 'rein'` |
| 지분 구조 | `shares: { leader, partA, partB }` | `leaderShare: number` + `participants: Participant[]` |
| 컨펌 상태 | `confirms: { partA, partB, rein }` | `participants[i].confirmed` + `reinsurer.confirmed` |
| 네트 배열 | `aNet, bNet` | `participantNets: number[]` |
| 누적 데이터 | `partAPrem, partBPrem` 등 | `participantPrems: number[]` 등 |

---

## 2. 프론트엔드 데이터 모델

### Participant

```typescript
interface Participant {
  id: string;          // 'p1', 'p2', 'p3', 'p4'
  name: string;        // 사용자 입력 이름 (예: '현대해상')
  share: number;       // 원수사 내 지분 % (leader + 모든 participants 합산 = 100)
  address: string;     // 지갑 주소 (on-chain 연동 시 사용)
  confirmed: boolean;
}
```

### ReinsurerConfig

```typescript
interface ReinsurerConfig {
  enabled: boolean;    // 재보험사 참여 여부
  address: string;     // 지갑 주소
  confirmed: boolean;
}
```

### Contract / Claim

```typescript
interface Contract {
  // ... 기존 필드 ...
  lNet: number;
  participantNets: number[];  // participants 순서 인덱스
  rNet: number;               // reinsurer.enabled = false 이면 0
}

interface Claim {
  // ... 기존 필드 ...
  lNet: number;
  participantNets: number[];
  rNet: number;
}
```

### Acc (누적 집계)

```typescript
interface Acc {
  leaderPrem: number;
  participantPrems: number[];   // participants 순서대로
  reinPrem: number;
  leaderClaim: number;
  participantClaims: number[];
  reinClaim: number;
}
```

### 참여사 컬러 팔레트

```typescript
const PARTICIPANT_COLORS = ['#14F195', '#F59E0B', '#38BDF8', '#A78BFA'];
// 참여사 1: 초록, 2: 주황, 3: 하늘, 4: 보라
const REINSURER_COLOR = '#EC4899'; // 핑크
```

---

## 3. 컨트랙트 변경 필요사항

### 3-1. `MasterAgreement` 계정 구조

현재 컨트랙트는 participants 배열이 고정 크기(leader + partA + partB = 3)로 설계되어 있습니다.

필요한 변경:
- `participants` 배열을 가변 길이로 변경 (최대 5: leader + 4참여사)
- 상수 확인:
  ```rust
  // 현재
  MAX_MASTER_PARTICIPANTS: usize = 8  // 이미 여유 있음 — 실제 사용 크기만 조정
  ```
- 재보험사 관련 필드를 `Option<>` 타입으로 변경:
  ```rust
  // 기존
  pub reinsurer: Pubkey,
  pub reinsurer_pool_wallet: Pubkey,
  pub ceded_ratio_bps: u16,
  pub reins_commission_bps: u16,

  // 변경 후 (재보험사가 없을 경우 None)
  pub reinsurer: Option<Pubkey>,
  pub reinsurer_pool_wallet: Option<Pubkey>,
  pub ceded_ratio_bps: u16,         // reinsurer.is_none()이면 0
  pub reins_commission_bps: u16,    // 동일
  ```
- account space 재계산: 참여사 수에 따른 가변 크기 고려

### 3-2. `create_master_agreement` instruction

```rust
// 기존: participants 고정 (partA, partB, reinsurer pubkey 분리)
// 변경: participants Vec<ParticipantInput> + reinsurer: Option<ReinsurerInput>

pub struct CreateMasterAgreementArgs {
    pub master_id: u32,
    pub participants: Vec<ParticipantInput>,  // 최대 4개 (leader 제외)
    pub reinsurer: Option<ReinsurerInput>,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub payout_tiers: PayoutTiers,
    pub premium_per_policy: u64,
    // ...
}
```

### 3-3. `confirm_master` instruction

현재는 `role: u8 (0=Participant, 1=Reinsurer)` + 인덱스로 동작.
변경 후에도 동일하게 동작 가능하나, 재보험사가 없는 경우 reinsurer confirm이 불필요함을 처리해야 합니다.

### 3-4. `activate_master` instruction

현재 모든 participants confirmed 확인 로직:
```rust
// 현재: 3개 고정 확인
// 변경: participants.len()까지만 확인 + reinsurer.is_some()이면 reinsurer도 확인
let all_confirmed = master.participants[1..]
    .iter()
    .all(|p| p.confirmed)
    && (master.reinsurer.is_none() || master.reinsurer_confirmed);
```

### 3-5. `settle_flight_claim` / `settle_flight_no_claim`

split 로직이 동적 참여사 수 대응 필요:
```rust
// 기존: participants[1], participants[2] 하드코딩
// 변경: participants[1..].iter().enumerate()로 루프
```

pool_wallet remaining accounts도 동적으로 전달해야 합니다.

---

## 4. 백엔드 변경 필요사항

### 4-1. `oracle/track_a.rs`

```rust
// 현재: partA, partB pool wallet을 고정 인덱스로 참조
// 변경: master.participants[1..].iter()로 루프하여 pool_wallet 처리
```

### 4-2. API 응답 (`BackendMasterAgreement`)

```rust
// 현재
pub struct BackendMasterAgreement {
    pub participants: Vec<ParticipantInfo>,  // 이미 배열 — 길이만 동적화
    // ...
}
```

`participants` 배열 길이가 동적으로 변할 수 있음을 확인하고,
프론트엔드의 `syncMasterFromChain()` 매핑 코드와 일치 여부 검증 필요.

---

## 5. 프론트↔컨트랙트 연동 체크리스트

컨트랙트 변경 완료 후 프론트엔드에서 업데이트해야 할 항목:

- [ ] `anchor build` 후 IDL 재생성 → `frontend/src/lib/idl/open_parametric.ts` 및 `.json` 업데이트
- [ ] `syncMasterFromChain()` (`useProtocolStore.ts`) — `data.participants.slice(1)` 동적 매핑 (현재 TODO 처리됨)
- [ ] `MasterContractSetup.handleSetTerms()` — on-chain instruction 구성 시 동적 participants 배열 전달
  ```typescript
  // frontend/src/components/tabs/tab-contract/MasterContractSetup.tsx
  // participants.map(p => ...) 로 동적 keypair 생성 및 instruction args 구성
  ```
- [ ] `useParticipantRole.ts` — 백엔드 API 응답의 participants 배열 동적 매핑
- [ ] `useCreateMasterAgreement.ts` — participants 배열 동적 구성
- [ ] `onChainSetTerms()` (`useProtocolStore.ts`) — instruction args에 동적 participants 전달

---

## 6. 테스트 시나리오 (컨트랙트 완료 후 E2E)

### 기본 플로우

1. **참여사 1개 + 재보험사 없음**
   - 마스터 생성 → 참여사1 컨펌 → 리더 활성화
   - FlightPolicy 발행 → 오라클 → 정산 (lNet + participantNets[0])

2. **참여사 2개 + 재보험사 있음**
   - 마스터 생성 → 참여사1 컨펌 → 참여사2 컨펌 → 재보험사 컨펌 → 활성화
   - 정산 시 participantNets.length === 2 확인

3. **참여사 4개 + 재보험사 1개 (최대 구성)**
   - 최대 구성 정산 정확성 확인

### 엣지 케이스

- 지분 합계가 100 아닌 경우 → 프론트에서 차단 확인
- 리더 혼자 (참여사 0개) → 프론트에서 차단 확인 (`store.participantRequired`)
- 재보험사 없는 경우 rNet === 0 확인

---

## 7. 주요 변경 파일 목록

```
frontend/src/store/useProtocolStore.ts          ← 핵심: 타입/상태/액션 전체 변경
frontend/src/hooks/useSettlementData.ts
frontend/src/hooks/useMasterAgreements.ts
frontend/src/hooks/useParticipantRole.ts
frontend/src/components/layout/PortalHeader.tsx
frontend/src/components/layout/MasterAgreementDropdown.tsx
frontend/src/components/tabs/tab-contract/ShareStructure.tsx
frontend/src/components/tabs/tab-contract/MasterContractSetup.tsx
frontend/src/components/tabs/tab-contract/ParticipantConfirm.tsx
frontend/src/components/tabs/tab-feed/ContractFeedTable.tsx
frontend/src/components/tabs/tab-feed/AccumulatedSummary.tsx
frontend/src/components/tabs/tab-feed/PremiumPieChart.tsx
frontend/src/components/tabs/tab-oracle/ClaimTable.tsx
frontend/src/components/tabs/tab-oracle/ClaimSettlementSummary.tsx
frontend/src/components/tabs/tab-settlement/PremiumSettlementTable.tsx
frontend/src/components/tabs/tab-settlement/ClaimSettlementTable.tsx
frontend/src/components/tabs/tab-settlement/FinalSettlementTable.tsx
frontend/src/components/tabs/tab-settlement/SettlementChart.tsx
frontend/src/components/tabs/tab-inspector/InspectorPanel.tsx
frontend/src/components/tabs/tab-portal/PortalSettlement.tsx
frontend/src/components/guide/GuideTour.tsx
frontend/src/components/guide/guideSteps.ts
frontend/src/pages/PortalPage.tsx
frontend/src/i18n/locales/ko.ts
frontend/src/i18n/locales/en.ts
```
