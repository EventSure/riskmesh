# Backend 구조 및 로직 설명

## 개요

이 백엔드는 **Solana 오라클 데몬(Oracle Daemon)**이다.
비행 지연 보험 정책을 주기적으로 스캔하여, 출발 시간이 지난 정책에 대해 외부 API에서 실제 지연 데이터를 가져온 뒤 온체인 트랜잭션을 발행하는 역할을 한다.

두 가지 독립적인 오라클 경로(Track A, Track B)를 하나의 비동기 프로세스에서 운용한다.

---

## 디렉터리 구조

```
backend/
├── Cargo.toml              # Rust 의존성 및 바이너리 설정
├── .env.example            # 환경 변수 템플릿
├── docs/
│   ├── e2e-workflow.md     # E2E 운용 가이드
│   └── backend-overview.md # 이 문서
└── src/
    ├── main.rs             # 진입점 (tokio async main)
    ├── config.rs           # .env → Config 구조체 로딩
    ├── scheduler.rs        # 크론 기반 스케줄러
    ├── flight_api.rs       # AviationStack HTTP 클라이언트
    ├── switchboard.rs      # Switchboard On-Demand 오라클 클라이언트
    ├── oracle/
    │   ├── mod.rs          # 모듈 export
    │   ├── track_a.rs      # Track A: AviationStack 오라클 파이프라인
    │   └── track_b.rs      # Track B: Switchboard 오라클 파이프라인
    └── solana/
        ├── mod.rs          # 어카운트 discriminator 및 상태 상수
        ├── client.rs       # Solana RPC 클라이언트 래퍼
        └── pda.rs          # PDA 주소 도출 함수들
```

---

## 설정 (`config.rs`)

`.env` 파일 또는 환경 변수에서 값을 읽어 `Config` 구조체를 만든다.

| 환경 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `RPC_URL` | 아니오 | `https://api.devnet.solana.com` | Solana RPC 엔드포인트 |
| `PROGRAM_ID` | **예** | — | 배포된 RiskMesh 프로그램 ID |
| `LEADER_KEYPAIR_PATH` | 아니오 | `~/.config/solana/id.json` | 리더 키페어 파일 경로 |
| `LEADER_PUBKEY` | **예** | — | 리더 공개키 |
| `AVIATIONSTACK_API_KEY` | 아니오 | (없음) | Track A 전용 API 키 |
| `SWITCHBOARD_QUEUE` | **예** | — | Switchboard 큐 주소 |
| `ORACLE_CHECK_CRON` | 아니오 | `0 */15 * * * *` | 실행 주기 (6-field cron) |
| `RUST_LOG` | 아니오 | `info` | 로그 레벨 |

---

## 실행 흐름

### 1. 진입점 (`main.rs`)

```
[main]
  → Config::from_env() 로드
  → 스케줄러 시작 (scheduler::start)
  → 영구 루프 (프로세스 유지)
```

### 2. 스케줄러 (`scheduler.rs`)

크론 표현식(`ORACLE_CHECK_CRON`)에 따라 `run_oracle_check()`를 주기적으로 실행한다.
기본값은 15분마다 한 번.

```
[run_oracle_check]
  1. 리더 키페어 파일을 읽어 Keypair 로드
  2. Track B 실행 → 활성 Policy 스캔 후 처리
  3. Track A 실행 → 활성 FlightPolicy 스캔 후 처리
  4. 개별 에러는 로그만 남기고 계속 진행
```

---

## Track A: AviationStack 오라클

> **대상 계정:** `FlightPolicy` (status = `Issued` 또는 `AwaitingOracle`)
> **외부 API:** AviationStack HTTP API
> **트랜잭션:** `resolve_flight_delay` 인스트럭션 (레거시)

### 파이프라인

