# End-to-End 운영 가이드

백엔드 데몬(`backend/`)을 포함한 실제 운영 워크플로우 전체를 설명합니다.
데모 스크립트로 온체인 상태를 셋업한 뒤, 백엔드 데몬이 오라클 체크부터 정산까지 자동으로 처리합니다.

---

## 자동화 범위

| 단계 | Track A | Track B |
|---|---|---|
| 초기 셋업 (MasterPolicy / Policy 생성~활성화) | **수동** (최초 1회) | **수동** (매 Policy마다) |
| 보험 가입 (FlightPolicy 생성) | **수동** (건당 1회) | — |
| 오라클 조회 + resolve | **데몬 자동** | **데몬 자동** |
| 승인 (approve_claim) | — | **데몬 자동** |
| 정산 (settle) | **데몬 자동** | **데몬 자동** |
| 만료 처리 (expire / refund) | — | **수동** |

---

## 아키텍처 요약

```
[운영자]
  ├─ TS 스크립트 (contract/scripts/)   ← 초기 셋업 / 보험 가입
  └─ Rust 백엔드 데몬 (backend/)       ← 오라클 체크 + 정산 자동화 (cron)
       ├─ Track A: AviationStack → resolve_flight_delay → settle
       └─ Track B: Switchboard   → check_oracle → approve_claim → settle_claim
```

Track A (Master/Flight Policy)와 Track B (단독 Policy + Switchboard)는 독립적으로 동작합니다.
실제 운영에서는 두 Track 모두 같은 데몬 프로세스 하나가 처리합니다.

---

## 0. 사전 준비

### 0-1. 환경 요구사항

| 항목 | 버전 / 비고 |
|---|---|
| Rust | 1.84+ (host) |
| Node.js | 18+ |
| Yarn | 1.x |
| Solana CLI | 2.x |
| AviationStack API 키 | Track A 전용. 무료 플랜: 실시간만, 유료 플랜: 과거 데이터 |
| Switchboard 계정 | Track B 전용. devnet queue: `FDPU9SHFSBCXNFHtY3DW8EkFQjeBH6vZwqHqFfxNWZkM` |

### 0-2. 온체인 프로그램 배포 확인

```bash
solana config set --url devnet
solana program show BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7
```

프로그램이 없으면 먼저 배포:
```bash
cd contract
anchor build
anchor deploy --provider.cluster devnet
```

### 0-3. 리더 지갑 준비

```bash
# 새 지갑 생성 (이미 있으면 스킵)
solana-keygen new -o ~/.config/solana/id.json

# devnet SOL 에어드롭
solana airdrop 2 --url devnet
```

### 0-4. 백엔드 .env 작성

```bash
cd backend
cp .env.example .env
```

`.env`를 열어 아래 항목을 채웁니다:

```dotenv
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=BXxqMY3f9y7dzvoQWJjhX95GMEyuRjD61kgfgherhSX7
LEADER_KEYPAIR_PATH=~/.config/solana/id.json
LEADER_PUBKEY=<리더 pubkey>   # solana-keygen pubkey

# Track A
AVIATIONSTACK_API_KEY=<발급받은 API 키>

# Track B
SWITCHBOARD_QUEUE=FDPU9SHFSBCXNFHtY3DW8EkFQjeBH6vZwqHqFfxNWZkM

# 실행 주기 (cron, 6필드: sec min hour dom month dow)
ORACLE_CHECK_CRON=0 */15 * * * *   # 15분마다 (기본값)
```

---

## Track A — Master/Flight Policy (AviationStack 연동)

### 흐름 개요

```
[수동] 1. master-setup  →  MasterPolicy 온체인 생성 & Active (최초 1회)
[수동] 2. flight-create →  FlightPolicy 생성 + 프리미엄 이체 (건당 1회)
                            status: Issued → AwaitingOracle
[자동] 3. 데몬          →  AviationStack 조회 → resolve_flight_delay
                            status: AwaitingOracle → Claimable 또는 NoClaim
[자동] 4. 데몬          →  settle_flight_claim 또는 settle_flight_no_claim
                            status: Paid 또는 Expired
```

### Step 1. MasterPolicy 셋업 (수동, 최초 1회)

```bash
cd contract
yarn install
yarn demo:master-setup
```

