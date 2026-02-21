# Open Parametric — 프로젝트 계획 v1 및 온체인 설계(초안)

## 1. 프로젝트 요약
Open Parametric은 Solana 기반 파라메트릭 보험 인프라 프로토콜입니다. MVP는 단일 보험상품(항공편 A→B 지연 보험)에 집중하며, 출발 지연 2시간 이상 시 정액 전액 지급을 수행합니다. 이 시스템은 보험사(리더사/참여사) 운영용이며, 약관의 스마트컨트랙트화, 공동 인수 비율 관리, 리스크 풀 운영, 오라클 기반 지급 판정을 제공합니다.

## 2. MVP 범위
- 상품: 항공 지연 파라메트릭 보험(A→B 노선, 특정 항공편/날짜)
- 트리거: 출발 지연 2시간 이상
- 지급: 정액 전액 지급
- 인수: 리더사가 참여 비율 제시, 참여사는 승락/거절
- 예치: 참여 즉시 예치
- 심사: 오라클 데이터로 조건 충족 여부 확인 후 보험사 승인 필요(MVP 기준)
- 계약자 가입: 최소 데이터 등록 형태(소비자 UI 없음)
- 리스크 풀: 온체인 자금 풀 구성
- 오라클: 기존 오라클 네트워크의 항공 데이터 피드 사용

## 3. 주요 사용자
- 리더사(보험 생성, 비율 설정, 라이프사이클 제어)
- 참여사(승락/거절, 자금 예치)
- 운영자/관리자(심사 승인, 정산 실행)

## 4. 오라클 사용(기존 네트워크)
- 한국 항공편 데이터를 제공하는 오라클 네트워크를 사용
- 보험상품(`Policy`)에 오라클 피드 계정을 저장
- 오라클 값의 최신성/정합성 검증 후 조건 충족 시 청구 생성
- 현재는 보험사 승인 후 지급 확정(향후 자동 승인 가능)

### 후보 비교(요약)
1. Switchboard (Solana/SVM)
   - 장점: 커스텀 피드를 만들어 원하는 항공 데이터 API를 직접 연결 가능
   - Solana에서 피드 배포/운영 가이드가 명확함
   - 한국 항공편 제공 API와 결합하기 가장 쉬움
   - 근거: Switchboard 문서에 Solana SVM 데이터 피드 설계/배포/관리 및 feed hash 기반 계정 파생 방식이 설명되어 있음

### 오라클 데이터 소스 추천(항공편)
- 권장: FlightAware AeroAPI (글로벌 항공편 상태/지연 데이터 제공, 쿼리 기반 API)
- 대안: Cirium FlightStats (항공편 상태/지연/게이트 등 상세 데이터 제공)
- 대안: VariFlight DataWorks (광범위 글로벌 항공편 커버리지)
- 보조: 인천공항 공공데이터 API(당일/주간 항공편 현황, 국내 데이터 보완용)

### Switchboard 온디맨드 연동 요약(구현 기준)
- **Canonical quote account**는 `queue`와 `feed ID`로 PDA 파생됨.
- 트랜잭션에는 다음 3개 인스트럭션이 동일 트랜잭션에 포함되어야 함:
  1) Ed25519 검증 인스트럭션  
  2) Switchboard `verified_update` 인스트럭션  
  3) 우리 프로그램의 `check_oracle_and_create_claim`
- 프로그램은 `SlotHashes`, `Instructions`, `Clock` sysvar를 사용해 검증.
- 실제 지연 값은 `quote_account.feeds`에서 읽음(10분 단위 값).

---

# 온체인 계정 구조(상세 초안)

## 5. 계정 목록

### 5.1 `Policy`
단일 파라메트릭 보험상품을 표현합니다.

필드(초안):
- `policy_id` (u64)
- `leader` (Pubkey)
- `route` (예: `ICN-JFK` 문자열 또는 해시)
- `flight_no` (문자열 또는 해시)
- `departure_date` (unix timestamp)
- `delay_threshold_min` (u16, 120=2시간, 10분 단위)
- `payout_amount` (u64, SPL 토큰 단위)
- `currency_mint` (Pubkey, SPL 토큰)
- `oracle_feed` (Pubkey)
- `state` (enum)
- `underwriting` (Pubkey, Underwriting 계정)
- `pool` (Pubkey, RiskPool 계정)
- `created_at` (i64)
- `active_from` (i64)
- `active_to` (i64)