```
[track_a::run_oracle_check]
  ↓
scan_active_flight_policies()
  → get_program_accounts(FLIGHT_POLICY discriminator)
  → borsh 디코딩으로 flight_no, departure_ts, status 파싱
  → status == Issued(0) 또는 AwaitingOracle(1) 만 필터링
  ↓
각 FlightPolicy 에 대해 track_a::run() 실행
  ↓
시간 체크: now < departure_ts → 건너뜀
  ↓
flight_api::fetch_flight_delay(flight_no)
  → AviationStack API 호출
  → 지연 분수 (10분 단위 내림), 취소 여부 반환
  ↓
resolve_flight_delay 인스트럭션 빌드
  → discriminator: sha256("global:resolve_flight_delay")[..8]
  → data: discriminator + delay_minutes(u16 LE) + cancelled(u8)
  → accounts: [resolver(signer), master_policy, flight_policy(writable)]
  ↓
레거시 트랜잭션 전송
```

### AviationStack API (`flight_api.rs`)

- 엔드포인트: `http://api.aviationstack.com/v1/flights`
- 쿼리 파라미터: `access_key`, `flight_iata`, `limit`
- 음수 지연 → 0으로 클램핑
- 10분 단위로 내림 (`delay_min / 10 * 10`)
- 데이터 없으면 `None` 반환

---

## Track B: Switchboard 오라클

> **대상 계정:** `Policy` (state = `Active`, leader == 내 리더 pubkey)
> **외부 API:** Switchboard Crossbar API
> **트랜잭션:** `check_oracle_and_create_claim` 인스트럭션 (v0, LUT 포함)

### 파이프라인

```
[track_b::run_oracle_check]
  ↓
scan_active_policies()
  → get_program_accounts(POLICY discriminator)
  → borsh 디코딩으로 policy_id, leader, oracle_feed, departure_date, state 파싱
  → state == Active(3) AND leader == config.leader_pubkey 만 필터링
  ↓
각 Policy 에 대해 track_b::run() 실행
  ↓
시간 체크: now < departure_date → 건너뜀
  ↓
switchboard::fetch_oracle_update(queue, oracle_feed)
  → Crossbar API POST 호출
  → Ed25519 서명 검증 인스트럭션 + verified_update 인스트럭션 반환
  → LUT(Address Lookup Table) 계정 로드
  ↓
oracle_round = get_slot()
Claim PDA 도출: ["claim", policy, oracle_round_le8]
  ↓
check_oracle_and_create_claim 인스트럭션 빌드
  → discriminator: sha256("global:check_oracle_and_create_claim")[..8]
  → data: discriminator + oracle_round(u64 LE)
  → accounts: [policy(writable), claim(writable), payer(signer,writable),
               oracle_feed, queue, slot_hashes_sysvar, instructions_sysvar,
               system_program]
  ↓
v0 트랜잭션 전송 (3개 인스트럭션 순서 중요!)
  1. Ed25519 서명 검증 IX
  2. Switchboard verified_update IX
  3. check_oracle_and_create_claim IX
```

### Switchboard Crossbar API (`switchboard.rs`)

- 엔드포인트: `POST https://crossbar.switchboard.xyz/updates/solana/{queue}/{feed_pubkey}`
- 응답: base64 인코딩된 인스트럭션 2개 + LUT 주소 목록 + 오라클 값(f64)
- 인스트럭션은 bincode로 역직렬화
- LUT는 온체인에서 실제 계정 데이터를 로드하여 사용

> **중요:** Track B 트랜잭션은 반드시 위 3개 인스트럭션이 **이 순서 그대로** 하나의 트랜잭션에 포함되어야 온체인 프로그램이 유효성을 검증할 수 있다.

---

## Solana 유틸리티

### 어카운트 Discriminator (`solana/mod.rs`)

Anchor가 어카운트 타입을 식별하는 8바이트 해시:

| 어카운트 | Discriminator | 계산 방식 |
|---|---|---|
| `Policy` | `[222, 135, 7, 163, 235, 177, 33, 68]` | `sha256("account:Policy")[..8]` |
| `FlightPolicy` | `[53, 42, 54, 221, 74, 119, 109, 25]` | `sha256("account:FlightPolicy")[..8]` |

### PDA 도출 (`solana/pda.rs`)

| PDA | 시드 |
|---|---|
| `policy_pda` | `["policy", leader, policy_id_le8]` |
| `claim_pda` | `["claim", policy, oracle_round_le8]` |
| `underwriting_pda` | `["underwriting", policy]` |
| `risk_pool_pda` | `["pool", policy]` |
| `master_policy_pda` | `["master_policy", leader, master_id_le8]` |
| `flight_policy_pda` | `["flight_policy", master_policy, child_id_le8]` |