완료 후 `contract/scripts/.state.json`에 아래 정보가 저장됩니다:
- `mint` — SPL 토큰 mint 주소
- `masterId`, `masterPda` — MasterPolicy ID / PDA
- `leaderKey`, `leaderAta`, `leaderDepositWallet`, `leaderPoolWallet` 등

> MasterPolicy는 한 번만 생성하며, 모든 FlightPolicy가 이를 공유합니다.
> 이미 Active 상태이면 자동으로 스킵됩니다.

리더 키페어가 자동으로 `~/.config/solana/riskmesh-leader.json`에 저장됩니다.
백엔드 `.env`의 `LEADER_KEYPAIR_PATH`를 이 경로로 맞춰주세요.

### Step 2. FlightPolicy 생성 (수동, 건당 1회)

```bash
# 기본 (KE017, ICN-NRT, 2시간 전 출발로 설정)
yarn demo:flight-create

# 실제 항공편 지정
FLIGHT_NO=KE017 ROUTE=ICN-NRT DEPARTURE_TS=1741881600 yarn demo:flight-create
```

`DEPARTURE_TS`는 Unix timestamp(초)입니다. 데몬은 이 값 이후에만 오라클 조회를 실행합니다.

### Step 3. 백엔드 데몬 실행 (자동화)

```bash
cd backend
cargo build --release
RUST_LOG=info ./target/release/oracle-daemon
```

데몬은 `ORACLE_CHECK_CRON` 주기마다 다음을 **완전 자동**으로 수행합니다:

1. `getProgramAccounts`로 `Issued` / `AwaitingOracle` / `Claimable` / `NoClaim` 상태 FlightPolicy 조회
2. `departure_ts` 경과 여부 확인 (이전이면 스킵)
3. AviationStack API 호출 → 지연 분수, 결항 여부 수신
4. `resolve_flight_delay` 전송 → status 결정
5. MasterPolicy 온체인 파싱 → 토큰 계정 주소 획득
6. `settle_flight_claim` (Claimable) 또는 `settle_flight_no_claim` (NoClaim) 전송

로그 예시 (Claimable 케이스):
```
[track_a] KE017 오라클 조회 시작 (FlightPolicy=7xB3...)
[track_a] KE017 지연=150분, 결항=false, 상태=landed
[track_a] KE017 resolve_flight_delay 완료. tx=5fGh...
[track_a] KE017 settle_flight_claim 완료. tx=9kLm...
```

로그 예시 (NoClaim 케이스):
```
[track_a] KE017 지연=30분, 결항=false, 상태=landed
[track_a] KE017 resolve_flight_delay 완료. tx=2aBc...
[track_a] KE017 settle_flight_no_claim 완료. tx=7dEf...
```

> **데몬 재시작 복구:** `Claimable` / `NoClaim` 상태도 scan 대상에 포함되므로,
> 데몬이 resolve 후 settle 전에 중단돼도 다음 실행 시 자동으로 정산을 재시도합니다.

> **수동 resolve (데몬 없이 테스트):**
> ```bash
> AVIATIONSTACK_API_KEY=<키> yarn demo:oracle-resolve
> ```
> resolve만 실행하며, settle은 데몬이 다음 주기에 자동 처리합니다.

---

## Track B — 단독 Policy (Switchboard On-Demand 연동)

### 흐름 개요

```
[수동] 1–5. setup → create-policy → open-uw → accept-shares → activate
            status: Draft → Open → Funded → Active
[수동] 6.   oracle-feed-create  (최초 1회)
[자동] 7.   데몬  →  Switchboard → check_oracle_and_create_claim
                     (delay ≥ 120분이면 status: Claimable, Claim 계정 생성)
[자동] 8.   데몬  →  approve_claim → settle_claim
                     status: Approved → Settled
[수동] 9.   만료 시 expire → refund  (해당하는 경우만)
```

### Step 1–5. 온체인 셋업 (수동)

```bash
cd contract
yarn install

yarn demo:setup           # 1. 키페어 생성, 토큰 민팅
yarn demo:create-policy   # 2. Policy 생성 (Draft)
yarn demo:open-uw         # 3. 언더라이팅 오픈 (Open)
yarn demo:accept-shares   # 4. 지분 수락 (Funded)
yarn demo:activate        # 5. Policy 활성화 (Active)
```

