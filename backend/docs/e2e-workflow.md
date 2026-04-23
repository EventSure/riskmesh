# End-to-End 운영 가이드

백엔드 데몬(`backend/`)을 포함한 실제 운영 워크플로우 전체를 설명합니다.
데모 스크립트로 온체인 상태를 셋업한 뒤, 백엔드 데몬이 오라클 체크와 정산을 자동으로 처리하는 흐름입니다.

---

## 아키텍처 요약

```
[운영자]
  ├─ TS 스크립트 (contract/scripts/)   ← 최초 셋업 / 수동 정산
  └─ Rust 백엔드 데몬 (backend/)       ← 오라클 자동 체크 (cron)
       ├─ Track A: AviationStack API → resolve_flight_delay (FlightPolicy)
       └─ Track B: Switchboard On-Demand → check_oracle_and_resolve_flight (FlightPolicy)
```

두 Track 모두 동일한 MasterAgreement + FlightPolicy 계정 구조를 사용합니다.
오라클 방식만 다를 뿐 — Track A는 신뢰된 resolver(서명자 인증), Track B는 Switchboard 암호학적 검증입니다.
실제 운영에서는 두 Track 모두 같은 데몬 프로세스 하나가 처리합니다.

---

## 0. 사전 준비

### 0-1. 환경 요구사항

| 항목 | 버전 / 비고 |
|---|---|
| Rust | 1.84+ (host), 별도 BPF toolchain은 빌드 시 자동 설치 |
| Node.js | 18+ |
| Yarn | 1.x |
| Solana CLI | 2.x |
| AviationStack API 키 | Track A 전용. 무료 플랜: 실시간만, 유료 플랜: 과거 데이터 |
| Switchboard 계정 | Track B 전용. devnet queue: `FDPU9SHFSBCXNFHtY3DW8EkFQjeBH6vZwqHqFfxNWZkM` |

### 0-2. 온체인 프로그램 배포 확인

```bash
# devnet 기준
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
LEADER_KEYPAIR_PATH=~/.config/solana/id.json   # 또는 리더 키페어 경로
LEADER_PUBKEY=<리더 pubkey>                     # solana-keygen pubkey

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
1. master-setup  →  MasterAgreement 온체인 생성 & Active
2. flight-create →  FlightPolicy 생성 + 프리미엄 이체 (status: Issued → AwaitingOracle)
3. [데몬 자동]   →  AviationStack 조회 → resolve_flight_delay
                    (status: AwaitingOracle → Claimable 또는 NoClaim)
4. settle        →  정산 실행 (status: Paid 또는 Expired)
```

### Step 1. MasterAgreement 셋업

```bash
cd contract
yarn install

# 최초 1회 실행 (devnet 상에 MasterAgreement 생성)
yarn demo:master-setup
```

완료 후 `contract/scripts/.state.json`에 아래 정보가 저장됩니다:
- `mint` — SPL 토큰 mint 주소
- `masterId`, `masterPda` — MasterAgreement ID / PDA
- `leaderKey`, `leaderAta`, `leaderDepositWallet`, `leaderPoolWallet` 등

> **참고:** `oracle-master-setup.ts`는 이미 Active 상태인 MasterAgreement가 있으면 자동으로 스킵합니다.
> MasterAgreement는 보통 한 번만 생성하며, 여러 FlightPolicy가 이 MasterAgreement를 공유합니다.

리더 키페어도 자동으로 `~/.config/solana/riskmesh-leader.json`에 저장됩니다.
백엔드 `.env`의 `LEADER_KEYPAIR_PATH`를 이 경로로 맞춰주세요.

### Step 2. FlightPolicy 생성

실제 항공편 한 건마다 한 번 실행합니다.

```bash
# 기본 (KE017, ICN-NRT, 2시간 전 출발로 설정)
yarn demo:flight-create

# 실제 항공편 지정
FLIGHT_NO=KE017 ROUTE=ICN-NRT DEPARTURE_TS=1741881600 yarn demo:flight-create
```

`DEPARTURE_TS`는 Unix timestamp(초)입니다. 데몬은 이 값 이후에만 오라클 조회를 실행합니다.

완료 후 `.state.json`의 `flightPolicies` 배열에 항목이 추가됩니다.

### Step 3. 백엔드 데몬 실행 (Track A 자동화)

```bash
cd backend
cargo build --release
RUST_LOG=info ./target/release/riskmesh-oracle-daemon
```

데몬은 `ORACLE_CHECK_CRON` 주기마다 다음을 수행합니다:
1. `getProgramAccounts`로 `Issued` / `AwaitingOracle` 상태 FlightPolicy 전체 조회
2. 각 항공편의 `departure_ts`가 지났는지 확인 (이전이면 스킵)
3. AviationStack API 호출 → 지연 분수, 결항 여부 수신
4. `resolve_flight_delay` 트랜잭션 전송
   - 지연 >= 120분 또는 결항: `Claimable`
   - 그 외: `NoClaim`

로그 예시:
```
[track_a] KE017 오라클 조회 시작 (FlightPolicy=7xB3...)
[track_a] KE017 지연=150분, 결항=false, 상태=landed
[track_a] KE017 resolve_flight_delay 완료. tx=5fGh...
```

