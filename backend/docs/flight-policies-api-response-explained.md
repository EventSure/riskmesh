# `/api/flight-policies` 응답 키 설명

이 문서는 백엔드의 `GET /api/flight-policies` 응답 JSON에서 각 key가 무엇을 의미하는지 설명합니다.

관련 코드:

- [web.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/web.rs)
- [program_accounts.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/oracle/program_accounts.rs)
- [state.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/state.rs)

## 1. 응답 구조 한눈에 보기

`/api/flight-policies`는 크게 두 부분으로 나뉩니다.

- 최상위 메타 정보
- `flight_policies` 배열 안의 개별 `FlightPolicy`

예시:

```json
{
  "program_id": "BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7",
  "count": 9,
  "flight_policies": [
    {
      "pubkey": "B9WuvAAzTP55HqE4zh7m9xbq4iVRMxyBbBTtULi3xSpk",
      "child_policy_id": 2,
      "master": "BEKMNWKeaZLMEoE6oDM5AVxiQBpTkMyJjCL2UnJFEt4X",
      "creator": "GNPnwyRCCvo8wLEPwJEmzEjrqyhSXeyXvTbYibieHpYM",
      "subscriber_ref": "DEMO-002",
      "flight_no": "ET3712",
      "route": "ADD-NBO",
      "departure_ts": 1773561691,
      "premium_paid": 1000000,
      "delay_minutes": 190,
      "cancelled": false,
      "payout_amount": 3000000,
      "status": 3,
      "status_label": "Paid",
      "premium_distributed": false,
      "created_at": 1773568892,
      "updated_at": 1773568917,
      "bump": 250
    }
  ]
}
```

## 2. 최상위 key 의미

### `program_id`

조회 대상이 된 Solana 프로그램 ID입니다.

- 어떤 온체인 프로그램에서 계정을 읽었는지 나타냅니다.
- 현재 응답 전체가 어느 프로그램 기준인지 보여주는 메타 정보입니다.

### `count`

응답에 포함된 `FlightPolicy` 개수입니다.

- 보통 `flight_policies.length`와 같은 의미입니다.
- 화면이나 운영 도구에서 전체 건수를 표시할 때 바로 사용할 수 있습니다.

### `flight_policies`

개별 `FlightPolicy` 목록입니다.

- 배열의 각 원소가 가입 건 1개를 뜻합니다.
- 실제 운영 데이터는 이 배열을 순회하면서 읽게 됩니다.

## 3. `flight_policies[]` 안의 key 의미

### `pubkey`

이 `FlightPolicy` 계정 자체의 Solana 주소입니다.

- 온체인에서 이 가입 건을 유일하게 식별하는 계정 주소입니다.
- 운영 화면에서 상세 조회 링크의 기준 키로 쓰기 좋습니다.

### `child_policy_id`

해당 `MasterPolicy` 아래에서의 하위 가입 번호입니다.

- 전역 고유값이라고 보기보다 마스터별 로컬 번호로 이해하는 편이 안전합니다.
- 서로 다른 `MasterPolicy` 아래에서 같은 숫자가 반복될 수 있습니다.

### `master`

이 가입 건이 속한 상위 `MasterPolicy`의 주소입니다.

- `FlightPolicy -> MasterPolicy` 관계를 연결하는 핵심 필드입니다.
- 화면에서는 이 값을 `MasterPolicy.pubkey`와 매칭해서 조인합니다.

### `creator`

이 가입 건을 생성한 지갑 주소입니다.

- 보통 `leader` 또는 `operator` 권한 주체가 됩니다.
- 누가 이 가입 건 생성 트랜잭션을 보냈는지 확인할 때 유용합니다.

### `subscriber_ref`

가입자를 식별하기 위한 오프체인 참조 문자열입니다.

- 고객명, 회원번호, 주문번호, 외부 시스템 ref 등이 들어갈 수 있습니다.
- 온체인 전용 ID라기보다 외부 비즈니스 식별자에 가깝습니다.

### `flight_no`

항공편 번호입니다.

- 예: `KE017`, `ET3712`
- 가입 건이 어떤 항공편을 대상으로 하는지 보여줍니다.

### `route`

노선 정보입니다.

- 예: `ICN-NRT`, `ADD-NBO`, `ICN→JFK`
- 항공편 번호와 함께 사람이 읽기 쉬운 비즈니스 정보입니다.

### `departure_ts`

출발 예정 시각의 Unix timestamp입니다.

