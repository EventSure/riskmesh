# Open Parametric 리더사 가입 연동 계획

이 문서는 현재 `open_parametric` 컨트랙트 구조를 기준으로,

- 리더사(leader)가 항공기 지연 보험 상품을 만들고
- 원수사/재보험사와 지분을 구성한 뒤
- 리더사 웹/앱에서 보험 가입자를 받고
- 백엔드 API를 통해 `FlightPolicy`를 온체인에 등록하는

흐름을 어떻게 설계할 수 있는지 정리한 계획 문서입니다.

## 1. 먼저, 현재 도메인 이해가 맞는지

질문에서 정리한 도메인 설명은 현재 코드 기준으로 대체로 맞습니다.

### 현재 컨트랙트 기준 해석

- `open_parametric` 프로그램 아래에는 여러 개의 `MasterAgreement`가 존재할 수 있습니다.
- 리더사(`leader`)가 `MasterAgreement`를 생성합니다.
- `MasterAgreement` 안에는 참여 보험사 목록(`participants`)과 재보험사(`reinsurer`)가 들어갑니다.
- 참여사 지분 합은 10000bps여야 하고, 참여사 목록에는 반드시 `leader`가 포함되어야 합니다.
- 참여사/재보험사의 확인 과정을 거쳐 `MasterAgreement`가 `Active`가 됩니다.
- 이후 개별 보험 가입 건은 `FlightPolicy`로 생성됩니다.

관련 코드:

- [create_master_agreement.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/instructions/create_master_agreement.rs)
- [register_participant_wallets.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/instructions/register_participant_wallets.rs)
- [confirm_master.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/instructions/confirm_master.rs)
- [create_flight_policy_from_master.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/instructions/create_flight_policy_from_master.rs)

### "리더사와 원수사/재보험사가 지분을 나누면 MasterAgreement가 구성된다"는 표현은 맞나

대체로 맞지만, 조금 더 정확히 말하면:

- `MasterAgreement`는 리더사가 생성한다.
- 생성 시 참여사 지분(`participants`)과 재보험 조건이 함께 설정된다.
- 그 뒤 참여사별 정산 지갑 등록과 확인 절차를 거친다.
- 재보험사 확인까지 끝나야 `Active`가 된다.

즉 "지분을 나눈다"만으로 완전히 끝나는 것은 아니고,

- 지분 구조 정의
- 지갑 등록
- 참여사 확인
- 재보험사 확인
- 활성화

까지 포함해야 실제 운영 가능한 `MasterAgreement`가 됩니다.

## 2. 현재 구조에서 가능한 가입 흐름

현재 컨트랙트가 허용하는 가입 흐름은 아래와 같습니다.

1. 리더사가 `MasterAgreement`를 생성한다.
2. 참여사와 재보험사가 확인을 마쳐 `MasterAgreement`를 `Active`로 만든다.
3. 리더사 앱/웹에서 보험 가입자를 모집한다.
4. 가입이 완료되면 리더사 시스템이 백엔드 API를 호출한다.
5. 백엔드가 `create_flight_policy_from_master` 인스트럭션을 호출해 `FlightPolicy`를 생성한다.
6. 이후 오라클 처리와 정산이 진행된다.

중요한 점은 현재 온체인에서 `FlightPolicy` 생성 권한이 아무에게나 열려 있지 않다는 것입니다.

[create_flight_policy_from_master.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/instructions/create_flight_policy_from_master.rs) 기준:

- `master.status == Active`
- `creator == master.leader || creator == master.operator`

여야 생성할 수 있습니다.

즉 현실적으로는:

- 리더사 백엔드가 직접 온체인 트랜잭션을 보내거나
- 공용 `open_parametric` 백엔드가 리더사 인증을 거친 후 leader/operator 권한으로 대신 보내는

구조가 됩니다.

## 3. Solana에서 이걸 "smart contract"라고 부르나

일반적으로는 맞습니다.

다만 Solana 생태계에서는 보통 더 정확하게:

- 스마트 컨트랙트
- Solana program
- on-chain program

중 하나로 부릅니다.

실무 문서에서는 "`open_parametric` Solana program"이라고 쓰는 편이 가장 자연스럽습니다.

## 4. "main.rs에 endpoint를 추가"는 정확히 어디를 고쳐야 하나

현재 구조에서 실제 HTTP 라우트는 [web.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/web.rs) 에 있습니다.

[main.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/main.rs) 는:

- 설정 로드
- 스케줄러 시작
- 웹 서버 시작

만 담당합니다.

따라서 새 endpoint를 추가하려면 실질적인 수정 포인트는:

- [web.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/web.rs)
- 필요하면 요청/응답 DTO용 새 모듈
- 온체인 트랜잭션 전송용 서비스 모듈

입니다.