### 5.2 `Underwriting`
공동 인수 구조와 참여 비율을 저장합니다.

필드(초안):
- `policy` (Pubkey)
- `leader` (Pubkey)
- `participants` (ParticipantShare 벡터)
- `total_ratio` (u16, 합계 10000=100.00%)
- `status` (enum)
- `created_at` (i64)

`ParticipantShare`:
- `insurer` (Pubkey)
- `ratio_bps` (u16; 합계 10000)
- `status` (Pending/Accepted/Rejected)
- `escrow` (Pubkey; 예치 계정)

### 5.3 `RiskPool`
보험상품별 예치 자금을 보관합니다.

필드(초안):
- `policy` (Pubkey)
- `currency_mint` (Pubkey)
- `vault` (Pubkey; SPL 토큰 계정)
- `total_escrowed` (u64)
- `available_balance` (u64)
- `status` (enum)

### 5.4 `Claim`
오라클 결과 기반 청구 정보를 저장합니다.

필드(초안):
- `policy` (Pubkey)
- `oracle_round` (u64)
- `oracle_value` (i64)
- `verified_at` (i64)
- `approved_by` (Pubkey)
- `status` (enum)
- `payout_amount` (u64)

### 5.5 `PolicyholderRegistry` (선택)
보험계약자 최소 데이터 등록용 계정.

필드(초안):
- `policy` (Pubkey)
- `entries` (PolicyholderEntry 벡터)

`PolicyholderEntry`:
- `external_ref` (문자열 또는 바이트, 보험사 내부 식별자/해시; PII 저장 안함)
- `policy_id` (u64, 연결된 보험상품 식별자)
- `flight_no` (문자열, 해당 항공편 번호)
- `departure_date` (i64, 출발 예정 시각)
- `passenger_count` (u16, 가입 인원 수)
- `premium_paid` (u64, 납입 보험료)
- `coverage_amount` (u64, 보장 금액)
- `timestamp` (i64, 등록 시각)

---

# 온체인 상태 전이(상세 초안)

## 6. 보험상품 상태(`PolicyState`)
1. `Draft` — 리더사가 보험을 생성한 상태
2. `Open` — 공동 인수 모집 상태
3. `Funded` — 인수 비율 100% 수락 + 예치 완료
4. `Active` — 보험 보장 개시
5. `Claimable` — 오라클 조건 충족
6. `Approved` — 보험사 승인 완료(MVP)
7. `Settled` — 지급 완료
8. `Expired` — 보장 기간 종료(청구 없음)

## 7. 인수 상태(`UnderwritingStatus`)
- `Proposed` → `Open` → `Finalized`
- 실패 시 `Failed`

흐름:
- 리더사가 비율을 제시하고 `Open`.
- 참여사가 승락/거절.
- 승락 시 즉시 예치.
- 합계 10000 bps 및 예치 완료 시 `Finalized`.

## 8. 청구 상태(`ClaimStatus`)
- `None` → `PendingOracle` → `Claimable` → `Approved` → `Settled`
- 거절 시 `Rejected`

흐름:
1. `Active` 중 오라클 값 확인.
2. 지연 >= 120분이면 `Claimable` 생성.
3. 보험사 승인 후 `Approved`.
4. 지급 후 `Settled`.
5. 기간 종료 시 `Expired` 및 예치금 반환.

---

# 온체인 상세 설계 v1

## 9. 오라클 값 의미
- 오라클 값은 **지연 시간(분)**이며 **10분 단위**로 제공.
- 예: 0, 10, 20, 30 ...
- 임계값: `delay_threshold_min = 120`.
- 검증 규칙: `oracle_delay_min % 10 == 0`.

## 10. PDA 시드(확정안)
- `policy`: `PDA(["policy", leader, policy_id])`
- `underwriting`: `PDA(["underwriting", policy])`
- `risk_pool`: `PDA(["pool", policy])`
- `claim`: `PDA(["claim", policy, oracle_round])`
- `policyholder_registry`: `PDA(["registry", policy])`
- `vault`: `risk_pool` PDA가 소유하는 SPL 토큰 계정

## 11. 인스트럭션 / 권한

