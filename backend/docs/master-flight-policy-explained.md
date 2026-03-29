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



### 관계를 더 정확히 보면

`MasterPolicy`와 `FlightPolicy`는 단순히 "부모/자식"이라고만 보면 중요한 차이를 놓치기 쉽습니다.

둘의 관계는 아래처럼 이해하는 것이 더 정확합니다.

- `MasterPolicy`는 상품 규칙의 원본(source of truth)이다.
- `FlightPolicy`는 그 상품 위에서 생성된 가입 실행 레코드다.
- `FlightPolicy`는 `master` 필드로 상위 `MasterPolicy` 주소를 저장한다.
- 하지만 `MasterPolicy` 안에는 하위 `FlightPolicy` 목록이 직접 들어 있지 않다.

즉 온체인에서는:

- 상위에서 하위를 직접 배열로 들고 있는 구조가 아니라
- 각 하위 계정이 상위 계정 주소를 참조하는 구조입니다.

그래서 백엔드나 인덱서가 관계를 복원할 때는 보통:

1. `MasterPolicy` 계정을 모은다.
2. `FlightPolicy` 계정을 모은다.
3. 각 `FlightPolicy.master` 값으로 어느 `MasterPolicy`에 속하는지 매칭한다.

라는 방식으로 조인합니다.

### 무엇이 `MasterPolicy`에 있고, 무엇이 `FlightPolicy`에 있나

이 관계를 이해할 때 가장 중요한 기준은 "어떤 정보가 상품 공통값이고, 어떤 정보가 가입 건별 상태인가"입니다.

`MasterPolicy`가 들고 있는 것:

- 보장 가능 기간 (`coverage_start_ts`, `coverage_end_ts`)
- 건당 보험료 (`premium_per_policy`)
- 지연 시간 구간별 지급 테이블 (`payout_delay_*`)
- 참여사 비율, 재보험 비율, 확인 여부
- 운영 권한 주체 (`leader`, `operator`)
- 보험료/정산 관련 지갑 정보

`FlightPolicy`가 들고 있는 것:

- 어느 마스터에 속하는지 (`master`)
- 누가 생성했는지 (`creator`)
- 누구 가입 건인지 (`subscriber_ref`)
- 어떤 항공편인지 (`flight_no`, `route`, `departure_ts`)
- 실제 납부 보험료 (`premium_paid`)
- 실제 지연/결항 결과 (`delay_minutes`, `cancelled`)
- 최종 지급 결과 (`payout_amount`, `status`)

즉 `MasterPolicy`는 "규칙", `FlightPolicy`는 "사건별 결과"에 가깝습니다.

### 생성 시 복사되는 값과 나중에 참조되는 값

코드를 보면 `create_flight_policy_from_master`에서 하위 가입 건을 만들 때 일부 값은 복사되고, 일부 값은 나중까지 상위 정책을 참조합니다.

생성 시 `FlightPolicy`에 스냅샷처럼 들어가는 값:

- `master = master_policy.key()`
- `premium_paid = master.premium_per_policy`
- 생성 시각의 가입 대상 정보 (`subscriber_ref`, `flight_no`, `route`, `departure_ts`)
- 초기 상태값 (`AwaitingOracle`, `delay_minutes = 0`, `payout_amount = 0`)

반대로 나중 오라클 처리 시점에도 `MasterPolicy`를 다시 참조하는 값:

- 지연 구간별 지급 기준 (`payout_delay_2h`, `payout_delay_3h`, `payout_delay_4to5h`, `payout_delay_6h_or_cancelled`)
- 처리 권한자 (`leader`, `operator`)
- 마스터 활성 상태 (`MasterPolicy.status`)

이 말은 곧:

- `FlightPolicy`만 읽으면 "이 가입 건이 어느 상품에서 왔는지"는 알 수 있지만
- "지급 계산 규칙 전체"는 `MasterPolicy`를 같이 봐야 완전히 이해할 수 있다는 뜻입니다.

### `Policy`와 `MasterPolicy`는 계층 관계가 아니다

가장 많이 헷갈리는 부분은 `Policy -> MasterPolicy -> FlightPolicy`처럼 3단계 상속 구조로 보는 경우입니다.

하지만 실제 코드는 그렇게 동작하지 않습니다.

