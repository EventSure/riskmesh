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
- `external_ref` (문자열 또는 바이트)
- `premium_paid` (u64)
- `coverage_amount` (u64)
- `timestamp` (i64)

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
`PolicyholderEntry` = (4 + 32) + 8 + 8 + 8 = 60 bytes
`entries` 벡터: 4 + 128 * 60 = 7684
`policy` 32
- 합계 32 + 4 + 7684 = 7720
- Anchor discriminator 8 포함 → **7728 bytes**

---

# 미정 사항
- 계약자 데이터 스키마
- 오라클 네트워크 및 항공편 피드 구체화

---

# 권한 및 서명 규칙(확정안 v1)

## 17. 역할 정의
- `Leader` (리더사): 보험 생성, 인수 조건 설정, 보험 개시, 청구 승인/정산 권한
- `Participant` (참여사): 인수 참여/거절, 예치, 만기 환급 권한
- `Operator` (운영자): 리더사로부터 위임받은 승인/정산 권한(옵션)
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
- `approve_claim`: `Leader` 또는 `Operator` 서명 필수
- `settle_claim`: `Leader` 또는 `Operator` 서명 필수

### 만기/환급
- `expire_policy`: `Public` 가능(서명 제한 없음)
- `refund_after_expiry`: 해당 `Participant` 서명 필수

## 19. 권한 검증 규칙
- `Leader`는 `Policy.leader`와 서명자가 일치해야 함.
- `Participant`는 `Underwriting.participants[i].insurer`와 서명자가 일치해야 함.
- `Operator`는 `Policy.operator` 또는 `Underwriting.operator` (추가 필드 필요)로 등록된 경우에만 허용.
- `Public` 호출은 상태 및 시간 조건 검증만 수행.

추가 제안:
- `Operator` 지원을 위해 `Policy.operator`(Pubkey, optional) 필드를 추가하는 것을 고려.
- `approve_claim`와 `settle_claim`을 분리하여 감사 가능성을 확보.
