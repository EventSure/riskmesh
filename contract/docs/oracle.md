# Oracle 연동 가이드

## 개요

Open Parametric 컨트랙트의 오라클 연동은 두 가지 독립적인 트랙으로 구현되어 있습니다.
두 트랙 모두 **Master/Flight 계정 구조**를 사용하며, 오라클 방식만 다릅니다.

| 트랙 | 방식 | oracle instruction | 신뢰 모델 |
|---|---|---|---|
| **Track A** | Trusted Resolver (AviationStack API) | `resolve_flight_delay` | 중앙화 — Leader/Operator 서명 |
| **Track B** | Switchboard On-Demand | `check_oracle_and_resolve_flight` | 탈중앙화 — 암호학적 오라클 검증 |

양 트랙의 settlement(`settle_flight_claim` / `settle_flight_no_claim`)는 공용입니다.

---

## Switchboard On-Demand 개념

### Pull Feed란

Switchboard On-Demand의 **Pull Feed**는 Solana 온체인 계정입니다.
이 계정은 "어떤 외부 데이터를 어떻게 가져와야 하는가"를 정의하는 **Job 목록**을 담고 있으며,
오라클 노드가 해당 Job을 실행하고 서명한 결과값을 이 계정에 기록합니다.

```
Pull Feed 계정 (온체인 Solana 계정)
  ├─ pubkey: <피드 주소>          ← MasterPolicy.oracle_feed에 저장하는 값
  ├─ jobs: [ OracleJob, ... ]    ← 데이터 fetch/변환 파이프라인 정의
  ├─ queue: <큐 주소>             ← 어느 오라클 네트워크가 처리할지
  ├─ latest_value: <최신값>       ← 마지막으로 기록된 오라클 결과
  └─ latest_slot: <슬롯>          ← 기록 시점 (staleness 판별용)
```

`MasterPolicy.oracle_feed`에 넣는 주소는 **이 Pull Feed 계정의 pubkey**입니다.
계정을 먼저 생성(1회)하고, 그 주소를 `create_master_policy` 파라미터로 전달합니다.

### Job이란

**Job**은 오라클 노드가 실행할 데이터 수집·변환 파이프라인입니다.
`OracleJob`은 순서가 있는 task 배열로 구성되며, 각 task의 출력이 다음 task의 입력이 됩니다.

이 프로젝트에서 사용하는 Job 예시 (`02-feed-create.ts`):

```
task[0]: httpTask  — AviationStack API 호출
         URL: https://api.aviationstack.com/v1/flights
              ?access_key=<API_KEY>&flight_iata=KE017

task[1]: jsonParseTask — 응답 JSON에서 출발 지연(분) 추출
         path: "$.data[0].departure.delay"
         예: 127 (분)

task[2]: divideTask(10) — 10으로 나눔 (정수 나눗셈 = 내림 효과)
         예: 12

task[3]: multiplyTask(10) — 10을 곱해 분 단위로 복원
         예: 120 (분)
```

최종 출력값 `120`이 온체인에 기록되고, `check_oracle_and_resolve_flight`에서
`delay_minutes = 120`으로 읽힙니다.

> **HTTPS 필수**: Switchboard 오라클 노드는 보안상 HTTPS 엔드포인트만 허용합니다.
> AviationStack 무료 플랜은 HTTP만 지원하므로 **유료 플랜** 또는 **HTTPS 프록시**
> (예: Cloudflare Worker)가 필요합니다.

**중요**: Job 정의(API 키 포함)는 Crossbar 서버(IPFS)에 저장되므로 사실상 공개됩니다.
무료 AviationStack 키는 문제없지만, 유료 키는 Switchboard Secrets 기능 사용을 권장합니다.

### 오라클 네트워크 동작 방식

Switchboard On-Demand는 **Pull 방식**입니다. 누군가 업데이트를 요청할 때만 오라클 노드가
동작합니다(Push 방식인 Chainlink와 다름).