### Step 6. Switchboard Feed 생성 (수동, 최초 1회)

```bash
yarn demo:oracle-feed-create
```

> Policy의 `oracle_feed` 필드가 이 피드 주소와 일치해야 합니다.
> 피드를 먼저 만든 뒤 `create-policy`에서 `feedPubkey`를 지정하거나, 반대로 Policy를 먼저 만든 경우 동일한 피드 주소로 Policy를 재생성해야 합니다.

### Step 7–8. 백엔드 데몬 실행 (자동화)

```bash
cd backend
RUST_LOG=info ./target/release/oracle-daemon
```

데몬은 `ORACLE_CHECK_CRON` 주기마다 다음을 **완전 자동**으로 수행합니다:

1. `Active` 상태 Policy 전체 조회 (리더 pubkey 필터)
2. `departure_date` 경과 여부 확인
3. Switchboard Crossbar에서 서명된 oracle update 수신
4. 3-ix 트랜잭션 전송: `Ed25519` + `verified_update` + `check_oracle_and_create_claim`
5. oracle 값 ≥ 120분이면:
   - `approve_claim` 전송
   - RiskPool에서 vault 주소 온체인 파싱
   - `settle_claim` 전송 (beneficiary = 리더 ATA)

로그 예시:
```
[track_b] Active Policy 1개 발견
[track_b] KE017 오라클 조회 시작 (Policy=3aB4...)
[track_b] KE017 oracle 값: 150분
[track_b] KE017 check_oracle_and_create_claim 완료. tx=9kLm...
[track_b] KE017 approve_claim 완료. tx=2pQr...
[track_b] KE017 settle_claim 완료. tx=8sUv...
```

### Step 9. 만료 처리 (수동, 해당하는 경우만)

Policy가 `active_to` 기한을 넘겼고 Claim이 없는 경우:

```bash
yarn demo:expire   # Policy를 Expired로 전환
yarn demo:refund   # 참여사에게 에스크로 자금 반환
```

---

## 데몬 운영 팁

### 로그 레벨 조정

```bash
RUST_LOG=debug ./target/release/oracle-daemon  # 상세 로그
RUST_LOG=warn  ./target/release/oracle-daemon  # 경고 이상만
```

### 즉시 1회 실행 (테스트)

`.env`의 cron을 매초 실행으로 임시 변경:
```dotenv
ORACLE_CHECK_CRON=* * * * * *
```

### systemd 서비스 등록 (서버 운영)

```ini
# /etc/systemd/system/riskmesh-daemon.service
[Unit]
Description=RiskMesh Oracle Daemon
After=network.target

[Service]
EnvironmentFile=/path/to/backend/.env
ExecStart=/path/to/backend/target/release/oracle-daemon
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now riskmesh-daemon
sudo journalctl -u riskmesh-daemon -f
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `PROGRAM_ID 환경변수 필요` 오류 | `.env` 미설정 | `.env.example` 복사 후 작성 |
| `FlightPolicy 파싱 실패` 경고 | 다른 account 타입이 discriminator 혼재 | 정상 동작, 무시 가능 |
| `AviationStack 조회 실패` | API 키 없음 또는 무료 플랜 과거 데이터 제한 | 유료 플랜 사용 또는 `yarn demo:oracle-resolve` 수동 실행 |
| `Switchboard oracle update 수신 실패` | 피드 주소 불일치 또는 devnet queue 오류 | `yarn demo:oracle-feed-create` 재실행 후 Policy 재생성 |
| `아직 출발 전, 스킵` 로그 | departure_ts가 미래 | 정상 동작. 출발 시각 이후 자동 처리됨 |
| `settle_flight_claim 트랜잭션 실패` | 이미 Paid 상태 (이전 실행에서 완료) | 정상. 온체인 상태가 이미 최종 상태 |
| `approve_claim 트랜잭션 실패` | oracle 값이 임계치 미만으로 Claim 미생성 | 정상. `oracle 값 < 120분` 로그 확인 |
| `키페어 파일 읽기 실패` | `LEADER_KEYPAIR_PATH` 경로 오류 | `~` 경로 지원됨. 절대경로 사용 또는 `master-setup` 재실행 |
