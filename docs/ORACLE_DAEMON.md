# 백엔드 오라클 데몬 동작 정리

## 전체 구조

```
main.rs
 ├── scheduler::start()   — cron 기반 반복 작업
 └── api::start()         — HTTP / SSE 서버
```

스케줄러는 두 개의 독립적인 cron job을 실행한다.

| Job | 환경변수 | 기본 주기 | 역할 |
|---|---|---|---|
| `oracle_check` | `ORACLE_CHECK_CRON` | `0 */15 * * * *` (15분) | Track A + Track B 실행 |
| `firebase_sync` | `FIREBASE_SYNC_CRON` | `0/30 * * * * *` (30초) | devnet 스캔 → Firebase 저장 → SSE 발화 |

---

## oracle_check (15분 주기)

### Track A — Trusted Resolver

```
devnet 스캔 (Issued / AwaitingOracle 상태)
 → AviationStack API 호출 (항공편 지연 조회)
 → resolve_flight_delay tx 전송
    - delay_minutes, cancelled 기록
    - 지연 >= 120분 또는 결항 → status: Claimable(2)
    - 지연 < 120분            → status: NoClaim(4)
 → FlightPolicy 재조회
    - Claimable → settle_flight_claim tx 전송 → status: Paid(3)
    - NoClaim   → settle_flight_no_claim tx 전송 → status: Expired(5)
```

### Track B — Switchboard On-Demand

```
devnet 스캔 (AwaitingOracle / Claimable / NoClaim 상태)
 → MasterAgreement에서 oracle_feed 추출
 → Switchboard Crossbar API에서 오라클 업데이트 수신
 → 3-instruction tx 전송:
    [Ed25519 ix, verified_update ix, check_oracle_and_resolve_flight ix]
 → FlightPolicy 재조회
    - Claimable → settle_flight_claim tx 전송 → status: Paid(3)
    - NoClaim   → settle_flight_no_claim tx 전송 → status: Expired(5)
```

> **Claimable / NoClaim을 재스캔하는 이유**: `check_oracle_and_resolve_flight`는 성공했지만 후속 settle tx가 실패하면 해당 상태에 고착된다. 다음 사이클에서 자동 재시도한다.

---

## firebase_sync (30초 주기)

```
devnet 전체 스캔 (getProgramAccounts)
 → MasterAgreement + FlightPolicy 파싱
 → event_bus.publish_policy_updates() 호출
    - 최초 실행: 스냅샷 초기화만 (SSE 없음)
    - 이후 실행: 이전 스냅샷과 diff → 변경된 계정만 SSE 발화
 → Firebase에 최신 스냅샷 저장
```

### SSE 이벤트

| 이벤트명 | 트리거 조건 |
|---|---|
| `flight_policy_updated` | FlightPolicy 필드가 이전 스냅샷과 다를 때 |
| `master_agreement_updated` | MasterAgreement 필드가 이전 스냅샷과 다를 때 |
| `heartbeat` | 30초마다 (연결 유지용) |

---

## FlightPolicy 상태 전이

```
Issued(0)
 └─ oracle_check → resolve_flight_delay
      ├─ delay >= 120분 or 결항 → Claimable(2)
      │    └─ settle_flight_claim → Paid(3)
      └─ delay < 120분           → NoClaim(4)
           └─ settle_flight_no_claim → Expired(5)
```

---

## 프론트엔드 연동

```
firebase_sync SSE
 └─ useFlightPolicies (SSE listener)
      └─ setPolicies() → syncFlightPoliciesFromChain()
           └─ Zustand store contracts[] 업데이트
                └─ ContractFeedTable, OracleConsole 등 UI 자동 반영
```

---

## 수동 트리거 방법

oracle_check를 수동으로 호출하는 HTTP 엔드포인트는 없다.  
테스트 시에는 아래 방법을 사용한다.

```bash
# FlightPolicy 생성 (백엔드 API)
curl -X POST http://localhost:3000/api/master-agreements/<MASTER_PDA>/flight-policies \
  -H "Content-Type: application/json" \
  -d '{"subscriber_ref":"test","flight_no":"KE001","route":"ICN-NRT","departure_ts":1712000000}'

# resolve_flight_delay 수동 실행 (API 없이)
MASTER_PDA=<pubkey> CHILD_POLICY_ID=4 DELAY_MINUTES=150 \
KEYPAIR_PATH=~/.config/solana/riskmesh-leader.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn ts-node -P tsconfig.json scripts/manual-resolve.ts
```
