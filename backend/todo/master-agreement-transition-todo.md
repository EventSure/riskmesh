# Master Agreement 전환 TODO

이 문서는 backend 내부에서 `master policy` 용어를 `master agreement`로 전환하면서, 외부 계약 호환성을 위해 의도적으로 유지한 지점을 정리한다.

## 원칙

- backend 내부 타입명, 함수명, 변수명, 로그/에러 메시지는 `master agreement` 기준으로 변경했다.
- frontend, smart contract, 저장 데이터 스키마와 맞물리는 이름은 동작 보존을 위해 유지했다.
- 유지한 지점에는 소스 코드에 `TODO` 주석을 남겼다.

## TODO 목록

### Smart contract 연동

- `backend/src/oracle/program_accounts.rs`
  - Anchor account discriminator 문자열 `"MasterPolicy"` 유지
  - 이유: on-chain account 이름 `MasterPolicy`와 직접 연결됨

- `backend/src/api/client.rs`
  - `create_flight_policy_from_master` instruction의 master account 의미 유지
  - 이유: instruction account 순서와 의미가 smart contract와 공유됨

- `backend/src/oracle/track_b.rs`
  - `check_oracle_and_resolve_flight`
  - `settle_flight_claim`
  - `settle_flight_no_claim`
  - 위 세 instruction builder에서 master account 의미 유지
  - 이유: instruction account 순서와 의미가 smart contract와 공유됨

- `backend/src/solana/pda.rs`
  - PDA seed literal `b"master_policy"` 유지
  - `flight_policy` PDA의 parent seed 의미 유지
  - 이유: PDA derivation 규칙이 smart contract와 공유됨

### Frontend / API 계약

- `backend/src/api/router.rs`
  - route path `/api/master-policies/...` 유지
  - 이유: frontend가 기존 API path를 사용 중일 가능성이 높음

- `backend/src/events.rs`
  - SSE event name `master_policy_updated` 유지
  - 이유: frontend event listener와의 호환성 유지 필요

- `backend/src/api/service.rs`
  - DB test 응답 키 `master_policy_count` 유지
  - 이유: 외부 소비 응답 필드 호환성 유지

- `backend/src/api/types.rs`
  - 응답 필드 `master_policy_pubkeys` 유지
  - 응답 필드 `master_policy_pubkey` 유지
  - 이유: frontend 응답 파싱 코드와의 호환성 유지

### 저장 데이터 / 마이그레이션

- `backend/src/db.rs`
  - SQLite collection name `master_policies` 유지
  - 이유: 기존 저장 데이터와 마이그레이션 비용 고려

- `backend/src/firebase/mod.rs`
  - Firestore `kind: "master_policy"` 유지
  - Firestore field `master_policy_count` 유지
  - 이유: 기존 문서 구조와 외부 조회 코드 호환성 유지

## Smart Contract 영향 검토

이번 변경은 smart contract 동작에 영향을 주지 않도록 처리했다.

### 영향이 없다고 판단한 근거

- on-chain account 이름은 여전히 `MasterPolicy`다.
  - `contract/programs/open_parametric/src/state.rs`

- master PDA seed는 여전히 `b"master_policy"`다.
  - `contract/programs/open_parametric/src/instructions/create_master_policy.rs`

- flight PDA seed는 여전히 `master_policy.key()`를 부모로 사용한다.
  - `contract/programs/open_parametric/src/instructions/create_flight_policy_from_master.rs`

- backend는 contract instruction discriminator를 변경하지 않았다.
  - `create_flight_policy_from_master`
  - `check_oracle_and_resolve_flight`
  - `settle_flight_claim`
  - `settle_flight_no_claim`

- backend의 account parsing도 contract account 이름에 맞춰 `"MasterPolicy"` discriminator를 그대로 사용한다.

### 이번에 실제로 바뀐 것

- backend 내부 타입명
- backend 내부 함수명
- backend 내부 변수명
- backend 내부 로그/에러 메시지

### 이번에 바꾸지 않은 것

- on-chain account 이름
- PDA seed literal
- instruction discriminator
- instruction account ordering / meaning

## 후속 작업 제안

### frontend 작업 시

- `/api/master-policies` 계열 route를 `/api/master-agreements`로 바꿀지 결정
- 응답 필드 `master_policy_pubkey`, `master_policy_pubkeys`, `master_policy_count` rename 여부 결정
- SSE event name `master_policy_updated` rename 여부 결정

### data migration 작업 시

- SQLite collection `master_policies` rename 여부 결정
- Firestore `kind=master_policy` 및 `master_policy_count` 필드 migration 여부 결정

### smart contract 작업 시

- `MasterPolicy` account 명칭 자체를 `MasterAgreement`로 변경할지 결정
- PDA seed `b"master_policy"` 변경 여부 결정
- instruction account name 변경 여부 결정
- 위 변경 시 backend, frontend, migration을 한 번에 맞춰야 함