- 초 단위 정수값입니다.
- 프론트나 운영 툴에서는 사람이 읽을 수 있는 날짜/시간으로 변환해서 표시하는 편이 일반적입니다.

### `premium_paid`

실제로 납부된 보험료입니다.

- 일반적으로 `MasterPolicy.premium_per_policy`에서 온 값입니다.
- 개별 가입 건 단위의 실제 납부값을 나타냅니다.

### `delay_minutes`

확정된 지연 시간입니다.

- 단위는 분(minutes)입니다.
- 오라클 처리 이후 지급 여부 계산에 사용됩니다.

### `cancelled`

결항 여부입니다.

- `true`면 결항으로 처리된 상태입니다.
- 지연뿐 아니라 결항도 지급 계산에 영향을 줄 수 있습니다.

### `payout_amount`

최종 지급액입니다.

- 실제 계산 결과가 저장된 값입니다.
- 계산 기준표 자체는 `MasterPolicy`의 `payout_delay_*` 값에 있습니다.

### `status`

개별 `FlightPolicy` 상태를 숫자로 표현한 값입니다.

- 프로그램 내부 enum을 숫자로 내려준 값입니다.
- 보통 사람이 읽기 쉽게 `status_label`과 함께 사용합니다.

### `status_label`

`status`를 문자열로 풀어쓴 값입니다.

- UI나 운영 화면에서는 보통 이 값을 직접 표시하면 됩니다.
- 숫자 상태값을 빠르게 해석하는 데 도움이 됩니다.

### `premium_distributed`

보험료 분배가 완료됐는지 여부입니다.

- `true`면 보험료 정산/분배 처리까지 끝난 상태로 볼 수 있습니다.
- `false`면 아직 분배가 안 됐거나 해당 흐름이 진행 전일 수 있습니다.

### `created_at`

이 `FlightPolicy`가 생성된 시각의 Unix timestamp입니다.

- 초 단위 정수값입니다.
- 가입 건 생성 시점을 확인할 때 씁니다.

### `updated_at`

이 `FlightPolicy`가 마지막으로 갱신된 시각의 Unix timestamp입니다.

- 상태 변경, 오라클 반영, 지급 처리 등으로 값이 바뀔 수 있습니다.
- 운영 중 최근 변경 여부를 보는 데 유용합니다.

### `bump`

PDA 생성에 사용된 bump seed 값입니다.

- Solana PDA 주소 계산을 위한 내부 기술 값입니다.
- 일반 운영 화면에서는 잘 쓰지 않지만, 디버깅이나 온체인 검증 시 유용할 수 있습니다.

## 4. 상태값 의미

현재 `FlightPolicyStatus`는 아래처럼 읽을 수 있습니다.

- `0 = Issued`
- `1 = AwaitingOracle`
- `2 = Claimable`
- `3 = Paid`
- `4 = NoClaim`
- `5 = Expired`

실제 해석은 대체로 아래와 같습니다.

- `Issued`: 발급 직후 초기 상태
- `AwaitingOracle`: 오라클 결과 대기 중
- `Claimable`: 지급 가능 상태
- `Paid`: 지급 완료
- `NoClaim`: 지급 대상 아님
- `Expired`: 만료됨

## 5. 이 응답을 실무에서 어떻게 읽으면 되나

이 응답은 한마디로 말하면:

"각 가입 건이 어느 마스터 상품에 속해 있고, 어떤 항공편을 대상으로 하며, 현재 보상 처리 상태가 무엇인지"를 보여주는 데이터입니다.

실무에서는 보통 아래 순서로 읽습니다.

1. `master`로 어느 `MasterPolicy` 소속인지 확인
2. `flight_no`, `route`, `departure_ts`로 대상 항공편 확인
3. `subscriber_ref`로 가입자/외부 시스템 ref 확인
4. `status_label`, `delay_minutes`, `cancelled`, `payout_amount`로 현재 처리 결과 확인
5. 필요하면 `created_at`, `updated_at`, `premium_distributed`로 운영 상태 추가 점검

## 6. 주의할 점

- `child_policy_id`는 전역 유일값이라고 가정하면 안 됩니다.
- `master`와 `MasterPolicy.pubkey`를 기준으로 관계를 복원해야 합니다.
- `payout_amount`는 결과값이고, 계산 규칙 자체는 `MasterPolicy`를 같이 봐야 완전히 이해됩니다.
- `departure_ts`, `created_at`, `updated_at`는 모두 Unix timestamp이므로 화면 표시 전 변환이 필요합니다.
