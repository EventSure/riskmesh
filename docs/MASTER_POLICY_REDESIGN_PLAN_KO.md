# 항공 지연 보험 구조 개편 계획 (마스터 계약 + 개별 계약)

## 1) 목표

기존 `항공편 1건 = 보험 1계약` 구조를 아래 2계약 구조로 변경한다.

1. `마스터 계약(Master Contract)`
- 기간(예: 2026-01-01 ~ 2026-12-31) 단위로 운영
- 공통 약관/지분/출재율/수수료/승인 상태 관리
- 개별 항공 지연 보험(Child Contract) 생성 팩토리 역할

2. `개별 항공 지연 보험 계약(Child Flight Delay Contract)`
- 실제 가입 건(항공편 + 가입자 + 보험료 + 보장) 관리
- 청구 시 오라클 결과 기반 지급/부지급 처리
- 정산 시 참여사/재보험사 pool에서 리더사 deposit으로 자동 집금

---

## 2) 확정 비즈니스 규칙

### 마스터 약관
- 계약 기간: `2026-01-01` ~ `2026-12-31`
- 보험료: 가입 건당 `1 USDC`
- 지연 보상:
1. 2시간대(2:00~2:59): `40 USDC`
2. 3시간대(3:00~3:59): `60 USDC`
3. 4~5시간대(4:00~5:59): `80 USDC`
4. 6시간 이상 지연 또는 결항: `100 USDC`

### 지분 및 출재
- 원수사 내부 지분: 리더 50%, 참여사 A 30%, 참여사 B 20%
- 원수사 그룹 ↔ 재보험사 기준 지분: 50% : 50%
- 출재율: 각 원수사 지분의 50%를 재보험사로 출재
- 출재 수수료(재보험 수수료): 10%
- 수수료 규칙: 원수사가 재보험사로 넘기는 출재금에서 10% 공제 후 이전

### 수수료 반영 결과(확정)
- 재보험 실질 비율: 50%가 아니라 45%
- 원수사 그룹 실질 비율: 55%
- 위 실질 비율은 `Premium 분배`와 `Claim 정산` 모두 동일하게 적용

### 승인(활성화) 플로우
1. 리더사가 마스터 계약 생성 및 지분 정의
2. 참여사 + 재보험사 컨펌
3. Operator 최종 컨펌
4. 마스터 계약 Active 전환

Operator는 리더사 또는 OpenParametric 운영자 계정이 될 수 있다.

---

## 3) 온체인 아키텍처 변경안

## 3.1 신규 계정(마스터 계약)

`MasterPolicy`
- master_id
- leader
- operator
- currency_mint (USDC)
- coverage_start_ts / coverage_end_ts
- premium_per_policy (=1 USDC)
- payout_tiers (2h/3h/4-5h/6h+)
- ceded_ratio_bps (=5000)
- reins_commission_bps (=1000)
- status (Draft / PendingConfirm / Active / Closed)
- confirmation bitmap (leader/participants/reinsurer/operator)
- leader_deposit_wallet (최종 집금/분배 기준 지갑)

`MasterParticipants`
- 원수사 참여사 목록 (leader, A, B)
- 내부 지분 bps (5000/3000/2000)
- insurer_pool_wallet (부담금 출금 지갑)
- insurer_deposit_wallet (정산 유입 지갑, pool과 분리)

`MasterReinsurance`
- reinsurer
- reinsurer_pool_wallet
- reinsurer_deposit_wallet
- cession rule, commission rule

## 3.2 신규 계정(개별 계약)

`FlightPolicy` (개별 항공 지연 보험)
- child_policy_id
- parent_master (MasterPolicy pubkey)
- subscriber(가입자 식별자 또는 오프체인 ref hash)
- flight_no / departure_ts / route(optional)
- premium_paid (=1 USDC)
- status (Issued / AwaitingOracle / Claimable / Paid / NoClaim / Expired)
- oracle_ref / resolved_delay_min / cancellation_flag
- payout_amount

`FlightSettlement`
- 청구/부지급 정산 결과 로그
- 참여자별 부담액/분배액 스냅샷
- 실행 tx 정보 및 재실행 방지 플래그

---

## 4) 핵심 인스트럭션 설계

## 4.1 마스터 계약
1. `create_master_policy(...)`
- 리더사가 기간형 마스터 계약 생성
- 약관(보험료/지연 tier/지분/출재/수수료) + 지갑 주소 저장

2. `register_participant_wallets(...)`
- 각 보험사가 `pool_wallet` + `deposit_wallet` 등록
- 모든 보험사는 리더사가 될 수 있으므로 등록 필수

3. `confirm_master_share(role, actor)`
- 참여사/재보험사가 각자 컨펌