### 보험 생성
1. `create_policy` (리더사)
- 보험 파라미터, 인수 비율, 오라클 피드 입력
- `Policy`, `Underwriting`, `RiskPool` 생성
- 상태 `Draft`

2. `open_underwriting` (리더사)
- `Policy.state == Draft`
- `Policy.state = Open`, `Underwriting.status = Open`

### 공동 인수 참여
3. `accept_share` (참여사)
- `Policy.state == Open`
- 즉시 SPL 토큰 예치
- 참여 상태 `Accepted`
- 합계 10000 bps 및 예치 완료 시 `Finalized` / `Funded`

4. `reject_share` (참여사)
- `Policy.state == Open`
- 참여 상태 `Rejected`

5. `finalize_underwriting` (리더사, 선택)
- `Underwriting.status == Finalized`
- `Policy.state = Funded`

### 보험 개시
6. `activate_policy` (리더사)
- `Policy.state == Funded`
- `Policy.state = Active`

### 청구
7. `check_oracle_and_create_claim` (누구나)
- `Policy.state == Active`
- 오라클 최신값 검증
- 조건 충족 시 `Claimable` 생성

8. `approve_claim` (리더사/운영자)
- `ClaimStatus == Claimable`
- `ClaimStatus = Approved`

9. `settle_claim` (리더사/운영자)
- `ClaimStatus == Approved`
- 리스크 풀에서 지급
- 비율에 따른 분배 반영
- `Settled`

### 만기/환급
10. `expire_policy` (누구나)
- 보장기간 만료
- `Policy.state = Expired`

11. `refund_after_expiry` (참여사)
- `Policy.state == Expired`
- 예치금 비율 환급

## 12. 검증/안전 규칙
- 인수 비율 합계는 반드시 10000 bps.
- 예치 완료 전 `Funded` 진입 불가.
- `payout_amount`는 `RiskPool.available_balance`를 초과할 수 없음.
- 오라클 값은 최신성 윈도우 내여야 함.
- 오라클 지연 값은 10분 단위.
- 보험상품당 1개 청구만 활성화.

## 13. 토큰 흐름(SPL)
- 참여사가 `RiskPool.vault`로 SPL 토큰 예치
- 지급 시 `RiskPool.vault`에서 출금
- 청구가 없으면 비율대로 환급

---

# 계정 사이즈 산정(초안)

## 14. 계정 사이즈 산정 규칙
- Anchor 계정은 8바이트 discriminator 포함
- `String`과 `Vec`는 최대 길이를 사전 정의해야 함

## 15. 최대 길이(가정)
- `MAX_ROUTE_LEN = 16`
- `MAX_FLIGHT_NO_LEN = 16`
- `MAX_EXTERNAL_REF_LEN = 32`
- `MAX_PARTICIPANTS = 16`
- `MAX_POLICYHOLDERS = 128`

## 16. 사이즈 추정(요약)
확정값 기준으로 대략적인 계정 크기를 계산합니다(Anchor 기준).

### `Policy`
고정 필드 약 211바이트 + `route`/`flight_no` 문자열 + `departure_date` 포함
예상 크기:
- 고정 211
- `route` 4 + 16
- `flight_no` 4 + 16
- `departure_date` 8
- 합계 259
- Anchor discriminator 8 포함 → **267 bytes**

### `Underwriting`
고정 필드 약 75바이트 + `participants` 벡터
`ParticipantShare` 67바이트 * 16 = 1072
- 벡터 길이 4바이트 포함
- 합계 75 + 4 + 1072 = 1151
- Anchor discriminator 8 포함 → **1159 bytes**

### `RiskPool`
고정 필드 약 113바이트
- Anchor discriminator 8 포함 → **121 bytes**

### `Claim`
고정 필드 약 97바이트
- Anchor discriminator 8 포함 → **105 bytes**

### `PolicyholderRegistry`
`PolicyholderEntry` = (4 + 32) + 8 + (4 + 16) + 8 + 2 + 8 + 8 + 8 = 106 bytes
`entries` 벡터: 4 + 128 * 106 = 13572
`policy` 32
- 합계 32 + 4 + 13572 = 13608
- Anchor discriminator 8 포함 → **13616 bytes**

---

# 미정 사항
- 오라클 네트워크 및 항공편 피드 구체화

---