```
1. 업데이트 요청 (백엔드 daemon 또는 누구나)
        │
        ▼
2. Crossbar API 호출
   POST https://crossbar.switchboard.xyz/updates/solana/{queue}/{feed_pubkey}
        │
        ▼ (Crossbar가 여러 오라클 노드에 요청)
3. 오라클 노드들이 Job 실행
   - AviationStack API 호출
   - JSON 파싱 + 수학 변환
   - 결과에 Ed25519 서명
        │
        ▼
4. Crossbar가 서명된 결과 집계 후 응답
   - instructions[0]: Ed25519 서명 검증 instruction
   - instructions[1]: verified_update instruction (feed 계정 갱신)
   - luts: Address Lookup Tables (계정 목록 압축용)
        │
        ▼
5. 백엔드가 3-instruction v0 트랜잭션 전송
   [Ed25519 검증, verified_update, check_oracle_and_resolve_flight]
        │
        ▼
6. 온체인 검증 (QuoteVerifier)
   - ix[0]의 Ed25519 서명이 Switchboard 오라클 노드 키로 서명됐는지 확인
   - staleness: 현재 슬롯 - oracle 슬롯 ≤ 150 슬롯 (≈ 60–90초)
   - 검증 통과 시 feed 값을 신뢰하고 FlightPolicy 상태 확정
```

### 왜 3개의 instruction인가

Switchboard On-Demand의 보안 모델은 **동일 트랜잭션 내 instruction 참조**에 의존합니다.

```
ix[0]: Ed25519Program.verify(오라클_서명, 오라클_데이터)
         ↑ 이 instruction이 존재하면 Solana 런타임이 서명을 검증함

ix[1]: switchboard::verified_update(feed_account)
         ↑ ix[0]에서 검증된 서명이 Switchboard 오라클 노드 키임을 확인
         ↑ feed 계정의 latest_value, latest_slot 갱신

ix[2]: check_oracle_and_resolve_flight
         ↑ QuoteVerifier.verify_instruction_at(0)으로 ix[0]을 참조
         ↑ "이 트랜잭션에서 Ed25519 검증이 통과됐다"는 사실을 신뢰
         ↑ 직접 인터넷 호출 없이 오라클 값을 온체인에서 검증
```

트랜잭션이 원자적(atomic)이므로, ix[0]의 서명 검증이 실패하면 트랜잭션 전체가 실패합니다.
이것이 탈중앙화 신뢰 모델의 핵심입니다.

### oracle_feed 주소를 어떻게 얻는가

Feed 계정은 **최초 1회 생성**해야 합니다. 동일한 항공편이라도 MasterPolicy마다 별도 Feed를
생성할 수도 있고, 여러 MasterPolicy가 같은 Feed를 공유할 수도 있습니다.

내부적으로 `02-feed-create.ts`는 다음 두 단계를 수행합니다:

1. `CrossbarClient.storeOracleFeed(feed)` — Job 정의를 Crossbar(IPFS)에 업로드
   - 반환: `{ cid, feedId }` where `feedId = sha256(OracleFeed_bytes)`
2. `PullFeed.initIx({ feedHash: Buffer.from(feedId) })` — 온체인 계정 생성
   - `feedId`가 온체인 `feedHash`로 저장됨 → Switchboard UI·오라클 노드가 이 값으로 조회

```bash
# devnet Feed 생성 스크립트 실행
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
yarn demo:2-feed-create
```

실행 결과:
```
=== Feed 생성 완료 ===
Tx             : 3s335FL2...
Feed Pubkey    : 278oAt1RBQLZAVfx35qYEjuhiH29nJmGpmzpKCVtDZTs   ← MasterPolicy에 등록할 주소
IPFS CID       : bafkreid7ayyw...
Feed ID        : 0xabc123...
항공편         : KE017
```

생성된 `Feed Pubkey`가 `oracle_feed` 파라미터에 들어가는 값이며,
`.state.json`에 `feedPubkey`, `feedCid`, `feedHash`로 저장되어 `03-master-setup`에서 자동으로 읽힙니다.

```typescript
// create_master_policy 호출 시
await program.methods.createMasterPolicy({
  oracleFeed: new PublicKey("278oAt1RBQLZAVfx35qYEjuhiH29nJmGpmzpKCVtDZTs"),
  // ...
})
```

### Feed 재사용 가능 여부

| 상황 | 권장 |
|---|---|
| 같은 항공편(KE017), 다른 MasterPolicy | ✅ 재사용 가능 |
| 항공편 코드가 다른 경우 | ❌ 별도 Feed 생성 필요 (Job의 URL이 다름) |
| 테스트 환경과 프로덕션 | ❌ 별도 생성 (devnet Feed는 mainnet에서 무효) |

Feed는 온체인 계정이므로 생성 시 약 0.01–0.05 SOL의 렌트 비용이 발생합니다.

---

## 공통 개념

### 계정 구조

```
MasterPolicy  PDA: ["master_policy", leader, master_id_le8]
FlightPolicy  PDA: ["flight_policy", master_policy, child_policy_id_le8]
```