4. `operator_activate_master()`
- Operator 최종 승인
- 상태를 `Active` 전환

5. `close_master_policy()`
- 기간 종료 후 정리 상태 전환

## 4.2 개별 항공 지연 보험
1. `create_flight_policy_from_master(...)`
- `MasterPolicy::Active`에서만 호출 가능
- 생성 권한: `리더사 + Operator`

2. `resolve_flight_delay(...)`
- 오라클 데이터로 지연구간 판정
- payout tier 계산

3. `settle_claim_with_master_shares(...)`
- 지급 케이스
- 각 참여사/재보험사 pool에서 부담액을 출금해 `마스터 리더사 deposit_wallet`로 자동 집금

4. `settle_no_claim_premium_distribution(...)`
- 부지급 케이스
- 보험료를 재보험사 몫/수수료까지 포함해 분배

---

## 5) 정산 로직(확정 수식)

기본 변수:
- `P`: 개별 계약 보험료
- `C`: 개별 계약 지급금
- `s_i`: 원수사 내부 지분 (리더 0.5, A 0.3, B 0.2)
- `q`: 출재율 (0.5)
- `k`: 수수료율 (0.1)
- `r_eff`: 재보험 실질 비율 = `q * (1-k)` = `0.45`
- `i_eff`: 원수사 실질 비율 = `1 - r_eff` = `0.55`

Premium 분배:
- 재보험사 수익: `P * r_eff`
- 원수사 i 수익: `P * i_eff * s_i`

Claim 부담:
- 재보험사 비용: `C * r_eff`
- 원수사 i 비용: `C * i_eff * s_i`

위 수식은 Claim 시점과 Premium 분배 시점에 동일하게 적용한다.

예시(`P=1,000,000`, `C=500,000`):
- Premium: 재보험 450,000 / 원수사 총 550,000
- Claim: 재보험 225,000 / 원수사 총 275,000
- 최종 이익:
1. 리더 137,500
2. 참여사 A 82,500
3. 참여사 B 55,000
4. 재보험 225,000

---

## 6) 상태 머신 변경

## 6.1 MasterPolicyStatus
1. Draft
2. PendingConfirm
3. Active
4. Closed
5. Cancelled

## 6.2 FlightPolicyStatus
1. Issued
2. AwaitingOracle
3. Claimable
4. Paid
5. NoClaim
6. Expired

---

## 7) 권한/보안 규칙

1. 마스터 생성/조건 수정: 리더사만 가능 (Active 이후 수정 불가)
2. 컨펌: 각 참여사/재보험사 자기 계정만 가능
3. 최종 활성화: Operator만 가능
4. Child 생성: Master Active + 호출자 `리더사 또는 Operator`
5. Claim 정산: 오라클 검증 + 중복정산 방지 플래그 필수
6. 토큰 이체: PDA authority 고정, 임의 계정 이체 금지
7. 모든 보험사 계정은 `pool_wallet`과 별도로 `deposit_wallet` 등록 필수

---

## 8) 현재 코드베이스 기준 변경 포인트

대상 프로그램: `contract/programs/open_parametric`

주요 변경:
1. `state.rs`
- `MasterPolicy + FlightPolicy` 2계층 구조 추가
- 참여사별 `pool/deposit wallet` 필드 추가
- 정산 스냅샷(분배 결과) 저장 구조 추가

2. `instructions/`
- 신규: `create_master_policy.rs`
- 신규: `register_participant_wallets.rs`
- 신규: `confirm_master.rs`
- 신규: `activate_master.rs`
- 신규: `create_flight_policy_from_master.rs`
- 신규: `resolve_flight_delay.rs`
- 신규: `settle_flight_claim.rs`
- 신규: `settle_flight_no_claim.rs`
- 기존 단건 중심 플로우 인스트럭션은 단계적 대체

3. `lib.rs`
- 신규 인스트럭션 엔트리 추가
- 기존 단건 플로우 엔트리 Deprecated 처리

4. 테스트(`contract/tests/open_parametric.ts`)
- 마스터 승인 플로우
- Child 생성 권한(리더/Operator 허용, 기타 거부)
- Claim 정산(45:55 실질 비율 반영) 검증
- No Claim 보험료 분배(재보험 몫/수수료 포함) 검증
- 중복 정산/권한 위반/잔액 부족 실패 케이스 검증

---

## 9) 구현 순서 (코드 작업)

1. 상태/에러/상수 확장
2. 마스터 계약 생성/지갑 등록/컨펌/활성화
3. Child 계약 생성 팩토리
4. Claim/NoClaim 정산 로직 + 토큰 이체
5. 회귀 테스트 + 문서 업데이트