# 권한 및 서명 규칙(확정안 v1)

## 17. 역할 정의
- `Leader` (리더사): 보험 생성, 인수 조건 설정, 보험 개시, 청구 승인/정산 권한
- `Participant` (참여사): 인수 참여/거절, 예치, 만기 환급 권한
- `Public` (누구나): 오라클 검증 트리거, 만기 처리

## 18. 서명 규칙 (Instruction별)

### 보험 생성/관리
- `create_policy`: `Leader` 서명 필수
- `open_underwriting`: `Leader` 서명 필수
- `activate_policy`: `Leader` 서명 필수

### 인수 참여/거절
- `accept_share`: 해당 `Participant` 서명 필수 + 예치 계정 소유자 서명
- `reject_share`: 해당 `Participant` 서명 필수

### 청구/정산
- `check_oracle_and_create_claim`: `Public` 가능(서명 제한 없음)
- `approve_claim`: `Leader` 서명 필수
- `settle_claim`: `Leader` 서명 필수

### 만기/환급
- `expire_policy`: `Public` 가능(서명 제한 없음)
- `refund_after_expiry`: 해당 `Participant` 서명 필수

## 19. 권한 검증 규칙
- `Leader`는 `Policy.leader`와 서명자가 일치해야 함.
- `Participant`는 `Underwriting.participants[i].insurer`와 서명자가 일치해야 함.
- `Public` 호출은 상태 및 시간 조건 검증만 수행.

추가 제안:
- `approve_claim`와 `settle_claim`을 분리하여 감사 가능성을 확보.

---

# 프로그램 에러 및 검증 규칙(상세 v1)

## 20. 공통 에러 코드(제안)
- `E_UNAUTHORIZED` 서명자 권한 없음
- `E_INVALID_STATE` 잘못된 상태 전이
- `E_INVALID_RATIO` 인수 비율 합계 불일치
- `E_ALREADY_EXISTS` 이미 존재하는 계정/청구
- `E_NOT_FOUND` 대상 계정 없음
- `E_INSUFFICIENT_ESCROW` 예치금 부족
- `E_POOL_INSUFFICIENT` 풀 잔액 부족
- `E_ORACLE_STALE` 오라클 값이 오래됨
- `E_ORACLE_FORMAT` 오라클 값 형식/단위 오류
- `E_TIME_WINDOW` 시간 조건 불일치
- `E_INPUT_INVALID` 입력 파라미터 오류
- `E_AMOUNT_INVALID` 금액/지급값 오류

## 21. Instruction별 검증 규칙

### `create_policy`
- `Leader` 서명 필수
- `payout_amount > 0`
- `active_from < active_to`
- `delay_threshold_min == 120`
- `currency_mint` 유효
- `route`, `flight_no` 길이 ≤ 최대치
- `policy_id`는 리더별 유니크

### `open_underwriting`
- `Policy.state == Draft`
- `Underwriting.status == Proposed`

### `accept_share`
- `Policy.state == Open`
- 해당 `Participant` 상태 `Pending`
- `ratio_bps > 0`
- 예치금 이체 성공 확인
- 누적 `ratio_bps` 합계 ≤ 10000
- 예치금 규모가 `payout_amount * ratio_bps/10000` 이상

### `reject_share`
- `Policy.state == Open`
- 해당 `Participant` 상태 `Pending`

### `activate_policy`
- `Policy.state == Funded`
- 현재 시간 ≥ `active_from`

### `check_oracle_and_create_claim`
- `Policy.state == Active`
- 오라클 피드 계정 일치
- 오라클 값 최신성 검사(예: 30분 이내)
- 오라클 값이 10분 단위인지 확인
- 오라클 값 ≥ `delay_threshold_min`일 때만 `Claim` 생성
- 기존 활성 `Claim` 존재 시 거부

### `approve_claim`
- `Claim.status == Claimable`
- `Policy.state == Claimable`

### `settle_claim`
- `Claim.status == Approved`
- `payout_amount <= RiskPool.available_balance`
- 지급 후 잔액 갱신

### `expire_policy`
- `Policy.state == Active`
- 현재 시간 > `active_to`
- 활성 `Claim` 없음

### `refund_after_expiry`
- `Policy.state == Expired`
- 참여자 상태 `Accepted`
- 참여자별 예치 비율에 따라 환급