### RPC 클라이언트 (`solana/client.rs`)

Solana `RpcClient`의 래퍼. commitment level = `Confirmed`.

| 메서드 | 설명 |
|---|---|
| `get_account(pubkey)` | 어카운트 데이터 조회 |
| `get_slot()` | 현재 슬롯 번호 조회 |
| `send_transaction(ixs, signer)` | 레거시 트랜잭션 전송 |
| `send_v0_transaction(ixs, luts, signer)` | LUT 포함 v0 트랜잭션 전송 |
| `get_program_accounts_filtered(...)` | memcmp 필터로 프로그램 어카운트 조회 |

---

## 어카운트 데이터 파싱 방식

온체인 어카운트 데이터는 **Borsh** 형식으로 직렬화되어 있다.
파싱 순서는 Anchor 프로그램의 구조체 정의 순서와 동일해야 한다.

```
[8 bytes]  Anchor discriminator (건너뜀)
[8 bytes]  policy_id / child_policy_id (u64 LE)
[32 bytes] leader / master_policy / creator (Pubkey)
...
[4 bytes]  문자열 길이 (u32 LE)
[N bytes]  문자열 데이터 (UTF-8)
...
[8 bytes]  타임스탬프 (i64 LE)
[2 bytes]  u16 필드 (LE)
[1 byte]   bool / u8 상태값
```

---

## 주요 상태 상수

| 상수 | 값 | 의미 |
|---|---|---|
| `POLICY_STATE_ACTIVE` | 3 | Policy가 활성 상태 |
| `FLIGHT_POLICY_STATUS_ISSUED` | 0 | FlightPolicy 발행됨 |
| `FLIGHT_POLICY_STATUS_AWAITING_ORACLE` | 1 | 오라클 응답 대기 중 |
| `DELAY_THRESHOLD_MIN` | 120 | 클레임 발생 기준 지연 시간 (분) |

---

## 전체 흐름 요약

```
┌─────────────────────────────────────────────────────────────┐
│  스케줄러 (15분마다)                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────▼─────────────┐
              │   run_oracle_check()      │
              │   (키페어 로드 → 트랙 실행) │
              └──────┬───────────┬────────┘
                     │           │
          ┌──────────▼───┐ ┌─────▼──────────┐
          │   Track B    │ │   Track A       │
          │ Switchboard  │ │ AviationStack   │
          └──────┬───────┘ └─────┬───────────┘
                 │               │
       ┌─────────▼───────────────▼─────────┐
       │  get_program_accounts 로 정책 스캔  │
       │  departure_ts/date 시간 체크        │
       └─────────┬───────────────┬──────────┘
                 │               │
     ┌───────────▼──┐ ┌──────────▼────────────┐
     │ Crossbar API  │ │ AviationStack API      │
     │ (오라클 IX 2개 │ │ (지연 분수, 취소 여부)  │
     │ + LUT 반환)   │ │                        │
     └───────────┬──┘ └──────────┬─────────────┘
                 │               │
     ┌───────────▼──────────────▼─────────────┐
     │  온체인 인스트럭션 빌드 + 트랜잭션 전송    │
     │  Track B: v0 (LUT 포함, 3개 IX)          │
     │  Track A: 레거시 (1개 IX)                │
     └──────────────────────────────────────────┘
```

---

## 의존성 요약

| 크레이트 | 용도 |
|---|---|
| `solana-client` / `solana-sdk` | Solana RPC, 트랜잭션, 키 타입 |
| `tokio` | 비동기 런타임 |
| `tokio-cron-scheduler` | 크론 스케줄링 |
| `reqwest` | HTTP 클라이언트 (AviationStack, Crossbar) |
| `borsh` | 온체인 어카운트 데이터 역직렬화 |
| `bincode` | Crossbar 응답 인스트럭션 역직렬화 |
| `sha2` | Anchor discriminator 계산 |
| `serde` / `serde_json` | JSON 처리 |
| `base64` | Crossbar 응답 디코딩 |
| `dotenv` | .env 파일 로딩 |
| `tracing` | 구조적 로깅 |
| `anyhow` | 에러 핸들링 |
| `shellexpand` | `~` 경로 확장 |
