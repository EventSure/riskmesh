# Flight Settlement (Claim / No-Claim) 정산 로직

이 문서는 아래 두 파일의 정산 흐름을 요약합니다.
- contract/programs/open_parametric/src/instructions/settle_flight_claim.rs
- contract/programs/open_parametric/src/instructions/settle_flight_no_claim.rs

## 개요
- `settle_flight_claim.rs`: 클레임 발생 시 보험금 지급을 위한 정산 로직
- `settle_flight_no_claim.rs`: 클레임 미발생 시 보험료(프리미엄) 분배 정산 로직

두 로직 모두 `MasterPolicy`가 Active 상태인지, 실행자 권한이 적절한지, 토큰 계정/민트가 올바른지 검증한 뒤, `share_bps` 비율에 따라 금액을 분배합니다.

## 용어 정리
- `bps`: Basis Points의 약자. 1 bps = 0.01% (100 bps = 1%, 10,000 bps = 100%). 코드에서는 `BPS_DENOM = 10,000`을 기준으로 비율을 계산합니다.
- `reinsurer_effective_bps`: 전체 금액(보험금 또는 보험료) 중 재보험사가 부담/수령하는 실질 비율을 bps로 표현한 값입니다. 코드에서는 `ceded_ratio_bps`와 `reins_commission_bps`를 사용해 아래처럼 계산합니다.
  - `reinsurer_effective_bps = ceded_ratio_bps * (10,000 - reins_commission_bps) / 10,000`
- `share_bps`: 참여 보험사(leader 포함) 간의 분배 비율을 bps로 표현한 값입니다. 모든 참여 보험사의 `share_bps` 합은 10,000 bps(100%)가 됩니다.

## 1) 클레임 정산 (`settle_flight_claim.rs`)

### 핵심 조건
- `MasterPolicy.status == Active`
- `FlightPolicy.status == Claimable`
- 실행자(`executor`)는 `leader` 또는 `operator`
- 입력된 토큰 계정이 `MasterPolicy`에 등록된 계정과 일치

### 금액 계산
- 기준 금액: `flight.payout_amount`
- 재보험사 부담액: `payout * reinsurer_effective_bps / BPS_DENOM`
- 보험사 부담액 총합: `payout - reinsurer_amount`
- 보험사별 분배: `participants[i].share_bps` 비율로 분할

### 토큰 이동 방향
- 재보험 풀 지갑(`reinsurer_pool_token`) -> 리더 예치 지갑(`leader_deposit_token`)
- 각 보험사 풀 지갑(`participants[i].pool_wallet`) -> 리더 예치 지갑

### 결과 상태
- `FlightPolicy.status = Paid`
- `updated_at` 갱신

### 금액 계산 예시
조건:
- `payout_amount = 80 USDC`
- `ceded_ratio_bps = 5,000` (출재율 0.5)
- `reins_commission_bps = 1,000` (수수료율 0.1)
- `reinsurer_effective_bps = 5,000 * (10,000 - 1,000) / 10,000 = 4,500` (재보험 실질 비율 0.45)
- 보험사 수 3개(리더사 포함), 비율 `leader : A : B = 5 : 3 : 2`

계산:
- 재보험사 부담액: `80 * 4,500 / 10,000 = 36.0 USDC`
- 보험사 부담액 총합: `80 - 36.0 = 44.0 USDC`
- 보험사별 분배:
  - 리더사: `44.0 * (5/10) = 22.0 USDC`
  - 참여사 A: `44.0 * (3/10) = 13.2 USDC`
  - 참여사 B: `44.0 * (2/10) = 8.8 USDC`

## 2) 노클레임 정산 (`settle_flight_no_claim.rs`)

### 핵심 조건
- `MasterPolicy.status == Active`
- `FlightPolicy.status == NoClaim`
- `premium_distributed == false`
- 실행자(`executor`)는 `leader` 또는 `operator`
- 입력된 토큰 계정이 `MasterPolicy`에 등록된 계정과 일치

### 금액 계산
- 기준 금액: `flight.premium_paid`
- 재보험사 수령액: `premium * reinsurer_effective_bps / BPS_DENOM`
- 보험사 수령액 총합: `premium - reinsurer_amount`
- 보험사별 분배: `participants[i].share_bps` 비율로 분할

### 토큰 이동 방향
- 리더 예치 지갑(`leader_deposit_token`) -> 재보험사 예치 지갑(`reinsurer_deposit_token`)
- 리더 예치 지갑 -> 각 보험사 예치 지갑(`participants[i].deposit_wallet`)

### 결과 상태
- `FlightPolicy.premium_distributed = true`
- `FlightPolicy.status = Expired`
- `updated_at` 갱신

### 금액 계산 예시
조건:
- `premium_paid = 5 USDC`
- `ceded_ratio_bps = 5,000` (출재율 0.5)
- `reins_commission_bps = 1,000` (수수료율 0.1)
- `reinsurer_effective_bps = 5,000 * (10,000 - 1,000) / 10,000 = 4,500` (재보험 실질 비율 0.45)
- 보험사 수 3개(리더사 포함), 비율 `leader : A : B = 5 : 3 : 2`

계산:
- 재보험사 수령액: `5 * 4,500 / 10,000 = 2.25 USDC`
- 보험사 수령액 총합: `5 - 2.25 = 2.75 USDC`
- 보험사별 분배:
  - 리더사: `2.75 * (5/10) = 1.375 USDC`
  - 참여사 A: `2.75 * (3/10) = 0.825 USDC`
  - 참여사 B: `2.75 * (2/10) = 0.55 USDC`

## 요약 비교

### 클레임 발생
- 목적: 보험금 지급 재원 확보
- 자금 흐름: 재보험/보험사 풀 -> 리더 지갑
- 상태: `Claimable` -> `Paid`

### 클레임 없음
- 목적: 보험료 분배
- 자금 흐름: 리더 지갑 -> 재보험/보험사 예치 지갑
- 상태: `NoClaim` -> `Expired`

## 수수료율 반영 예시 (재보험 커미션 포함)
아래 수식은 코드의 `reinsurer_effective_bps` 계산과 동일합니다.

기본 변수:
- `P`: 개별 계약 보험료
- `C`: 개별 계약 지급금
- `s_i`: 원수사 내부 지분 (리더 0.5, A 0.3, B 0.2)
- `q`: 출재율 (0.5)
- `k`: 수수료율 (0.1)
- `r_eff`: 재보험 실질 비율 = `q * (1 - k)` = `0.45`
- `i_eff`: 원수사 실질 비율 = `1 - r_eff` = `0.55`

Premium 분배:
- 재보험사 수익: `P * r_eff`
- 원수사 i 수익: `P * i_eff * s_i`

Claim 부담:
- 재보험사 비용: `C * r_eff`
- 원수사 i 비용: `C * i_eff * s_i`

예시(`P = 1,000,000`, `C = 500,000`):
- Premium: 재보험 450,000 / 원수사 총 550,000
- Claim: 재보험 225,000 / 원수사 총 275,000
- 원수사 분배(지분 5:3:2):
  - 리더 137,500
  - 참여사 A 82,500
  - 참여사 B 55,000