---

# 오라클 데이터 구조 및 검증(상세 v1)

## 22. 오라클 데이터 구조(가정)
Switchboard 커스텀 피드에서 온체인으로 제공되는 값은 다음을 만족해야 함.

필드(논리적 구조):
- `flight_no` (문자열 또는 해시, 피드 메타데이터에 포함)
- `departure_date` (i64, 출발 예정 시각)
- `delay_min` (i64, 지연 분; 10분 단위)
- `last_updated` (i64, 오라클 업데이트 시각)

온체인에서는 `delay_min`, `last_updated`를 직접 읽고,
`flight_no`, `departure_date`는 정책 계정의 값과 일치하도록 오프체인에서 보장.

## 23. 오라클 검증 규칙(추천)
- 피드 계정 주소는 `Policy.oracle_feed`와 일치해야 함.
- `delay_min % 10 == 0` (10분 단위)
- `delay_min >= 0`
- `now - last_updated <= ORACLE_FRESHNESS_WINDOW` (예: 30분)
- `delay_min >= delay_threshold_min`이면 `Claimable` 생성
- 피드가 실패/결측이면 `E_ORACLE_STALE` 또는 `E_ORACLE_FORMAT`

## 24. 오라클 운영 규칙(오프체인)
- 오프체인 오라클 워커가 항공 데이터 API를 주기적으로 조회
- 지연 계산은 `actual_departure - scheduled_departure` 기준
- 지연 결과는 10분 단위로 반올림 또는 내림(정책에 명시)
- 피드 업데이트 주기와 신뢰성 모니터링 필요

---

# 리스크 풀 정산 로직(상세 v1)

## 25. 예치 계산 규칙
각 참여사 예치액은 다음을 만족해야 함:
- `escrow_amount_i >= payout_amount * ratio_bps_i / 10000`

## 26. 지급 시 정산
- `payout_amount`는 풀에서 차감
- 참여사별 부담액:  
  `loss_i = payout_amount * ratio_bps_i / 10000`
- 풀 잔액은 차감 후 업데이트

## 27. 부지급/만기 시 환급
- 정책 만기 후 `Expired` 상태에서 환급 가능
- 참여사별 환급액:  
  `refund_i = escrow_amount_i` (전액 환급)
- 환급 완료 후 풀 잔액 정리

## 28. 수수료/운영비(옵션)
- MVP에서는 수수료 없음
- 추후 `fee_bps` 도입 시 `payout_amount`에서 차감 후 분배

---

# 테스트 시나리오(상세 v1)

## 29. 정상 플로우
1. 리더가 보험 생성 → `Draft`
2. 리더가 인수 모집 → `Open`
3. 참여사들이 승락/예치 → `Funded`
4. 리더가 보험 개시 → `Active`
5. 오라클 값 120 이상 → `Claimable`
6. 리더 승인 → `Approved`
7. 지급 정산 → `Settled`

## 30. 부지급 플로우
1. 보험 개시 → `Active`
2. 오라클 값 < 120
3. 만기 도래 → `Expired`
4. 참여사 환급 완료

## 31. 실패/예외 케이스
- 인수 비율 합계 10000 미달 → `Funded` 불가
- 오라클 최신성 실패 → `E_ORACLE_STALE`
- 지연 값 10분 단위 위반 → `E_ORACLE_FORMAT`
- 승인 없이 지급 시도 → `E_INVALID_STATE`
- 잔액 부족 지급 시도 → `E_POOL_INSUFFICIENT`

---

# Anchor 타입 정의(초안 v1)

## 32. 계정 타입(Anchor)

### `Policy`
```rust
pub struct Policy {
    pub policy_id: u64,
    pub leader: Pubkey,
    pub route: String,
    pub flight_no: String,
    pub departure_date: i64,
    pub delay_threshold_min: u16,
    pub payout_amount: u64,
    pub currency_mint: Pubkey,
    pub oracle_feed: Pubkey,
    pub state: u8,
    pub underwriting: Pubkey,
    pub pool: Pubkey,
    pub created_at: i64,
    pub active_from: i64,
    pub active_to: i64,
}
```

### `Underwriting`
```rust
pub struct Underwriting {
    pub policy: Pubkey,
    pub leader: Pubkey,
    pub participants: Vec<ParticipantShare>,
    pub total_ratio: u16,
    pub status: u8,
    pub created_at: i64,
}
```

