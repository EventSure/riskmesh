# Policy / MasterPolicy / FlightPolicy 구조 설명

이 문서는 RiskMesh의 `Policy`, `MasterPolicy`, `FlightPolicy`가 각각 무엇인지, 서로 어떤 관계인지, 그리고 백엔드에서 어떻게 조회하는지를 설명합니다.

관련 코드:

- [state.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/state.rs)
- [program_accounts.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/oracle/program_accounts.rs)
- [web.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/web.rs)

## 한눈에 보기

- `Policy`: 단독형 보험 계약 계정
- `MasterPolicy`: 보험 상품의 큰 틀
- `FlightPolicy`: 개별 항공편 가입 건

쉽게 말하면:

- `Policy`는 "단독형 정책 모델"
- `MasterPolicy`는 "보험 상품 템플릿"
- `FlightPolicy`는 "그 상품으로 만든 실제 가입 1건"

즉 모델이 두 갈래로 존재합니다.

- `Policy` 중심의 단일 정책 모델
- `MasterPolicy -> FlightPolicy` 중심의 상위/하위 모델

현재 devnet에서 우리가 실제로 확인한 데이터는 두 번째 모델, 즉 `MasterPolicy`와 `FlightPolicy` 중심입니다.

## 1. Policy란?

`Policy`는 RiskMesh의 단독형 정책 계정입니다.

이 구조에서는 보험 한 건을 `Policy` 하나로 표현하고, 여기에 연결된 보조 계정들이 함께 동작합니다.

- `Underwriting`
- `RiskPool`
- `Claim`
- `PolicyholderRegistry`

온체인 구조는 [state.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/state.rs#L96)에 정의되어 있습니다.

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
    pub bump: u8,
}
```

### 주요 필드

- `policy_id`: 정책 번호
- `leader`: 정책 소유/운영 리더
- `route`, `flight_no`, `departure_date`: 항공편 정보
- `delay_threshold_min`: 지연 인정 기준
- `payout_amount`: 조건 충족 시 지급 금액
- `currency_mint`: 사용 토큰 mint
- `oracle_feed`: 연결된 오라클 feed
- `state`: 현재 정책 상태
- `underwriting`, `pool`: 관련 계정 주소
- `active_from`, `active_to`: 보장 활성 구간

### 상태값

`Policy`는 보통 아래 상태값을 사용합니다.

- `0 = Draft`
- `1 = Open`
- `2 = Funded`
- `3 = Active`
- `4 = Claimable`
- `5 = Approved`
- `6 = Settled`
- `7 = Expired`

이 모델에서는 `Claim`도 별도 계정으로 존재합니다. 즉 청구 결과를 `Policy` 안에 직접 다 담기보다, 별도 claim 계정을 만들어 연결하는 구조입니다.

## 2. MasterPolicy란?

`MasterPolicy`는 여러 개별 가입 건이 공통으로 따르는 상위 정책입니다.

예를 들면:

- 보장 기간
- 보험료
- 지연 시간별 지급액
- 참여 보험사 비율

같은 "상품 레벨 설정"이 들어 있습니다.

온체인 구조는 [state.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/state.rs#L232)에 정의되어 있습니다.

```rust
pub struct MasterPolicy {
    pub master_id: u64,
    pub leader: Pubkey,
    pub operator: Pubkey,
    pub currency_mint: Pubkey,
    pub coverage_start_ts: i64,
    pub coverage_end_ts: i64,
    pub premium_per_policy: u64,
    pub payout_delay_2h: u64,
    pub payout_delay_3h: u64,
    pub payout_delay_4to5h: u64,
    pub payout_delay_6h_or_cancelled: u64,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub reinsurer_effective_bps: u16,
    pub reinsurer: Pubkey,
    pub reinsurer_confirmed: bool,
    pub reinsurer_pool_wallet: Pubkey,
    pub reinsurer_deposit_wallet: Pubkey,
    pub leader_deposit_wallet: Pubkey,
    pub participants: Vec<MasterParticipant>,
    pub status: u8,
    pub created_at: i64,
    pub bump: u8,
}
```

### 주요 필드

- `master_id`: 마스터 정책 번호
- `leader`: 이 정책을 관리하는 리더 공개키
- `operator`: 생성/운영 주체 공개키
- `currency_mint`: 보험료와 지급금에 쓰는 토큰 mint
- `coverage_start_ts`, `coverage_end_ts`: 상품 보장 시작/종료 시각
- `premium_per_policy`: 하위 `FlightPolicy` 1건당 보험료
- `payout_delay_*`: 지연 시간대별 지급 금액
- `participants`: 참여 보험사 목록과 분담 비율
- `status`: 마스터 정책 상태

### 상태값

`MasterPolicyStatus`는 다음과 같습니다.

- `0 = Draft`
- `1 = PendingConfirm`
- `2 = Active`
- `3 = Closed`
- `4 = Cancelled`

백엔드 API에서는 이 숫자를 사람이 읽기 쉽게 `status_label`로도 같이 내려줍니다.

## 3. FlightPolicy란?

`FlightPolicy`는 실제 개별 가입 건입니다.

예를 들어:

- 고객 A가 `KE017` 항공편에 가입
- 고객 B가 같은 `KE017`에 가입
- 고객 C가 `KE081`에 가입

이 각각이 별도의 `FlightPolicy`가 됩니다.

온체인 구조는 [state.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/state.rs#L259)에 정의되어 있습니다.

```rust
pub struct FlightPolicy {
    pub child_policy_id: u64,
    pub master: Pubkey,
    pub creator: Pubkey,
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
    pub premium_paid: u64,
    pub delay_minutes: u16,
    pub cancelled: bool,
    pub payout_amount: u64,
    pub status: u8,
    pub premium_distributed: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}
