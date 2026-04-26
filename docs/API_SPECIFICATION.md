# RiskMesh Oracle Backend — API Specification

> Base URL: `http://{WEB_BIND_ADDR}` (기본값: `http://0.0.0.0:3000`)
>
> Framework: Axum (Rust)
>
> CORS: 모든 Origin / Method / Header 허용

---

## 목차

1. [공통 사항](#공통-사항)
2. [GET /health](#get-health)
3. [GET /api/master-agreements](#get-apimaster-agreements)
4. [GET /api/master-agreements/accounts](#get-apimaster-agreementsaccounts)
5. [GET /api/master-agreements/tree](#get-apimaster-agreementstree)
6. [GET /api/master-agreements/:master_agreement_pubkey](#get-apimaster-agreementsmaster_agreement_pubkey)
7. [GET /api/master-agreements/:master_agreement_pubkey/flight-policies](#get-apimaster-agreementsmaster_agreement_pubkeyflight-policies)
8. [POST /api/master-agreements/:master_agreement_pubkey/flight-policies](#post-apimaster-agreementsmaster_agreement_pubkeyflight-policies)
9. [GET /api/flight-policies](#get-apiflight-policies)
10. [GET /api/flight-policies/:flight_policy_pubkey](#get-apiflight-policiesflight_policy_pubkey)
11. [GET /api/events](#get-apievents)
12. [POST /api/firebase/test-document](#post-apifirebasetest-document)
13. [공통 타입 정의](#공통-타입-정의)

---

## 공통 사항

### Error Response

모든 API에서 에러 발생 시 동일한 JSON 형식으로 응답합니다.

| HTTP Status | 조건 |
|---|---|
| `404 Not Found` | 메시지에 "account not found" 포함 시 |
| `500 Internal Server Error` | 그 외 모든 에러 |

```json
{
  "error": "에러 메시지 문자열"
}
```

### Status 코드 매핑

**MasterAgreement Status**

| 값 | 라벨 |
|---|---|
| `0` | Draft |
| `1` | PendingConfirm |
| `2` | Active |
| `3` | Closed |
| `4` | Cancelled |

**FlightPolicy Status**

| 값 | 라벨 |
|---|---|
| `0` | Issued |
| `1` | AwaitingOracle |
| `2` | Claimable |
| `3` | Paid |
| `4` | NoClaim |
| `5` | Expired |

---

## GET /health

서버 상태 확인 (헬스체크).

### Parameters

없음

### Response `200 OK`

```typescript
{
  status: "ok",          // string — 항상 "ok"
  rpc_url: string,       // Solana RPC endpoint URL
  leader_pubkey: string  // 서버가 사용하는 leader 지갑 공개키 (Base58)
}
```

### 예시

```json
{
  "status": "ok",
  "rpc_url": "https://api.devnet.solana.com",
  "leader_pubkey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

---

## GET /api/master-agreements

Firebase에 저장된 MasterAgreement 목록을 조회합니다. leader 필터링을 지원합니다.

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `leader` | `string` | No | leader 공개키(Base58)로 필터링. 미지정 시 전체 반환 |

### Response `200 OK`

```typescript
{
  master_agreements: MasterAgreementInfo[]
}
```

### 예시

```
GET /api/master-agreements?leader=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

---

## GET /api/master-agreements/accounts

Solana 온체인에서 직접 MasterAgreement 계정의 공개키 목록을 조회합니다. Firebase가 아닌 `getProgramAccounts` RPC를 사용합니다.

### Parameters

없음

### Response `200 OK`

```typescript
{
  program_id: string,              // 프로그램 ID (Base58)
  count: number,                   // MasterAgreement 계정 수
  master_agreement_pubkeys: string[]  // MasterAgreement 공개키 목록 (Base58)
}
```

### 예시

```json
{
  "program_id": "FKLP2...xxxx",
  "count": 2,
  "master_agreement_pubkeys": [
    "8dF3q...",
    "9eG4r..."
  ]
}
```

---

## GET /api/master-agreements/tree

전체 MasterAgreement와 하위 FlightPolicy의 트리 구조를 반환합니다. 각 MasterAgreement에 속한 FlightPolicy 공개키 목록이 포함됩니다.

### Parameters

없음

### Response `200 OK`

```typescript
{
  program_id: string,                       // 프로그램 ID (Base58)
  count: number,                            // MasterAgreement 수
  master_agreements: MasterAgreementAccountTree[]
}
```

**MasterAgreementAccountTree**

```typescript
{
  master_agreement_pubkey: string,      // MasterAgreement 공개키 (Base58)
  flight_policy_pubkeys: string[]    // 하위 FlightPolicy 공개키 목록 (Base58)
}
```

### 예시

```json
{
  "program_id": "FKLP2...xxxx",
  "count": 1,
  "master_agreements": [
    {
      "master_agreement_pubkey": "8dF3q...",
      "flight_policy_pubkeys": ["Abc12...", "Def34..."]
    }
  ]
}
```

---

## GET /api/master-agreements/:master_agreement_pubkey

특정 MasterAgreement의 상세 정보를 Firebase에서 조회합니다.

### Path Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master_agreement_pubkey` | `string` | Yes | MasterAgreement 계정의 공개키 (Base58) |

### Response `200 OK`

`MasterAgreementInfo` 객체를 반환합니다. (하단 [공통 타입 정의](#공통-타입-정의) 참조)

### Error

| Status | 조건 |
|---|---|
| `404` | 해당 공개키의 MasterAgreement가 존재하지 않을 때 |
| `500` | 공개키 파싱 실패 등 |

---

## GET /api/master-agreements/:master_agreement_pubkey/flight-policies

특정 MasterAgreement에 속한 FlightPolicy 목록을 조회합니다.

### Path Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master_agreement_pubkey` | `string` | Yes | MasterAgreement 계정의 공개키 (Base58) |

### Response `200 OK`

```typescript
{
  program_id: string,              // 프로그램 ID (Base58)
  master_agreement_pubkey: string,    // 조회한 MasterAgreement 공개키
  count: number,                   // 하위 FlightPolicy 수
  flight_policies: FlightPolicyInfo[]
}
```

### Error

| Status | 조건 |
|---|---|
| `404` | 해당 MasterAgreement가 존재하지 않을 때 |

---

## POST /api/master-agreements/:master_agreement_pubkey/flight-policies

특정 MasterAgreement 하위에 새 FlightPolicy를 생성합니다. 온체인 트랜잭션을 전송합니다.

### Path Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master_agreement_pubkey` | `string` | Yes | MasterAgreement 계정의 공개키 (Base58) |

### Request Body (`application/json`)

```typescript
{
  subscriber_ref: string,   // 가입자 참조 ID (빈 문자열 불가)
  flight_no: string,        // 항공편 번호 (예: "KE123") (빈 문자열 불가)
  route: string,            // 노선 (예: "ICN-NRT") (빈 문자열 불가)
  departure_ts: number      // 출발 예정 시각 (Unix timestamp, 초 단위, i64)
}
```

### Response `200 OK`

```typescript
{
  program_id: string,             // 프로그램 ID (Base58)
  master_agreement_pubkey: string,   // 부모 MasterAgreement 공개키
  child_policy_id: number,        // 자동 부여된 FlightPolicy ID (u64)
  flight_policy_pubkey: string,   // 생성된 FlightPolicy PDA 공개키 (Base58)
  tx_signature: string            // Solana 트랜잭션 서명 (Base58)
}
```

### Error

| Status | 조건 |
|---|---|
| `500` | MasterAgreement가 Active 상태가 아닐 때 |
| `500` | 서버 키가 leader/operator 권한이 없을 때 |
| `500` | subscriber_ref, flight_no, route가 비어 있을 때 |
| `500` | 온체인 트랜잭션 실패 시 |

### 예시

```bash
curl -X POST http://localhost:3000/api/master-agreements/8dF3q.../flight-policies \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_ref": "user-001",
    "flight_no": "KE123",
    "route": "ICN-NRT",
    "departure_ts": 1717200000
  }'
```

---

## GET /api/flight-policies

Firebase에 저장된 FlightPolicy 목록을 조회합니다. MasterAgreement 공개키와 상태로 필터링을 지원합니다.

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master` | `string` | No | 부모 MasterAgreement 공개키(Base58)로 필터링 |
| `status` | `number` (u8) | No | FlightPolicy 상태 코드로 필터링 (0~5) |

### Response `200 OK`

```typescript
{
  flight_policies: FlightPolicyInfo[]
}
```

### 예시

```
GET /api/flight-policies?master=8dF3q...&status=0
```

---

## GET /api/flight-policies/:flight_policy_pubkey

특정 FlightPolicy의 상세 정보를 Firebase에서 조회합니다.

### Path Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `flight_policy_pubkey` | `string` | Yes | FlightPolicy 계정의 공개키 (Base58) |

### Response `200 OK`

`FlightPolicyInfo` 객체를 반환합니다. (하단 [공통 타입 정의](#공통-타입-정의) 참조)

### Error

| Status | 조건 |
|---|---|
| `404` | 해당 공개키의 FlightPolicy가 존재하지 않을 때 |

---

## GET /api/events

SSE (Server-Sent Events) 스트림을 반환합니다. 온체인 계정 상태 변경을 실시간으로 수신할 수 있습니다.

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master` | `string` | No | 특정 MasterAgreement 공개키로 이벤트 필터링. 미지정 시 전체 이벤트 수신 |

### Response `200 OK` (`text/event-stream`)

Connection은 유지되며, 아래 이벤트가 스트림으로 전송됩니다.

**이벤트 타입**

| event | data 형식 | 설명 |
|---|---|---|
| `master_agreement_updated` | `MasterAgreementInfo` (JSON) | MasterAgreement 계정 상태가 변경됨 |
| `flight_policy_updated` | `FlightPolicyInfo` (JSON) | FlightPolicy 계정 상태가 변경됨 |
| `heartbeat` | `{"ts": <unix_seconds>}` | 30초 간격 keepalive |

**필터 동작**

- `master` 파라미터 지정 시:
  - `flight_policy_updated`: data의 `master` 필드가 필터 값과 일치하는 이벤트만 전송
  - `master_agreement_updated`: data의 `pubkey` 필드가 필터 값과 일치하는 이벤트만 전송
  - 그 외 이벤트: 필터 무시하고 전송

### 예시

```bash
curl -N "http://localhost:3000/api/events?master=8dF3q..."
```

```
event: master_agreement_updated
data: {"pubkey":"8dF3q...","master_id":1,"leader":"7xKXtg...","status":2,...}

event: flight_policy_updated
data: {"pubkey":"Abc12...","child_policy_id":1,"master":"8dF3q...","status":1,...}

event: heartbeat
data: {"ts":1717200030}
```

---

## POST /api/firebase/test-document

Firebase Firestore 연결 테스트용 엔드포인트. 테스트 문서를 생성하여 Firebase 인증 및 연결 상태를 확인합니다.

### Parameters

없음 (Request Body 없음)

### Response `200 OK`

```typescript
{
  firebase_saved: boolean,        // 저장 성공 여부 (항상 true)
  collection_id: string,          // Firestore 컬렉션 ID
  document_id: string,            // 생성된 문서 ID
  firebase_document_path: string, // Firestore 문서 전체 경로
  auth_principal: string          // 인증에 사용된 서비스 계정 ID
}
```

---

## 공통 타입 정의

### MasterAgreementInfo

MasterAgreement(공동보험 계약) 온체인 계정의 역직렬화된 정보입니다.

```typescript
{
  pubkey: string,                         // 계정 공개키 (Base58)
  master_id: number,                      // MasterAgreement 고유 ID (u64)
  leader: string,                         // leader 지갑 공개키 (Base58)
  operator: string,                       // operator 지갑 공개키 (Base58)
  currency_mint: string,                  // SPL 토큰 민트 주소 (Base58)
  coverage_start_ts: number,              // 보장 시작 시각 (Unix timestamp, i64)
  coverage_end_ts: number,                // 보장 종료 시각 (Unix timestamp, i64)
  premium_per_policy: number,             // 개별 보험증권 보험료 (lamports 단위, u64)
  payout_delay_2h: number,                // 2시간 지연 시 보험금 (u64)
  payout_delay_3h: number,                // 3시간 지연 시 보험금 (u64)
  payout_delay_4to5h: number,             // 4~5시간 지연 시 보험금 (u64)
  payout_delay_6h_or_cancelled: number,   // 6시간 이상 또는 결항 시 보험금 (u64)
  ceded_ratio_bps: number,                // 출재 비율 (basis points, u16, 10000 = 100%)
  reins_commission_bps: number,           // 재보험 수수료 비율 (bps, u16)
  reinsurer_effective_bps: number,        // 재보험자 실효 비율 (bps, u16)
  reinsurer: string,                      // 재보험자 공개키 (Base58)
  reinsurer_confirmed: boolean,           // 재보험자 확인 여부
  reinsurer_pool_wallet: string,          // 재보험자 풀 월렛 ATA (Base58)
  reinsurer_deposit_wallet: string,       // 재보험자 예치 월렛 ATA (Base58)
  leader_deposit_wallet: string,          // leader 예치 월렛 ATA (Base58)
  participants: MasterParticipantInfo[],  // 참여자 목록
  oracle_feed: string,                    // 오라클 피드 주소 (Base58)
  status: number,                         // 상태 코드 (u8, 0~4)
  status_label: string,                   // 상태 라벨 ("Draft"|"PendingConfirm"|"Active"|"Closed"|"Cancelled")
  created_at: number                      // 생성 시각 (Unix timestamp, i64)
}
```

### MasterParticipantInfo

MasterAgreement 내 개별 참여자(보험사) 정보입니다.

```typescript
{
  insurer: string,         // 참여자 공개키 (Base58)
  share_bps: number,       // 인수 비율 (basis points, u16)
  confirmed: boolean,      // 참여 확인 여부
  pool_wallet: string,     // 참여자 풀 월렛 ATA (Base58)
  deposit_wallet: string   // 참여자 예치 월렛 ATA (Base58)
}
```

### FlightPolicyInfo

FlightPolicy(항공편 보험증권) 온체인 계정의 역직렬화된 정보입니다.

```typescript
{
  pubkey: string,              // 계정 공개키 (Base58)
  child_policy_id: number,     // MasterAgreement 하위 증권 ID (u64)
  master: string,              // 부모 MasterAgreement 공개키 (Base58)
  creator: string,             // 증권 생성자 공개키 (Base58)
  subscriber_ref: string,      // 가입자 참조 ID
  flight_no: string,           // 항공편 번호 (예: "KE123")
  route: string,               // 노선 (예: "ICN-NRT")
  departure_ts: number,        // 출발 예정 시각 (Unix timestamp, i64)
  premium_paid: number,        // 납부한 보험료 (lamports 단위, u64)
  delay_minutes: number,       // 실제 지연 시간(분) (u16, 오라클이 설정)
  cancelled: boolean,          // 결항 여부 (오라클이 설정)
  payout_amount: number,       // 산정된 보험금 (u64)
  status: number,              // 상태 코드 (u8, 0~5)
  status_label: string,        // 상태 라벨 ("Issued"|"AwaitingOracle"|"Claimable"|"Paid"|"NoClaim"|"Expired")
  premium_distributed: boolean,// 보험료 분배 완료 여부
  created_at: number,          // 생성 시각 (Unix timestamp, i64)
  updated_at: number           // 최종 수정 시각 (Unix timestamp, i64)
}
```