### `ParticipantShare`
```rust
pub struct ParticipantShare {
    pub insurer: Pubkey,
    pub ratio_bps: u16,
    pub status: u8,
    pub escrow: Pubkey,
}
```

### `RiskPool`
```rust
pub struct RiskPool {
    pub policy: Pubkey,
    pub currency_mint: Pubkey,
    pub vault: Pubkey,
    pub total_escrowed: u64,
    pub available_balance: u64,
    pub status: u8,
}
```

### `Claim`
```rust
pub struct Claim {
    pub policy: Pubkey,
    pub oracle_round: u64,
    pub oracle_value: i64,
    pub verified_at: i64,
    pub approved_by: Pubkey,
    pub status: u8,
    pub payout_amount: u64,
}
```

### `PolicyholderRegistry`
```rust
pub struct PolicyholderRegistry {
    pub policy: Pubkey,
    pub entries: Vec<PolicyholderEntry>,
}
```

### `PolicyholderEntry`
```rust
pub struct PolicyholderEntry {
    pub external_ref: String,
    pub policy_id: u64,
    pub flight_no: String,
    pub departure_date: i64,
    pub passenger_count: u16,
    pub premium_paid: u64,
    pub coverage_amount: u64,
    pub timestamp: i64,
}
```

## 33. Enum 타입(Anchor)

```rust
pub enum PolicyState {
    Draft = 0,
    Open = 1,
    Funded = 2,
    Active = 3,
    Claimable = 4,
    Approved = 5,
    Settled = 6,
    Expired = 7,
}

pub enum UnderwritingStatus {
    Proposed = 0,
    Open = 1,
    Finalized = 2,
    Failed = 3,
}

pub enum ClaimStatus {
    None = 0,
    PendingOracle = 1,
    Claimable = 2,
    Approved = 3,
    Settled = 4,
    Rejected = 5,
}
```

---

# 시뮬레이션 데이터(샘플 v1)

## 34. 샘플 보험(Policy)
- `policy_id`: 1001
- `leader`: `LeaderPubkey`
- `route`: `ICN-JFK`
- `flight_no`: `KE081`
- `departure_date`: `2026-03-15T10:00:00Z` (Unix)
- `delay_threshold_min`: 120
- `payout_amount`: 1,000,000 (SPL 단위)
- `currency_mint`: `MintPubkey`
- `oracle_feed`: `OracleFeedPubkey`
- `active_from`: `2026-03-15T00:00:00Z`
- `active_to`: `2026-03-16T00:00:00Z`

## 35. 샘플 참여사(Underwriting)
- 리더: 40% (4000 bps)
- 참여사 A: 35% (3500 bps)
- 참여사 B: 25% (2500 bps)

## 36. 샘플 예치금
- 리더 예치: 400,000
- 참여사 A 예치: 350,000
- 참여사 B 예치: 250,000

## 37. 샘플 오라클 값
- `delay_min = 130` (조건 충족)
- `last_updated`: `2026-03-15T11:00:00Z`

## 38. 샘플 정산
- 지급액: 1,000,000
- 부담: 리더 400,000 / 참여사 A 350,000 / 참여사 B 250,000

---

# 샘플 서비스 유저 플로우(운영용)

## 39. 리더사 플로우
1. 보험상품 생성: 노선/항공편/날짜/지연 기준/정액 지급 설정
2. 공동 인수 비율 설정 후 모집 개시
3. 참여사 응답 모니터링
4. 인수 완료 후 보험 개시
5. 오라클 지연 발생 알림 확인
6. 청구 승인 및 지급 실행

## 40. 참여사 플로우
1. 모집 중인 보험 확인
2. 비율 검토 후 승락 또는 거절
3. 승락 시 즉시 예치 완료
4. 만기 시 환급 확인

## 41. 운영자 플로우(내부)
1. 오라클 피드 정상 업데이트 모니터링
2. 지연 조건 충족 시 청구 상태 확인
3. 정산 후 감사 로그 확인

---

# 저장소 구조(초기 스캐폴딩)
- `contract/`: Anchor 기반 Solana 프로그램
- `frontend/`: 간단 미리보기 화면(정적 HTML/CSS)