```

### 주요 필드

- `child_policy_id`: 하위 가입 건 번호
- `master`: 어떤 `MasterPolicy`에 속하는지 가리키는 주소
- `creator`: 생성자 공개키
- `subscriber_ref`: 가입자 식별 문자열
- `flight_no`: 항공편 번호
- `route`: 노선
- `departure_ts`: 출발 시각
- `premium_paid`: 납부 보험료
- `delay_minutes`: 실제 확인된 지연 시간
- `cancelled`: 결항 여부
- `payout_amount`: 최종 지급 금액
- `status`: 개별 가입 건 상태
- `premium_distributed`: 프리미엄 분배 완료 여부

### 상태값

`FlightPolicyStatus`는 다음과 같습니다.

- `0 = Issued`
- `1 = AwaitingOracle`
- `2 = Claimable`
- `3 = Paid`
- `4 = NoClaim`
- `5 = Expired`

백엔드 API는 이 값도 `status_label`로 함께 보여줍니다.

## 4. 세 타입의 관계

처음 보면 `Policy`와 `MasterPolicy`/`FlightPolicy`가 비슷해 보여서 헷갈리기 쉽습니다.

이 셋의 관계는 이렇게 이해하면 됩니다.

- `Policy`: 기존 단일 정책 모델
- `MasterPolicy`: 재설계된 상위 상품 모델
- `FlightPolicy`: 재설계된 하위 가입 건 모델

즉 `Policy`는 `MasterPolicy`의 부모가 아닙니다.  
온체인 코드 기준으로 보면 `Policy`와 `MasterPolicy/FlightPolicy`는 서로 다른 플로우를 이루는 별도 계정군에 가깝습니다.

비유하면:

- `Policy` = 단독형 "계약서 1장"
- `MasterPolicy` = 상품 원본
- `FlightPolicy` = 상품 원본으로부터 파생된 개별 가입 건

### `MasterPolicy`와 `FlightPolicy`의 관계

핵심 관계는 `1:N`입니다.

- 하나의 `MasterPolicy`
- 여러 개의 `FlightPolicy`

`FlightPolicy.master` 필드가 상위 `MasterPolicy`의 주소를 가리킵니다.

예시:

```text
MasterPolicy A
├─ FlightPolicy 1: KE017
├─ FlightPolicy 2: KE017
└─ FlightPolicy 3: ET3712

