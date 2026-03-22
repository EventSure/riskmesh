# Oracle 연동 가이드

## 개요

Open Parametric 컨트랙트의 오라클 연동은 두 가지 독립적인 트랙으로 구현되어 있습니다.

| 트랙 | 방식 | 대상 계정 | 신뢰 모델 |
|---|---|---|---|
| **Track A** | Trusted Resolver | `FlightPolicy` (Master/Flight 플로우) | 중앙화 — Leader/Operator 서명 |
| **Track B** | Switchboard On-Demand | `Policy` (Legacy 플로우) | 탈중앙화 — 암호학적 오라클 검증 |

두 트랙 모두 [AviationStack API](https://aviationstack.com)를 항공편 지연 데이터 소스로 사용합니다.

오라클 체크부터 정산까지 전 과정은 **백엔드 데몬(`backend/`)이 자동 처리**합니다.
스크립트는 초기 셋업과 보험 가입(FlightPolicy 생성)에만 사용합니다.

---

## 공통 개념

### 지연 데이터 형식

오라클이 제공하는 `delay_minutes` 값은 **10분 단위 내림**으로 정규화됩니다.

```
실제 지연 127분 → 120분 (10분 단위 내림)
실제 지연 155분 → 150분
```

컨트랙트 온체인 검증: `oracle_delay_min % 10 == 0`

### 티어드 지급 구조 (Track A)

`MasterPolicy`에 설정된 4단계 지급액을 사용합니다.

| 조건 | 지급 필드 |
|---|---|
| 지연 ≥ 120분 (2h) | `payout_delay_2h` |
| 지연 ≥ 180분 (3h) | `payout_delay_3h` |
| 지연 ≥ 240분 (4–5h) | `payout_delay_4to5h` |
| 지연 ≥ 360분 (6h) 또는 결항 | `payout_delay_6h_or_cancelled` |
| 지연 < 120분 | 0 (지급 없음) |

### 주요 상수

```
DELAY_THRESHOLD_MIN       = 120   (Track B Legacy 기준: 2시간)
ORACLE_MAX_STALENESS_SLOTS = 150  (Track B: 약 60–90초 이내 데이터만 유효)
```

---

## Track A — Trusted Resolver

### 개념

Leader 또는 Operator가 AviationStack API에서 직접 데이터를 가져와 온체인 `resolve_flight_delay` 인스트럭션을 호출합니다. 오라클 데이터의 진위는 서명 주체(Leader/Operator)의 신뢰에 의존합니다.

```
AviationStack API
       │
       ▼ (백엔드 데몬 / oracle-resolve.ts)
resolve_flight_delay (온체인)
  ├─ payout > 0  → FlightPolicy: Claimable
  └─ payout = 0  → FlightPolicy: NoClaim
       │
  ┌────┴────┐
  ▼         ▼
settle_    settle_
flight_    flight_
claim      no_claim
(자동)     (자동)
```

### 사전 조건

1. `MasterPolicy` 가 `Active` 상태
2. `FlightPolicy` 가 `Issued` 또는 `AwaitingOracle` 상태
3. 백엔드 데몬의 `AVIATIONSTACK_API_KEY` 설정

### FlightPolicy 상태 머신

```
Issued / AwaitingOracle
       │
       │ resolve_flight_delay  ← 데몬 자동
       │
  ┌────┴────────┐
  ▼             ▼
Claimable    NoClaim
  │             │
  ▼             ▼             ← 데몬 자동
 Paid         Expired
(settle_      (settle_
 flight_       flight_
 claim)        no_claim)
```

### 자동화 흐름 (백엔드 데몬)

데몬이 cron 주기마다 다음을 자동 실행합니다:

1. `Issued` / `AwaitingOracle` / `Claimable` / `NoClaim` 상태 FlightPolicy 전체 스캔
2. `departure_ts` 경과 확인
3. AviationStack 조회 → `resolve_flight_delay` 전송
4. MasterPolicy 온체인 파싱으로 토큰 계정 주소 획득
5. `settle_flight_claim` 또는 `settle_flight_no_claim` 자동 전송

> `Claimable` / `NoClaim` 상태도 스캔 대상에 포함되므로, 데몬이 resolve 후 settle 전에 중단돼도 다음 실행 시 자동으로 정산을 재시도합니다.

### 수동 실행 (테스트용)

백엔드 데몬 없이 resolve만 수동으로 실행할 수 있습니다:

```bash
# devnet 기준
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
yarn demo:oracle-resolve

# 특정 날짜 / 특정 FlightPolicy 지정
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
FLIGHT_DATE=2026-02-27 \
CHILD_POLICY_ID=1 \
yarn demo:oracle-resolve
```

resolve 실행 후 settle은 다음 데몬 주기에 자동 처리됩니다.

### 환경변수 (수동 실행 시)

| 변수 | 필수 | 설명 |
|---|---|---|
| `AVIATIONSTACK_API_KEY` | ✅ | AviationStack API 키 |
| `FLIGHT_NO` | — | 항공편 코드 (기본값: state.json의 마지막 FlightPolicy) |
| `FLIGHT_DATE` | — | 날짜 `YYYY-MM-DD` (기본값: FlightPolicy의 departure_ts) |
| `CHILD_POLICY_ID` | — | 처리할 FlightPolicy ID (기본값: 마지막 생성 항목) |
| `ANCHOR_PROVIDER_URL` | — | RPC 엔드포인트 (기본값: `http://localhost:8899`) |
| `PROGRAM_ID` | — | 프로그램 ID override |

### 실행 결과 예시 (수동)

```
항공편 조회 중: KE017 / 2026-02-27
데이터 소스: AviationStack API

=== 항공편 데이터 ===
상태           : landed
결항 여부      : 운항
원시 지연(분)  : 127
10분 단위 지연 : 120 분
예정 출발      : 2026-02-27T11:30:00+09:00
실제 출발      : 2026-02-27T13:37:00+09:00

=== resolve_flight_delay 완료 ===
Tx             : 5abc...
지연(온체인)   : 120 분
payout_amount  : 50000000
status         : 2 (2=Claimable, 4=NoClaim)

→ 지급 조건 충족. 백엔드 데몬이 다음 주기에 settle_flight_claim을 자동 실행합니다.
```

---

## Track B — Switchboard On-Demand

### 개념

Switchboard 오라클 네트워크가 AviationStack API를 직접 호출하여 결과를 온체인 feed 계정에 서명·기록합니다. `check_oracle_and_create_claim`은 동일 트랜잭션 내의 Switchboard 인스트럭션을 검증한 뒤 `Claim` 계정을 생성합니다.

```
AviationStack API
       │
       ▼ (Switchboard oracle 노드가 호출)
Pull Feed 계정 (온체인, 암호학적 서명)
       │
       ▼
check_oracle_and_create_claim (온체인, 3-ix 트랜잭션)
  ├─ delay ≥ 120분 → Policy: Claimable, Claim 계정 생성
  └─ delay < 120분 → Policy: Active 유지 (Claim 없음)
       │
  (Claimable인 경우) ← 데몬 자동
  approve_claim → settle_claim
```

### 3-인스트럭션 트랜잭션 구조

`check_oracle_and_create_claim`은 반드시 같은 트랜잭션의 인덱스 0, 1 위치에 Switchboard 인스트럭션이 있어야 합니다.

```
트랜잭션 인스트럭션 순서 (필수):
  [0] Ed25519 서명 검증        ← Switchboard가 생성
  [1] verified_update          ← Switchboard가 생성
  [2] check_oracle_and_create_claim  ← 우리 프로그램
```

컨트랙트 내부에서 `verify_instruction_at(0)`으로 인덱스 0의 서명 검증 인스트럭션을 참조합니다.

### Policy 상태 머신 (Track B)

```
Draft → Open → Funded → Active
                           │
                           │ check_oracle_and_create_claim  ← 데몬 자동
                           │
                   ┌───────┴────────┐
                   ▼                ▼
              Claimable          Active 유지
              (delay≥120분)     (delay<120분)
                   │
                   ▼
               Approved           ← 데몬 자동
          (approve_claim)
                   │
                   ▼
               Settled            ← 데몬 자동
           (settle_claim)
```

### 자동화 흐름 (백엔드 데몬)

데몬이 cron 주기마다 다음을 자동 실행합니다:

1. `Active` 상태 Policy 스캔 (리더 pubkey 필터)
2. `departure_date` 경과 확인
3. Switchboard Crossbar에서 서명된 oracle update 수신
4. 3-ix 트랜잭션 전송: `check_oracle_and_create_claim`
5. oracle 값 ≥ 120분이면:
   - `approve_claim` 자동 전송
   - RiskPool 계정에서 vault 주소 온체인 파싱
   - `settle_claim` 자동 전송 (beneficiary = 리더 ATA)

### 실행 순서 (수동 셋업)

#### Step 1 — Feed 생성 (1회)

Switchboard devnet에 Pull Feed 계정을 생성합니다. 생성된 `feedPubkey`가 `.state.json`에 저장됩니다.

```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
yarn demo:oracle-feed-create
```

**주의:** API 키가 feed 계정에 포함되어 온체인에 저장됩니다. 유료 키는 Switchboard Secrets 사용을 권장합니다.

**출력 예시:**
```
Pull Feed 생성 중 (항공편: KE017)...

=== Feed 생성 완료 ===
Tx             : 3s335FL2...
Feed Pubkey    : 278oAt1RBQLZAVfx35qYEjuhiH29nJmGpmzpKCVtDZTs
항공편         : KE017
```

#### Step 2 — Policy에 feedPubkey 등록

`create_policy` 시 `oracleFeed` 파라미터에 Step 1의 `feedPubkey`를 지정합니다.

#### Step 3 — 데몬 실행

feed 생성 후 **1~2분** 대기 (oracle 노드 처리 시간) 후 데몬을 실행합니다.
이후 check_oracle → approve → settle이 자동 처리됩니다.

수동으로 oracle 클레임만 실행하려면:
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn demo:oracle-claim
```

### 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANCHOR_PROVIDER_URL` | ✅ | devnet RPC (`https://api.devnet.solana.com`) |
| `AVIATIONSTACK_API_KEY` | ✅ (feed-create만) | AviationStack API 키 |
| `FLIGHT_NO` | — | 항공편 코드 (기본값: `KE017`) |
| `PROGRAM_ID` | — | 프로그램 ID override |

---

## 두 트랙 비교

| 항목 | Track A (Trusted Resolver) | Track B (Switchboard) |
|---|---|---|
| **신뢰 모델** | Leader/Operator 신뢰 | 암호학적 검증 (탈중앙화) |
| **데이터 흐름** | 데몬 → API → 온체인 | oracle 노드 → API → feed → 온체인 |
| **대상 계정** | `FlightPolicy` | `Policy` (Legacy) |
| **지급 구조** | 4단계 티어드 | 단일 payout_amount |
| **자동화 범위** | resolve + settle | check_oracle + approve + settle |
| **네트워크** | localnet / devnet / mainnet | devnet 이상 필수 |
| **지연 시간** | 즉시 | feed 생성 후 1~2분 대기 |
| **비용** | 일반 tx 수수료 | feed 생성 ~0.01–0.05 SOL 추가 |

---

## AviationStack API 제약사항

| 플랜 | `flight_date` 필터 | HTTPS | 월 요청 수 |
|---|---|---|---|
| 무료 | ❌ (유료 전용) | ❌ (HTTP만) | 100회 |
| 유료 | ✅ | ✅ | 플랜별 상이 |

**무료 플랜 사용 시 동작:**
- `flight_date` 파라미터를 URL에 포함하면 `function_access_restricted` 오류
- 날짜 필터링은 클라이언트 측(`flight-api.ts`)에서 응답 데이터를 기준으로 처리
- 실시간 운항 데이터만 조회 가능 (과거 항공편 이력 조회 불가)

---

## 전체 실행 순서 요약

### Track A (Master/Flight 플로우)

```bash
# 1. 초기 셋업 (최초 1회)
cd contract && yarn install
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
yarn demo:master-setup

# 2. 항공편 가입 (건당)
FLIGHT_NO=KE017 ROUTE=ICN-NRT DEPARTURE_TS=<unix_ts> yarn demo:flight-create

# 3. 백엔드 데몬 실행 → resolve + settle 자동 처리
cd ../backend && RUST_LOG=info ./target/release/oracle-daemon
```

### Track B (Legacy Policy 플로우)

```bash
# 1. 기본 setup → Policy 생성 → 언더라이팅 → 활성화
cd contract && yarn install
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
yarn demo:setup
yarn demo:create-policy
yarn demo:open-uw
yarn demo:accept-shares
yarn demo:activate

# 2. Feed 생성 (devnet, 1회)
AVIATIONSTACK_API_KEY=<키> FLIGHT_NO=KE017 yarn demo:oracle-feed-create

# 3. 1~2분 대기 후 백엔드 데몬 실행 → check_oracle + approve + settle 자동 처리
cd ../backend && RUST_LOG=info ./target/release/oracle-daemon
```

---

## 온체인 계정 구조 참고

### Track A 관련 계정

```
MasterPolicy  PDA: ["master_policy", leader, master_id_le8]
FlightPolicy  PDA: ["flight_policy", master_policy, child_policy_id_le8]
```

### Track B 관련 계정

```
Policy    PDA: ["policy", leader, policy_id_le8]
RiskPool  PDA: ["pool", policy]
Claim     PDA: ["claim", policy, oracle_round_le8]
          oracle_round = 클레임 시점의 확정 슬롯 번호 (unique seed)
```

### Switchboard Feed 연결

```
Policy.oracle_feed  ──→  Pull Feed 계정 (Switchboard devnet)
                              │
                              └─ jobs: [AviationStack HTTP 호출]
                              └─ queue: ON_DEMAND_DEVNET_QUEUE
```