> **오라클 없이 수동 실행:**
> ```bash
> AVIATIONSTACK_API_KEY=<키> yarn demo:oracle-resolve
> ```

### Step 4. 정산

데몬이 `resolve_flight_delay`를 실행하면 FlightPolicy 상태가 결정됩니다.
상태 확인 후 정산을 수동으로 실행합니다.

```bash
# 자동으로 Claimable이면 settle_flight_claim,
# NoClaim이면 settle_flight_no_claim을 호출
yarn demo:settle

# 특정 FlightPolicy 지정 (childId로)
CHILD_POLICY_ID=2 yarn demo:settle
```

정산 결과:
- **Claimable → Paid**: `leaderPool`(보험금 준비금)이 `leaderDepositWallet`으로 이체됨
- **NoClaim → Expired**: `leaderDepositWallet`의 프리미엄이 `leaderAta`로 반환됨

---

## Track B — FlightPolicy (Switchboard On-Demand 연동)

### 흐름 개요

```
1. feed-create   →  Switchboard Pull Feed 생성 (devnet, 최초 1회)
2. master-setup  →  MasterAgreement 생성·확인·활성화 (oracle_feed = 피드 주소)
3. flight-create →  FlightPolicy 생성 (Issued → AwaitingOracle)
4. [데몬 자동]   →  Switchboard Crossbar → check_oracle_and_resolve_flight
                    (AwaitingOracle → Claimable 또는 NoClaim)
5. settle        →  정산 실행 (Paid 또는 Expired)
```

Track B는 Track A와 동일한 MasterAgreement/FlightPolicy 계정 구조를 사용합니다.
차이점: MasterAgreement의 `oracle_feed`가 Switchboard Pull Feed 주소이고, oracle 해석 instruction이 다릅니다.

### Step 1. Switchboard Feed 생성 (최초 1회)

```bash
cd contract
AVIATIONSTACK_API_KEY=<키> FLIGHT_NO=KE017 yarn demo:2-feed-create
```

완료 후 `.state.json`에 `feedPubkey`, `feedCid`, `feedHash`가 저장됩니다.

> **주의:** AviationStack 무료 플랜은 HTTP-only API를 제공합니다.
> Switchboard oracle 노드는 HTTPS만 허용하므로, Track B 실사용 시 HTTPS를 지원하는 API나
> Cloudflare Worker 같은 프록시가 필요합니다.

### Step 2–4. MasterAgreement & FlightPolicy 셋업

```bash
# MasterAgreement 생성 (oracle_feed = state.json의 feedPubkey)
yarn demo:3-master-setup

# FlightPolicy 생성
FLIGHT_NO=KE017 yarn demo:4-flight-create
```

### Step 5. 백엔드 데몬 실행 (Track B 자동화)

> Track B 백엔드 통합은 현재 진행 중입니다.
> `check_oracle_and_resolve_flight` instruction이 온체인에 존재하며 수동 테스트는 devnet에서 진행합니다.
> 자동화 데몬 지원은 추후 추가됩니다.

devnet 수동 확인:
```bash
cd contract
yarn demo:5b-claim   # Switchboard oracle → check_oracle_and_resolve_flight
yarn demo:6-settle   # 상태에 따라 settle_flight_claim 또는 settle_flight_no_claim
```

---

## 데몬 운영 팁

### 로그 레벨 조정

```bash
RUST_LOG=debug ./target/release/riskmesh-oracle-daemon  # 상세 로그
RUST_LOG=warn  ./target/release/riskmesh-oracle-daemon  # 경고 이상만
```

### 수동 1회 실행 (cron 없이 즉시 테스트)

`.env`의 cron을 즉시 실행 주기로 임시 변경:
```dotenv
ORACLE_CHECK_CRON=* * * * * *   # 매초 (테스트용)
```

또는 데몬 없이 스크립트로 직접 실행:
```bash
# Track A 수동
AVIATIONSTACK_API_KEY=<키> yarn demo:oracle-resolve

# Track B 수동
yarn demo:oracle-claim
```

### systemd 서비스 등록 (리눅스 서버 운영)

```ini
# /etc/systemd/system/riskmesh-daemon.service
[Unit]
Description=RiskMesh Oracle Daemon
After=network.target

[Service]
EnvironmentFile=/path/to/backend/.env
ExecStart=/path/to/backend/target/release/riskmesh-oracle-daemon
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
| `FlightPolicy 파싱 실패` 경고 | 다른 account 타입이 섞임 | discriminator 필터 정상 동작 중, 무시 가능 |
| `AviationStack 조회 실패` | API 키 없음 또는 과거 데이터 무료 플랜 제한 | 유료 플랜 사용 또는 `demo:oracle-resolve` 수동 실행 |
| `Switchboard oracle update 수신 실패` | 피드 주소 불일치 또는 devnet queue 오류 | `demo:2-feed-create` 재실행 후 MasterAgreement 재생성 |
| `departure_ts 이전이면 스킵` 로그 | 출발 전 항공편 | 정상 동작. 출발 이후 재실행 |
| `키페어 파일 읽기 실패` | `LEADER_KEYPAIR_PATH` 경로 오류 | `~` 경로 지원됨. 절대경로로 변경하거나 `master-setup` 재실행 |