## 5. 제안하는 목표 기능

목표는 다음과 같이 정의할 수 있습니다.

"리더사 시스템이 가입 완료 이벤트를 보내면, 백엔드가 이를 검증한 뒤 해당 `MasterAgreement` 아래에 `FlightPolicy`를 생성한다."

추천 endpoint 예시:

`POST /api/master-agreements/:master_pubkey/flight-policies`

요청 예시:

```json
{
  "subscriber_ref": "SUB-20260323-0001",
  "flight_no": "KE017",
  "route": "ICN-NRT",
  "departure_ts": 1773929632,
  "child_policy_id": 101,
  "idempotency_key": "leaderA-order-0001"
}
```

이 endpoint가 해야 할 일:

1. 호출 주체 인증
2. `master_pubkey` 조회
3. 요청자가 해당 `MasterAgreement`의 리더사인지 확인
4. `MasterAgreement.status == Active` 확인
5. `departure_ts`가 보장 구간 안에 있는지 검증
6. 중복 가입/중복 요청 여부 확인
7. 온체인 `create_flight_policy_from_master` 호출
8. 생성된 `FlightPolicy` pubkey와 tx signature 반환

## 6. 현실적으로 가장 중요한 설계 포인트

### A. 리더사 인증 방식

질문에서 나온 "리더사별 별도 token 발급" 아이디어는 오프체인 API 인증 토큰이라는 의미라면 충분히 현실적입니다.

예:

- 리더사별 API key
- 리더사별 JWT client credential
- HMAC 서명 방식

이 방식은 바로 도입 가능합니다.

추천:

- 1차 버전은 리더사별 `API token` 또는 `HMAC secret`
- 서버는 토큰으로 리더사 식별
- 리더사와 허용된 `MasterAgreement` 목록을 매핑

### B. 리더사별 "별도 SPL 토큰 발급" 아이디어

이건 목적을 나눠서 봐야 합니다.

#### API 인증용 토큰으로 쓰고 싶다면

현실성이 낮습니다.

이유:

- SPL 토큰 보유 여부만으로 HTTP 요청 인증을 안전하게 처리하기 어렵습니다.
- 결국 서버는 별도의 서명 검증 로직이나 지갑 서명 챌린지를 또 구현해야 합니다.
- 단순 API 인증은 JWT/HMAC/API key가 훨씬 단순하고 안정적입니다.

즉 "리더사별 토큰"은 온체인 자산으로서보다, 오프체인 인증 credential로 설계하는 편이 훨씬 현실적입니다.

#### 결제/통화 단위용 토큰으로 쓰고 싶다면

부분적으로 현실적입니다.

현재 `MasterAgreement`에는 이미 `currency_mint`가 있습니다.

즉 각 `MasterAgreement`는:

- 어떤 SPL mint를 보험료/지급 통화로 쓸지

를 이미 들고 있습니다.

따라서 "리더사별 토큰"이 정말로 보험료 결제 통화라면:

- 리더사별 mint를 만들고
- 각 `MasterAgreement.currency_mint`에 그 mint를 연결하는

구조는 가능합니다.

다만 이 경우에도 주의할 점이 있습니다.

- 같은 리더사가 여러 `MasterAgreement`를 만들 수 있다.
- 한 리더사가 꼭 하나의 토큰만 가져야 하는 것은 아니다.
- "리더사 = 토큰"으로 고정 매핑하면 나중에 상품 확장이 어려워질 수 있다.

추천:

- 토큰은 리더사 기준보다 `MasterAgreement.currency_mint` 기준으로 보는 것이 더 자연스럽다.
- 즉 "리더사별 토큰"보다는 "상품별 결제 통화"가 더 정확한 모델이다.

### C. `FlightPolicy`에 추가 정보가 필요한가

현재 `FlightPolicy`는 아래 정도의 정보만 저장합니다.

- `master`
- `creator`
- `subscriber_ref`
- `flight_no`
- `route`
- `departure_ts`
- `premium_paid`
- 상태/지연/지급 결과

즉 현재 구조에서도 가입 등록은 가능합니다.

하지만 아래 같은 운영 정보가 필요하면 컨트랙트 변경이 필요할 수 있습니다.

- 리더사 내부 주문 번호
- 가입 채널
- 사용자 지갑 주소
- 실명/개인정보
- 외부 결제 transaction id
- idempotency key

이런 값들은 현재 온체인 구조에 직접 넣기보다는:

- 백엔드 DB에 저장하고
- 온체인에는 최소 식별자(`subscriber_ref`)만 저장하는

방식이 더 현실적입니다.

## 7. `MasterAgreement`와 리더사 매핑은 어떻게 봐야 하나

질문의 핵심인 "그러면 `MasterAgreement`랑 매핑된 값은 `leader pubkey`가 맞아?"에 대한 답은:

