# Backend API Specification

> **작성 목적**: 프론트엔드의 Solana devnet 직접 RPC 호출을 백엔드 API로 대체하기 위한 스펙.
> **배경**: 프론트에서 `onAccountChange` WebSocket 구독 및 `getProgramAccounts` 직접 호출 시 devnet 429 rate limit 발생 → 백엔드가 RPC를 단일 구독하고 SSE로 프론트에 분배.

---

## 아키텍처 변경 요약

```
[기존]
Frontend → Solana devnet RPC (직접, 클라이언트마다 구독) → 429 에러 발생

[변경 후]
Frontend → Backend API (REST + SSE)
                ↓
         Backend → Solana devnet RPC (단일 구독, in-memory 캐시)
```

---

## 기존 API (변경 필요)

### `GET /health`

현재 상태 그대로 유지.

**curl 예시:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "rpc_url": "https://api.devnet.solana.com",
  "leader_pubkey": "..."
}
```

---

### `GET /api/master-policies`

**변경사항**: `leader` 쿼리 파라미터 추가 (필터링).

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `leader` | `string (base58 pubkey)` | 선택 | 이 pubkey가 leader인 정책만 반환 |

**Request 예시:**
```
GET /api/master-policies?leader=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

**curl 예시:**
```bash
curl http://localhost:3000/api/master-policies

curl "http://localhost:3000/api/master-policies?leader=GNPnwyRCCvo8wLEPwJEmzEjrqyhSXeyXvTbYibieHpYM"
```

**Response:**
```json
{
  "master_policies": [
    {
      "pubkey": "3yGp...",
      "master_id": 1,
      "leader": "7xKX...",
      "operator": "7xKX...",
      "currency_mint": "5YsA...",
      "coverage_start_ts": 1710000000,
      "coverage_end_ts": 1712592000,
      "premium_per_policy": 5000000,
      "payout_delay_2h": 5000000,
      "payout_delay_3h": 8000000,
      "payout_delay_4to5h": 12000000,
      "payout_delay_6h_or_cancelled": 15000000,
      "ceded_ratio_bps": 3000,
      "reins_commission_bps": 500,
      "reinsurer_effective_bps": 2850,
      "reinsurer": "Abc1...",
      "reinsurer_confirmed": true,
      "reinsurer_pool_wallet": "Def2...",
      "reinsurer_deposit_wallet": "Ghi3...",
      "leader_deposit_wallet": "Jkl4...",
      "participants": [
        {
          "insurer": "Mno5...",
          "share_bps": 5000,
          "confirmed": true,
          "pool_wallet": "Pqr6...",
          "deposit_wallet": "Stu7..."
        }
      ],
      "oracle_feed": "Vwx8...",
      "status": 2,
      "status_label": "Active",
      "created_at": 1710000000
    }
  ]
}
```

---

### `GET /api/flight-policies`

**변경사항**: `master` 쿼리 파라미터 추가 (필터링).

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master` | `string (base58 pubkey)` | 선택 | 이 master policy pubkey에 속한 항공편 정책만 반환 |
| `status` | `number` | 선택 | 특정 상태의 정책만 반환 (0=Issued, 1=AwaitingOracle, 2=Claimable, 3=Paid, 4=NoClaim, 5=Expired) |

**Request 예시:**
```
GET /api/flight-policies?master=3yGp...
GET /api/flight-policies?master=3yGp...&status=1
```

**curl 예시:**
```bash
curl http://localhost:3000/api/flight-policies

curl "http://localhost:3000/api/flight-policies?master=c6DFe9oViEFYKPyasoCM8eiYggx9TZ2e7qH6UTr55mr"