`MasterPolicy`에는 Track B용 Switchboard 피드 주소가 저장됩니다.

```
MasterPolicy.oracle_feed
  - Track B master: Switchboard Pull Feed 계정 주소
  - Track A master: Pubkey::default() (오라클 없음)
```

### FlightPolicy 상태 머신 (Track A / B 공통)

```
Issued / AwaitingOracle
        │
        │  [oracle instruction]
        │  Track A: resolve_flight_delay (Leader/Operator 서명)
        │  Track B: check_oracle_and_resolve_flight (누구나 호출)
        │
   ┌────┴─────────┐
   ▼              ▼
Claimable      NoClaim
(payout > 0)  (payout = 0)
   │              │
   ▼              ▼
  Paid          Expired
(settle_       (settle_
 flight_        flight_
 claim)         no_claim)
```

### 티어드 지급 구조

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
DELAY_THRESHOLD_MIN        = 120   // 최소 지급 기준 (분)
ORACLE_MAX_STALENESS_SLOTS = 150   // Track B: 약 60–90초 이내 데이터만 유효
MAX_MASTER_PARTICIPANTS    = 8
```

---

## Track A — Trusted Resolver

### 개념

Leader 또는 Operator가 AviationStack API에서 직접 데이터를 가져와 온체인
`resolve_flight_delay`를 호출합니다. 오라클 데이터의 진위는 서명 주체(Leader/Operator)의
신뢰에 의존합니다. `cancelled = true` 전달로 결항 처리도 가능합니다.

```
AviationStack API
       │
       ▼
  oracle-resolve.ts
  (off-chain 집계)
       │
       ▼
resolve_flight_delay  ← Leader 또는 Operator 서명 필수
  (delay_minutes, cancelled)
  ├─ payout > 0  → FlightPolicy: Claimable
  └─ payout = 0  → FlightPolicy: NoClaim
       │
  ┌────┴────┐
  ▼         ▼
settle_    settle_
flight_    flight_
claim      no_claim
```

### Accounts 구조

```rust
pub struct ResolveFlightDelay<'info> {
    pub resolver: Signer<'info>,          // leader 또는 operator만 가능
    pub master_policy: Account<'info, MasterPolicy>,
    pub flight_policy: Account<'info, FlightPolicy>,  // mut
}
```

### 사전 조건

1. `MasterPolicy` 가 `Active` 상태
2. `FlightPolicy` 가 `Issued` 또는 `AwaitingOracle` 상태
3. `resolver` 가 `master.leader` 또는 `master.operator`와 일치
4. `AVIATIONSTACK_API_KEY` 환경변수 설정 (oracle daemon 또는 스크립트)

### 실행 방법

```bash
# devnet
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
yarn demo:5a-resolve

# 특정 날짜 / FlightPolicy 지정
AVIATIONSTACK_API_KEY=<키> \
FLIGHT_NO=KE017 \
FLIGHT_DATE=2026-02-27 \
CHILD_POLICY_ID=1 \
yarn demo:5a-resolve
```

### 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `AVIATIONSTACK_API_KEY` | ✅ | AviationStack API 키 |
| `FLIGHT_NO` | — | 항공편 코드 (기본값: state.json의 마지막 FlightPolicy) |
| `FLIGHT_DATE` | — | 날짜 `YYYY-MM-DD` (기본값: FlightPolicy의 departure_ts) |
| `CHILD_POLICY_ID` | — | 처리할 FlightPolicy ID (기본값: 마지막 생성 항목) |
| `ANCHOR_PROVIDER_URL` | — | RPC 엔드포인트 (기본값: `http://localhost:8899`) |
| `PROGRAM_ID` | — | 프로그램 ID override |

---

## Track B — Switchboard On-Demand

### 개념

Switchboard 오라클 네트워크가 AviationStack API를 직접 호출하여 결과를 온체인 Pull Feed
계정에 서명·기록합니다. `check_oracle_and_resolve_flight`는 동일 트랜잭션 내의 Switchboard
인스트럭션을 온체인에서 암호학적으로 검증한 뒤 `FlightPolicy`의 상태를 직접 확정합니다.

- **누구나 호출 가능** (trustless — 서명 검증이 온체인에서 이루어짐)
- **결항 처리 불가**: Switchboard 피드는 숫자만 반환하므로 `cancelled`는 `false` 고정.
  실제 결항 건은 Track A `resolve_flight_delay(cancelled=true)`로 처리.