- `Policy`는 독립형 보험 계약 플로우의 중심 계정
- `MasterPolicy`는 재설계된 상품형 플로우의 중심 계정
- `FlightPolicy`는 그 상품형 플로우의 하위 가입 계정

즉 관계를 도식으로 그리면:

```text
기존 모델:
Policy
├─ Underwriting
├─ RiskPool
├─ Claim
└─ PolicyholderRegistry

재설계 모델:
MasterPolicy
└─ FlightPolicy ...
```

이 두 모델은 "동일한 문제를 다른 방식으로 푼 두 계정군"에 더 가깝고, `Policy`가 `MasterPolicy`의 상위 개념은 아닙니다.

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

중요한 점은 현재 API가 온체인 join 결과를 미리 만들어 주지는 않는다는 것입니다.

- `/api/master-policies`는 `MasterPolicy` 목록만 반환
- `/api/flight-policies`는 `FlightPolicy` 목록만 반환

따라서 화면이나 운영 도구에서 "이 비행 가입 건이 어느 상품에 속하는가"를 보여주려면 `FlightPolicy.master`와 `MasterPolicy.pubkey`를 기준으로 애플리케이션 레벨에서 연결해야 합니다.

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

### `FlightPolicy`의 지급액은 단독으로 결정되지 않는다

`FlightPolicy`에는 최종 결과로서 `payout_amount`가 저장되지만, 그 값을 계산하는 기준표 자체는 `MasterPolicy`에 있습니다.

즉 처리 흐름은:

1. `FlightPolicy`가 어떤 `MasterPolicy`에 속하는지 확인하고
2. 오라클이 `delay_minutes`, `cancelled`를 확정한 뒤
3. `MasterPolicy`의 `payout_delay_*` 테이블을 읽어
4. 그 결과를 `FlightPolicy.payout_amount`에 기록합니다.

그래서 `FlightPolicy`는 "결과 보관소"이고, `MasterPolicy`는 "계산 규칙 보관소"라고 생각하면 이해가 쉽습니다.

운영 화면에서 payout을 설명하려면 보통 두 계정을 함께 보여주는 편이 맞습니다.

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

## 10. 실제 응답으로 보는 구성 예시

실제 API 응답을 보면 현재 데이터는 아래처럼 읽을 수 있습니다.

- `MasterPolicy`는 3개
- `FlightPolicy`는 9개
- 연결 기준은 `FlightPolicy.master = MasterPolicy.pubkey`

즉 `master_id`가 아니라 `pubkey` 기준으로 묶어야 합니다.

### 현재 응답을 묶으면 이렇게 된다

```text
MasterPolicy GRtxaowgJyeBvx4KGSbeE43ATqKPJxhrYXBPh3tJRFVR
└─ 현재 응답에 연결된 FlightPolicy 없음

MasterPolicy BEKMNWKeaZLMEoE6oDM5AVxiQBpTkMyJjCL2UnJFEt4X
├─ FlightPolicy GPxXjMtfhkXUfaULLxHWHCvoRFPW69ArX9f1Bt8gZ4Jj
│  └─ child_policy_id=1, KE017, AwaitingOracle
├─ FlightPolicy B9WuvAAzTP55HqE4zh7m9xbq4iVRMxyBbBTtULi3xSpk
│  └─ child_policy_id=2, ET3712, Paid, payout=3000000
└─ FlightPolicy CRX4Lsffy3VpSBrX4YaAQcLhHkU7Q8xBBpB7eWntu5sa
   └─ child_policy_id=3, AK3181, Expired

MasterPolicy BMVgoyWDU5StUMUHGt54353VeXFmdP2Co7CmrMPyX5k2
├─ FlightPolicy AEDw1zmsy4HBFiPVLhqwvHE8HJ5DtQYm2EDP4BdqozT3
│  └─ child_policy_id=1, KE017, Paid, payout=2000000
├─ FlightPolicy AzHCYmDoNhWSbrGTKbkaTFRKjDTZ1jiDAMkjmav9LXk8
│  └─ child_policy_id=2, KE017, Claimable, payout=2000000
├─ FlightPolicy DMENywvZcz5Qs3vYyKyTHjdAbkphqKHx3qbjUHyAHMCb
│  └─ child_policy_id=3, KE081, NoClaim
├─ FlightPolicy 6X6N3SH3atJ7KB6efre2cipKqMo44bUkhB3fmN8vLy8U
│  └─ child_policy_id=4, KE081, AwaitingOracle
├─ FlightPolicy 2pwvuFXqBABeJmn1B5iKQdjyUSfBS3v5vQrPviwP5M8t
│  └─ child_policy_id=5, KE081, AwaitingOracle
└─ FlightPolicy CocRPGQZxUbqgQpWkfxAyMBbnFthoke4xhvezdFqeKXW
   └─ child_policy_id=6, KE081, AwaitingOracle
```