"부분적으로 맞지만, 유일 식별자는 아니다" 입니다.

### 코드 기준 사실

`MasterAgreement` PDA 시드는 다음입니다.

- `["master_agreement", leader, master_id]`

관련 코드:

- [create_master_agreement.rs](/Users/deaver/Desktop/Repo/riskmesh/contract/programs/open_parametric/src/instructions/create_master_agreement.rs#L19)
- [pda.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/solana/pda.rs#L29)

즉:

- 하나의 `leader pubkey` 아래 여러 `MasterAgreement`가 있을 수 있습니다.
- 같은 `leader`가 `master_id`만 바꿔 여러 상품을 만들 수 있습니다.
- 반대로 다른 `leader`가 같은 `master_id`를 써도 별개 `MasterAgreement`가 됩니다.

따라서:

- "`leader pubkey`는 어떤 리더사가 소유한 마스터 정책인지 알려주는 소유자 키"로는 맞다
- "하지만 `MasterAgreement` 자체를 유일하게 식별하는 값"으로는 부족하다

가 정확한 설명입니다.

정리:

- 리더사 단위 조회: `leader pubkey`가 유용
- 개별 마스터 정책 식별: `master_agreement pubkey`가 기준

## 8. 현실 가능성 판단

### 바로 가능한 것

- 리더사 인증을 추가한 백엔드 endpoint 구현
- 요청 데이터를 검증한 뒤 `create_flight_policy_from_master` 호출
- `MasterAgreement`별 허용된 리더사 검증
- 오프체인 DB에 idempotency / 요청 이력 저장
- 응답으로 tx signature / flight policy pubkey 반환

즉 "가입 완료 후 서버가 받아서 온체인에 등록"하는 기본 시나리오는 충분히 현실적입니다.

### 조건부로 가능한 것

- 리더사별 결제 토큰 운영
- 상품별 다른 `currency_mint` 운영
- 리더사별 발급 credential과 마스터 정책 연결

이건 가능하지만 운영 복잡도가 올라갑니다.

### 바로는 비추천인 것

- SPL 토큰 자체를 API 인증 수단으로 쓰는 것
- 온체인에 가입자 운영 메타데이터를 과도하게 저장하는 것
- `leader pubkey` 하나만으로 개별 `MasterAgreement`를 식별하려는 것

## 9. 추천 구현 방향

1. 1차 버전은 "리더사 인증 토큰 + `master_pubkey` 지정" 모델로 간다.
2. endpoint는 `POST /api/master-agreements/:master_pubkey/flight-policies` 형태로 만든다.
3. 서버는 인증된 리더사가 해당 `MasterAgreement.leader`와 일치하는지 검증한다.
4. 서버는 on-chain tx를 leader 또는 operator 권한으로 보낸다.
5. 가입 메타데이터와 idempotency는 오프체인 DB에 저장한다.
6. 온체인에는 현재 구조가 허용하는 최소 데이터만 기록한다.

## 10. 구현 단계 계획

### Phase 1. 도메인/API 설계

- 리더사 인증 방식 선택
- 요청/응답 스키마 확정
- `master_pubkey` 기준 endpoint 확정
- 실패 코드/검증 규칙 정의

### Phase 2. 백엔드 endpoint 추가

- [web.rs](/Users/deaver/Desktop/Repo/riskmesh/backend/src/web.rs) 에 POST 라우트 추가
- 요청 DTO/응답 DTO 추가
- 인증 미들웨어 또는 간단한 토큰 검사 추가

### Phase 3. 온체인 생성 서비스 추가

- `MasterAgreement` 조회
- 리더사 권한 검증
- `create_flight_policy_from_master` 인스트럭션 빌드
- tx 전송 및 결과 반환

### Phase 4. 중복 방지와 운영성 보강

- idempotency key 저장
- 같은 `subscriber_ref` / 같은 항공편 / 같은 출발시각 중복 정책 정의
- 재시도 정책 추가
- 실패 로그 / 감사 로그 추가

### Phase 5. 필요 시 컨트랙트 확장

- `FlightPolicy`에 추가 필드가 정말 필요한지 검토
- 필요하면 V2 스키마 추가
- 기존 인덱서/API 영향 검토

## 11. 추천 결론

현재 구조에서 가장 현실적인 방향은:

- `MasterAgreement`를 상품 단위로 운영하고
- 리더사별 API 인증을 도입하고
- 리더사 앱/웹에서 가입 완료 시 backend endpoint를 호출하게 하며
- backend가 `FlightPolicy`를 on-chain 생성하는 구조

입니다.

그리고 식별 기준은:

- 리더사 소유 확인은 `leader pubkey`
- 개별 상품 식별은 `master_agreement pubkey`

로 나누는 것이 가장 안전합니다.