MasterPolicy B
├─ FlightPolicy 1: KE081
└─ FlightPolicy 2: AK3181
```

즉 `MasterPolicy`는 공통 조건을 들고 있고, `FlightPolicy`는 실제 가입 건과 처리 결과를 들고 있습니다.

### `Policy`와의 차이

`Policy` 모델에서는 보통:

- 한 정책이 하나의 독립된 보험 계약이고
- `Underwriting`, `RiskPool`, `Claim`이 주변에 붙습니다.

`MasterPolicy/FlightPolicy` 모델에서는:

- `MasterPolicy`가 공통 상품 조건을 들고
- 여러 `FlightPolicy`가 그 아래에 매달립니다.

즉 차이를 짧게 쓰면:

- `Policy` = 독립형 단일 정책
- `MasterPolicy + FlightPolicy` = 상위 상품 + 하위 가입 건

## 5. 실제 데이터 흐름

보통 흐름은 이렇습니다.

### 기존 `Policy` 흐름

1. `Policy`를 생성한다.
2. `Underwriting`, `RiskPool` 등을 연결한다.
3. 정책을 `Active`로 만든다.
4. 오라클 결과에 따라 `Claim` 계정을 생성하거나 상태를 변경한다.
5. 승인/정산/만료 단계로 진행한다.

### `MasterPolicy / FlightPolicy` 흐름

1. `MasterPolicy`를 생성한다.
2. 참여자 지갑 등록과 확인을 거친다.
3. `activate_master`로 `Active` 상태를 만든다.
4. 그 `MasterPolicy`를 기준으로 여러 `FlightPolicy`를 만든다.
5. 오라클이 항공편 지연/결항을 확인한다.
6. `FlightPolicy.delay_minutes`, `cancelled`, `payout_amount`, `status`가 갱신된다.
7. 최종적으로 `Paid`, `NoClaim`, `Expired` 같은 종료 상태가 된다.

즉:

- 단일 계약 모델은 `Policy`
- 재설계 모델은 `MasterPolicy` + `FlightPolicy`

로 나뉩니다.

## 6. 지금 devnet에서 보이는 것은 무엇인가

중요한 점은:

- `Policy` 타입은 코드에 존재합니다.
- 하지만 현재 우리가 확인한 devnet의 `PROGRAM_ID` 아래에서는 `Policy` 계정이 보이지 않았습니다.
- 대신 `MasterPolicy`와 `FlightPolicy`가 실제로 존재했습니다.

즉:

- "컨트랙트에 `Policy`가 정의돼 있다"와
- "현재 배포 환경에 `Policy` 계정이 실제로 있다"

는 다른 이야기입니다.

현재 devnet에서는 사실상 `MasterPolicy / FlightPolicy` 중심 데이터가 올라가 있다고 보는 것이 맞습니다.

다만 이것이 `Policy`가 제거되었다는 뜻은 아닙니다.

- `Policy` 관련 인스트럭션도 프로그램에 존재합니다.
- `MasterPolicy / FlightPolicy` 관련 인스트럭션도 함께 존재합니다.

즉 현재 프로그램은 두 플로우를 동시에 포함하고 있고, 특정 배포 환경에서 실제로 어떤 계정이 생성되었는지가 조회 결과를 결정합니다.

## 7. 백엔드에서 어떻게 읽는가

백엔드는 [program_accounts.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/oracle/program_accounts.rs)에서 `getProgramAccounts(program_id)`를 호출한 뒤, account discriminator로 타입을 구분합니다.

구분 방식:

- `MasterPolicy` discriminator와 일치하면 `parse_master_policy`
- `FlightPolicy` discriminator와 일치하면 `parse_flight_policy`

현재 문서 시점의 API는 `Policy` 조회까지는 노출하지 않고, 실제 devnet에 존재하는 `MasterPolicy`와 `FlightPolicy`를 우선 조회합니다.

즉 한 `PROGRAM_ID` 아래에 섞여 있는 계정들 중에서:

- `MasterPolicy`만 따로 뽑고
- `FlightPolicy`만 따로 뽑아

JSON으로 반환합니다.

## 8. API 엔드포인트

현재 백엔드는 아래 엔드포인트를 제공합니다.

- `GET /api/master-policies`
- `GET /api/flight-policies`

관련 코드는 [web.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/web.rs)에 있습니다.

### `GET /api/master-policies`

응답 예시:

```json
{
  "program_id": "BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7",
  "count": 3,
  "master_policies": [
    {
      "pubkey": "GRtx...",
      "master_id": 1774024059499,
      "leader": "DojL...",
      "premium_per_policy": 3000000,
      "status": 2,
      "status_label": "Active"
    }
  ]
}
```

### `GET /api/flight-policies`

응답 예시:

```json
{
  "program_id": "BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7",
  "count": 9,
  "flight_policies": [
    {
      "pubkey": "B9Wu...",
      "master": "BEKM...",
      "flight_no": "ET3712",
      "delay_minutes": 190,
      "payout_amount": 3000000,
      "status": 3,
      "status_label": "Paid"
    }
  ]
}
```

## 9. 읽을 때 헷갈리기 쉬운 점

### `master_id`와 `child_policy_id`는 전역 유일값이 아닐 수 있다

PDA가 보통 상위 키와 함께 계산되기 때문에:

- 다른 `leader`
- 다른 `master`

아래에서는 같은 숫자 ID가 다시 나올 수 있습니다.

즉 숫자 ID만 보고 전역에서 하나라고 가정하면 안 됩니다.

### `FlightPolicy`의 상태가 실무적으로 더 중요할 때가 많다

운영 관점에서는 보통 `FlightPolicy.status`가 더 직접적인 의미를 가집니다.

예:

- `AwaitingOracle`: 아직 오라클 처리 전
- `Claimable`: 청구 가능
- `Paid`: 지급 완료
- `NoClaim`: 지급 없음
- `Expired`: 만료

반면 `MasterPolicy`는 상품의 틀과 참여 구조를 설명하는 역할이 더 큽니다.

참고로 컨트랙트의 `create_flight_policy_from_master`를 보면 새 `FlightPolicy`는 생성 직후 `AwaitingOracle`로 시작합니다.

- `delay_minutes = 0`
- `cancelled = false`
- `payout_amount = 0`
- `status = AwaitingOracle`

그 뒤 `resolve_flight_delay`가 호출되면:

- 지급 대상이면 `Claimable`
- 지급 대상이 아니면 `NoClaim`

으로 바뀌고, 이후 정산 함수에서 `Paid` 또는 `Expired`까지 진행됩니다.

### `Policy`가 없어 보인다고 해서 타입이 삭제된 것은 아니다

`Policy`는 여전히 컨트랙트에 정의되어 있습니다.

다만 현재 특정 devnet `PROGRAM_ID`에 대해:

- 실제 계정이 없거나
- 아직 생성되지 않았거나
- 운영 흐름이 `MasterPolicy / FlightPolicy` 위주로 바뀌어

조회 결과에 안 보일 수 있습니다.

### `MasterPolicy`는 생성 직후 바로 Active가 아니다

컨트랙트의 `create_master_policy`를 보면 생성 직후 상태는 `PendingConfirm`입니다.

그 다음에:

1. 참여자 지갑 등록
2. 참여자/재보험사 확인
3. `activate_master`

를 거쳐야 `Active`가 됩니다.

## 10. 요약

- `Policy`는 단독형 정책 모델
- `MasterPolicy`는 상위 보험 상품 정의
- `FlightPolicy`는 실제 항공편 가입 건
- 하나의 `MasterPolicy` 아래 여러 `FlightPolicy`가 연결된다
- 백엔드는 `PROGRAM_ID` 아래 계정을 읽고 discriminator로 둘을 구분한다
- API로 각각 따로 조회할 수 있다

짧게 한 줄로 정리하면:

> `Policy`는 기존 단일 정책이고, `MasterPolicy`는 상품의 뼈대이며, `FlightPolicy`는 그 상품으로 생성된 실제 가입/처리 기록이다.