이 예시를 보면:

- 첫 번째 마스터 정책 `GRtx...` 는 상품은 존재하지만 아직 이 응답 기준으로 연결된 가입 건이 없습니다.
- 두 번째 마스터 정책 `BEKM...` 아래에는 3개의 가입 건이 있습니다.
- 세 번째 마스터 정책 `BMVg...` 아래에는 6개의 가입 건이 있습니다.

즉 현재 운영 데이터는 "상품 3개 중 2개 상품에 실제 가입 건이 매달린 상태"로 이해할 수 있습니다.

### 왜 `master_id`가 아니라 `pubkey`로 묶어야 하나

실제 응답에서:

- `BEKM...` 의 `master_id = 1`
- `BMVg...` 의 `master_id = 1`

처럼 같은 숫자가 두 번 나옵니다.

즉 `master_id`는 전역 유일값이라고 가정하면 안 되고, 실제 관계 복원은 반드시:

- `FlightPolicy.master`
- `MasterPolicy.pubkey`

를 기준으로 해야 합니다.

같은 이유로 `child_policy_id`도 마스터별 로컬 번호처럼 봐야 합니다.

예를 들어:

- `BEKM...` 아래 `child_policy_id = 1`
- `BMVg...` 아래 `child_policy_id = 1`

이 동시에 존재할 수 있습니다.

### 같은 상품 아래 같은 항공편 가입이 여러 건 생길 수 있다

응답을 보면 `BMVg...` 아래에 `KE081` 가입 건이 여러 개 있습니다.

즉 하나의 `MasterPolicy`는:

- 여러 가입자를 받을 수 있고
- 같은 항공편에 대해서도 여러 `FlightPolicy`를 만들 수 있습니다.

그래서 `MasterPolicy`는 "항공편 한 개"가 아니라 "상품 규칙 묶음"으로 보는 편이 맞습니다.

### 지급액도 마스터 정책 규칙으로 설명할 수 있다

실제 응답값을 보면 `FlightPolicy.payout_amount`는 개별 계정에 저장되지만, 그 값은 `MasterPolicy`의 지급표와 연결해서 해석할 수 있습니다.

예를 들어:

- `BEKM...` 의 `payout_delay_3h = 3000000`
- 그 아래 `ET3712` 가입 건은 `delay_minutes = 190`, `payout_amount = 3000000`

즉 3시간대 지급 규칙이 실제 하위 가입 건에 반영된 사례로 읽을 수 있습니다.

또 다른 예:

- `BMVg...` 의 `payout_delay_2h = 2000000`
- 그 아래 `KE017` 가입 건 중 하나는 `delay_minutes = 120`, `payout_amount = 2000000`

즉 하위 `FlightPolicy`의 결과는 상위 `MasterPolicy`의 지급 테이블을 읽어 계산된 결과라고 이해하면 됩니다.

### 이 응답이 보여주는 구조를 한 줄로 정리하면

현재 API 응답은:

- `MasterPolicy`가 상품 단위로 존재하고
- 각 `FlightPolicy`가 그 상품의 실제 가입 건으로 매달리며
- 운영 화면에서는 `FlightPolicy.master -> MasterPolicy.pubkey`로 연결해 보여줘야 한다

는 점을 잘 보여줍니다.

## 11. 요약

- `Policy`는 단독형 정책 모델
- `MasterPolicy`는 상위 보험 상품 정의
- `FlightPolicy`는 실제 항공편 가입 건
- 하나의 `MasterPolicy` 아래 여러 `FlightPolicy`가 연결된다
- 백엔드는 `PROGRAM_ID` 아래 계정을 읽고 discriminator로 둘을 구분한다
- API로 각각 따로 조회할 수 있다

짧게 한 줄로 정리하면:

> `Policy`는 기존 단일 정책이고, `MasterPolicy`는 상품의 뼈대이며, `FlightPolicy`는 그 상품으로 생성된 실제 가입/처리 기록이다.