curl "http://localhost:3000/api/flight-policies?master=c6DFe9oViEFYKPyasoCM8eiYggx9TZ2e7qH6UTr55mr&status=1"
```

**Response:**
```json
{
  "flight_policies": [
    {
      "pubkey": "9zAb...",
      "child_policy_id": 1,
      "master": "3yGp...",
      "creator": "7xKX...",
      "subscriber_ref": "USR-001",
      "flight_no": "KE001",
      "route": "ICN-NRT",
      "departure_ts": 1710500000,
      "premium_paid": 5000000,
      "delay_minutes": 0,
      "cancelled": false,
      "payout_amount": 0,
      "status": 1,
      "status_label": "AwaitingOracle",
      "premium_distributed": false,
      "created_at": 1710000000,
      "updated_at": 1710100000
    }
  ]
}
```

---

## 신규 API

### `GET /api/master-policies/:pubkey`

단일 MasterPolicy 계정 조회.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `pubkey` | `string (base58)` | MasterPolicy 계정 주소 |

**curl 예시:**
```bash
curl http://localhost:3000/api/master-policies/3yGp...
```

**Response:** 위 목록 응답의 단일 `MasterPolicyInfo` 객체.

**Error:**
```json
{ "error": "account not found" }   // 404
{ "error": "failed to fetch: ..." } // 500
```

---

### `GET /api/flight-policies/:pubkey`

단일 FlightPolicy 계정 조회.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `pubkey` | `string (base58)` | FlightPolicy 계정 주소 |

**curl 예시:**
```bash
curl http://localhost:3000/api/flight-policies/9zAb...
```

**Response:** 위 목록 응답의 단일 `FlightPolicyInfo` 객체.

---

### `GET /api/master-policies/:master_policy_pubkey/flight-policies`

특정 MasterPolicy에 속한 FlightPolicy 목록 조회.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `master_policy_pubkey` | `string (base58)` | MasterPolicy 계정 주소 |

**curl 예시:**
```bash
curl "http://localhost:3000/api/master-policies/3yGp.../flight-policies"
```

**Response:**
```json
{
  "program_id": "ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh",
  "master_policy_pubkey": "3yGp...",
  "count": 2,
  "flight_policies": [
    {
      "pubkey": "9zAb...",
      "child_policy_id": 1,
      "master": "3yGp...",
      "creator": "7xKX...",
      "subscriber_ref": "USR-001",
      "flight_no": "KE001",
      "route": "ICN-NRT",
      "departure_ts": 1710500000,
      "premium_paid": 5000000,
      "delay_minutes": 0,
      "cancelled": false,
      "payout_amount": 0,
      "status": 1,
      "status_label": "AwaitingOracle",
      "premium_distributed": false,
      "created_at": 1710000000,
      "updated_at": 1710100000
    }
  ]
}
```

**Error:**
```json
{ "error": "account not found" }   // 404
{ "error": "failed to fetch: ..." } // 500
```

---

### `POST /api/master-policies/:master_policy_pubkey/flight-policies`

특정 MasterPolicy 아래에 새로운 FlightPolicy를 생성.

**Path Parameters:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `master_policy_pubkey` | `string (base58)` | FlightPolicy를 생성할 대상 MasterPolicy 계정 주소 |

**Request Body:**
```json
{
  "subscriber_ref": "USR-001",
  "flight_no": "KE001",
  "route": "ICN-NRT",
  "departure_ts": 1710500000
}
```

**curl 예시:**
```bash
curl -X POST "http://localhost:3000/api/master-policies/3yGp.../flight-policies" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_ref": "USR-001",
    "flight_no": "KE001",
    "route": "ICN-NRT",
    "departure_ts": 1710500000
  }'
```

**Response:**
```json
{
  "program_id": "ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh",
  "master_policy_pubkey": "3yGp...",
  "child_policy_id": 1,
  "flight_policy_pubkey": "9zAb...",
  "tx_signature": "5YkK..."
}
```

**Error:**
```json
{ "error": "master_policy_pubkey 주소 파싱 실패: ..." } // 400
{ "error": "MasterPolicy가 Active 상태가 아닙니다: status=..." } // 500
{ "error": "현재 서버 키는 이 MasterPolicy의 leader/operator 권한이 없습니다" } // 500
{ "error": "subscriber_ref, flight_no, route는 비어 있을 수 없습니다" } // 500
```

---

### `GET /api/events` ⭐ (핵심 신규 엔드포인트)

**Server-Sent Events** 스트림. 백엔드가 Solana 계정 변경을 감지하면 연결된 프론트에 즉시 푸시.

**Query Parameters:**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `master` | `string (base58 pubkey)` | 선택 | 이 master에 속한 FlightPolicy 변경 이벤트만 수신. 생략 시 전체 수신. |

**curl 예시:**
```bash
curl -N http://localhost:3000/api/events

curl -N "http://localhost:3000/api/events?master=3yGp..."
```

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**이벤트 형식:**

각 SSE 이벤트는 `event:` 타입과 `data:` JSON 페이로드로 구성됩니다.

#### 1. `master_policy_updated`

MasterPolicy 계정 상태 변경 시 발생.

```
event: master_policy_updated
data: {"pubkey":"3yGp...","status":2,"status_label":"Active",...}
```

`data` 구조는 `/api/master-policies` 응답의 `MasterPolicyInfo`와 동일.

#### 2. `flight_policy_updated`

FlightPolicy 계정 상태 변경 시 발생.

```
event: flight_policy_updated
data: {"pubkey":"9zAb...","master":"3yGp...","status":2,"status_label":"Claimable","delay_minutes":135,...}
```

`data` 구조는 `/api/flight-policies` 응답의 `FlightPolicyInfo`와 동일.

#### 3. `heartbeat`

연결 유지용. 30초마다 전송.

```
event: heartbeat
data: {"ts":1710500000}
```

---

## 백엔드 구현 변경 사항

### 1. `AppState` 확장

```rust
pub struct AppState {
    pub config: Arc<Config>,
    // 기존 필드 유지