```
AviationStack API
       │
       ▼  (Switchboard oracle 노드가 호출)
Pull Feed 계정 (MasterPolicy.oracle_feed)
  ← 온체인 기록 + 암호학적 서명
       │
       ▼
check_oracle_and_resolve_flight (3-ix 트랜잭션 필수)
  ├─ payout > 0  → FlightPolicy: Claimable
  └─ payout = 0  → FlightPolicy: NoClaim
       │
  ┌────┴────┐
  ▼         ▼
settle_    settle_
flight_    flight_
claim      no_claim
```

### 3-인스트럭션 트랜잭션 구조

`check_oracle_and_resolve_flight`는 반드시 같은 트랜잭션의 인덱스 2에 위치해야 합니다.
컨트랙트 내부에서 `verify_instruction_at(0)`으로 인덱스 0의 서명 검증 인스트럭션을 참조합니다.

```
트랜잭션 인스트럭션 순서 (필수):
  [0] Ed25519 서명 검증   ← Switchboard가 생성
  [1] verified_update     ← Switchboard가 생성
  [2] check_oracle_and_resolve_flight  ← 우리 프로그램
```

v0 트랜잭션(Address Lookup Table 포함)으로 전송해야 합니다.

### Accounts 구조

```rust
pub struct CheckOracleAndResolveFlight<'info> {
    pub payer: Signer<'info>,                   // mut — 누구나 호출 가능
    pub master_policy: Account<'info, MasterPolicy>,
    pub flight_policy: Account<'info, FlightPolicy>,  // mut
    /// CHECK: master_policy.oracle_feed와 일치 여부를 handler에서 검증
    pub oracle_feed: UncheckedAccount<'info>,
    /// CHECK: address = default_queue() (Switchboard 기본 큐)
    pub queue: UncheckedAccount<'info>,
    pub slot_hashes: Sysvar<'info, SlotHashes>,
    pub instructions: Sysvar<'info, Instructions>,
}
```

### Handler 검증 순서

1. `master.status == Active`
2. `oracle_feed.key() == master.oracle_feed`
3. `flight.master == master.key()`
4. `flight.status == AwaitingOracle || Issued`
5. `QuoteVerifier` — staleness ≤ `ORACLE_MAX_STALENESS_SLOTS` (150 slots ≈ 60–90s)
6. 피드 값 파싱: `scale == 0`, `mantissa ≥ 0`, `mantissa ≤ u16::MAX` → `delay_minutes`

### MasterPolicy에 oracle_feed 등록

Track B를 사용하려면 `create_master_policy` 호출 시 `oracle_feed` 파라미터에 Switchboard
Pull Feed 주소를 지정해야 합니다.

```typescript
await program.methods
  .createMasterPolicy({
    // ... 기타 파라미터 ...
    oracleFeed: feedPubkey,   // Track B: Switchboard Pull Feed 주소
                              // Track A: PublicKey.default() (오라클 없음)
  })
  .accounts({ ... })
  .rpc();
```

### oracle daemon 자동화 (백엔드)

`backend/src/oracle/track_b.rs`가 cron 스케줄(기본: 15분)에 따라 자동으로 실행됩니다.

```
scan FlightPolicy (AwaitingOracle | Claimable | NoClaim)
  │
  ├─ AwaitingOracle: departure_ts 지난 경우만 처리
  │    1. MasterPolicy 조회 → oracle_feed 추출
  │    2. Switchboard Crossbar API에서 서명된 oracle update 수신
  │    3. [Ed25519, verified_update, check_oracle_and_resolve_flight] v0 tx 전송
  │    4. FlightPolicy 재조회 → settle
  │
  └─ Claimable / NoClaim: oracle 완료, settle 재시도
       → settle_flight_claim 또는 settle_flight_no_claim
```

`Claimable`/`NoClaim` 상태를 scan에 포함하는 이유: `check_oracle_and_resolve_flight`는
성공했지만 후속 settle 트랜잭션이 실패하면 해당 상태에 고착될 수 있습니다.
다음 사이클에서 자동으로 재시도합니다.

### 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `SWITCHBOARD_QUEUE` | ✅ | Switchboard 큐 주소 (devnet: `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7`) |
| `ANCHOR_PROVIDER_URL` | — | devnet RPC (`https://api.devnet.solana.com`) |
| `AVIATIONSTACK_API_KEY` | — | Feed 생성 시 필요 (oracle 노드 실행 시) |

---

## Settlement — Track A / B 공용

두 트랙은 동일한 settlement instruction을 사용합니다.

### settle_flight_claim (Claimable → Paid)