    // 신규: in-memory 캐시
    pub master_policies: Arc<RwLock<Vec<MasterPolicyInfo>>>,
    pub flight_policies: Arc<RwLock<Vec<FlightPolicyInfo>>>,

    // 신규: SSE broadcast 채널
    pub event_tx: broadcast::Sender<SseEvent>,
}

pub enum SseEvent {
    MasterPolicyUpdated(MasterPolicyInfo),
    FlightPolicyUpdated(FlightPolicyInfo),
    Heartbeat,
}
```

### 2. 신규 백그라운드 태스크: `cache_watcher`

`main.rs`에 세 번째 태스크 추가:

```rust
// main.rs
tokio::select! {
    _ = scheduler::start(&config) => {},
    _ = web::start(&state) => {},
    _ = cache::start(&state) => {},  // 신규
}
```

`cache::start()` 역할:
- Solana RPC `programSubscribe`(또는 주기적 폴링)로 MasterPolicy/FlightPolicy 계정 변경 감지
- 캐시 업데이트
- `event_tx.send(SseEvent::...)` 로 SSE 브로드캐스트

### 3. 기존 엔드포인트 수정

`/api/master-policies`, `/api/flight-policies` 엔드포인트를 직접 RPC 스캔 대신 **캐시에서 읽도록** 변경:

```rust
// 기존 (매 요청마다 RPC 스캔)
let policies = scan_master_policies(&config).await?;

// 변경 후 (캐시에서 읽기 + 필터)
let policies = state.master_policies.read().await.clone();
let filtered = if let Some(leader) = query.leader {
    policies.into_iter().filter(|p| p.leader == leader).collect()
} else {
    policies
};
```

---

## 프론트엔드 변경 사항

### 제거 대상 (RPC 직접 호출)

| 파일 | 현재 RPC 호출 | 대체 방법 |
|---|---|---|
| `hooks/useMasterPolicies.ts` | `program.account.masterPolicy.all(...)` | `GET /api/master-policies?leader=<pubkey>` |
| `hooks/useMasterPolicyAccount.ts` | `program.account.masterPolicy.fetch(pda)` + `onAccountChange` | `GET /api/master-policies/:pubkey` + SSE |
| `hooks/useFlightPolicies.ts` | `program.account.flightPolicy.all(...)` + `onAccountChange` per policy | `GET /api/flight-policies?master=<pubkey>` + SSE |

### 유지 대상 (트랜잭션은 여전히 wallet 서명 필요)

모든 write 훅(`useCreateMasterPolicy`, `useConfirmMaster`, `useActivateMaster`, `useCreateFlightPolicy`, `useResolveFlightDelay`, `useSettleFlight` 등)은 변경 없음.

### SSE 연결 예시 (프론트)

```typescript
// src/hooks/useBackendEvents.ts
export function useBackendEvents(masterPubkey?: string) {
  const { syncMasterFromChain, syncFlightPoliciesFromChain } = useProtocolStore();

  useEffect(() => {
    const url = masterPubkey
      ? `${BACKEND_URL}/api/events?master=${masterPubkey}`
      : `${BACKEND_URL}/api/events`;

    const es = new EventSource(url);

    es.addEventListener('master_policy_updated', (e) => {
      const data = JSON.parse(e.data);
      syncMasterFromChain(data);
    });

    es.addEventListener('flight_policy_updated', (e) => {
      const data = JSON.parse(e.data);
      syncFlightPoliciesFromChain([data]);
    });

    return () => es.close();
  }, [masterPubkey]);
}
```

---

## 환경 변수 추가

`.env.example`에 추가 필요:

```env
# 기존
WEB_BIND_ADDR=0.0.0.0:8080

# 신규
CACHE_POLL_INTERVAL_SEC=5        # 캐시 갱신 주기 (초). 기본값: 5
SSE_HEARTBEAT_INTERVAL_SEC=30    # SSE heartbeat 주기 (초). 기본값: 30
```

---

## API 응답 상태 코드 정리

| 코드 | 상황 |
|---|---|
| `200` | 정상 |
| `400` | 잘못된 파라미터 (e.g., base58 디코딩 실패) |
| `404` | 단일 계정 조회 시 없음 |
| `500` | RPC 오류 또는 파싱 실패 |

---

## 구현 우선순위

1. **Phase 1** (핵심): 캐시 + 기존 GET 엔드포인트 필터링 추가 → 프론트 `useMasterPolicies`, `useFlightPolicies` 교체
2. **Phase 2** (실시간): SSE 엔드포인트 + `useBackendEvents` 훅 → `useMasterPolicyAccount`, `useFlightPolicies` onAccountChange 제거
3. **Phase 3** (단일 조회): `/:pubkey` 엔드포인트 추가