```rust
pub struct SettleFlightClaim<'info> {
    pub executor: Signer<'info>,            // leader 또는 operator
    pub master_policy: Account<'info, MasterPolicy>,
    pub flight_policy: Account<'info, FlightPolicy>,  // mut
    pub leader_deposit_token: InterfaceAccount<'info, TokenAccount>,  // mut
    pub reinsurer_pool_token: InterfaceAccount<'info, TokenAccount>,  // mut
    pub token_program: Interface<'info, TokenInterface>,
    // remaining_accounts: participant pool_wallet 목록 (mut)
}
```

### settle_flight_no_claim (NoClaim → Expired)

```rust
pub struct SettleFlightNoClaim<'info> {
    pub executor: Signer<'info>,            // leader 또는 operator
    pub master_policy: Account<'info, MasterPolicy>,
    pub flight_policy: Account<'info, FlightPolicy>,  // mut
    pub leader_deposit_token: InterfaceAccount<'info, TokenAccount>,  // mut
    pub reinsurer_deposit_token: InterfaceAccount<'info, TokenAccount>,  // mut
    pub token_program: Interface<'info, TokenInterface>,
    // remaining_accounts: participant deposit_wallet 목록 (mut)
}
```

---

## 두 트랙 비교

| 항목 | Track A (Trusted Resolver) | Track B (Switchboard On-Demand) |
|---|---|---|
| **신뢰 모델** | Leader/Operator 신뢰 | 암호학적 검증 (탈중앙화) |
| **oracle instruction** | `resolve_flight_delay` | `check_oracle_and_resolve_flight` |
| **대상 계정** | `FlightPolicy` | `FlightPolicy` |
| **서명 요건** | Leader 또는 Operator | 누구나 (trustless) |
| **결항 처리** | `cancelled=true` 파라미터 | 불가 (숫자 피드만) |
| **tx 구조** | 일반 트랜잭션 | v0 트랜잭션 (3 instructions + LUT) |
| **네트워크** | localnet / devnet / mainnet | devnet 이상 필수 |
| **oracle_feed** | `MasterPolicy.oracle_feed = Pubkey::default()` | Switchboard Pull Feed 주소 |
| **자동화** | oracle daemon Track A | oracle daemon Track B |

---

## AviationStack API 제약사항

| 플랜 | `flight_date` 필터 | HTTPS | 월 요청 수 |
|---|---|---|---|
| 무료 | ❌ (유료 전용) | ❌ (HTTP만) | 100회 |
| 유료 | ✅ | ✅ | 플랜별 상이 |

**무료 플랜 사용 시 동작:**
- `flight_date` 파라미터를 URL에 포함하면 `function_access_restricted` 오류
- 날짜 필터링은 클라이언트 측(`flight-api.ts`)에서 응답 데이터 기준으로 처리
- 실시간 운항 데이터만 조회 가능 (과거 항공편 이력 조회 불가)

---

## 전체 스크립트 실행 순서

### Track A (Master/Flight + Trusted Resolver)

```bash
cd contract

# 1. 초기 셋업 (최초 1회)
yarn demo:1-setup

# 2. MasterPolicy 생성 (oracle_feed = Pubkey::default())
yarn demo:3-master-setup

# 3. FlightPolicy 생성
FLIGHT_NO=KE017 yarn demo:4-flight-create

# 4. 오라클 해소 (AviationStack API → resolve_flight_delay)
AVIATIONSTACK_API_KEY=<키> FLIGHT_NO=KE017 yarn demo:5a-resolve

# 5. 정산
yarn demo:6-settle
```

### Track B (Master/Flight + Switchboard On-Demand)

```bash
cd contract

# 1. 초기 셋업 (최초 1회)
yarn demo:1-setup

# 2. Switchboard Pull Feed 생성 (1회, feedPubkey가 .state.json에 저장됨)
AVIATIONSTACK_API_KEY=<키> FLIGHT_NO=KE017 yarn demo:2-feed-create

# 3. MasterPolicy 생성 (oracle_feed = 위에서 얻은 feedPubkey 자동 적용)
yarn demo:3-master-setup

# 4. FlightPolicy 생성
FLIGHT_NO=KE017 yarn demo:4-flight-create

# 5. Switchboard oracle → check_oracle_and_resolve_flight (수동 트리거)
yarn demo:5b-claim
#    또는 backend daemon이 15분 주기로 자동 처리:
#    cd ../backend && cargo run

# 6. 정산
yarn demo:6-settle
```
