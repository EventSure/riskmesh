# Manual Scripts 사용 가이드

AviationStack API, Switchboard Oracle, `.state.json` 없이 FlightPolicy 상태를 직접 제어하는 스크립트입니다.

## 전제 조건

- MasterPolicy가 이미 생성되어 Active 상태여야 합니다 (`yarn demo:3-master-setup`)
- FlightPolicy가 이미 생성되어 있어야 합니다 (`yarn demo:4-flight-create`)
- Leader 키페어 파일이 로컬에 있어야 합니다 (기본: `~/.config/solana/id.json`)
- `target/idl/open_parametric.json` IDL 파일이 존재해야 합니다 (`anchor build` 후 생성)

---

## 1. manual-resolve.ts

FlightPolicy의 오라클 결과를 수동으로 기록합니다.  
`AwaitingOracle(1)` 상태의 FlightPolicy를 `Claimable(2)` 또는 `NoClaim(4)`로 전환합니다.

### 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `MASTER_PDA` | **필수** | - | MasterPolicy 온체인 주소 |
| `CHILD_POLICY_ID` | 선택 | `4` | FlightPolicy의 child ID |
| `DELAY_MINUTES` | 선택 | `150` | 지연 시간 (분) |
| `CANCELLED` | 선택 | `false` | 결항 여부 (`true` / `false`) |
| `KEYPAIR_PATH` | 선택 | `~/.config/solana/id.json` | Leader 키페어 경로 |
| `ANCHOR_PROVIDER_URL` | 선택 | `https://api.devnet.solana.com` | Solana RPC URL |

### 지연 시간별 결과

| DELAY_MINUTES | CANCELLED | 결과 상태 | Payout 티어 |
|---|---|---|---|
| 0 ~ 119 | `false` | **NoClaim(4)** | 0 (미지급) |
| 120 ~ 179 | `false` | **Claimable(2)** | `payout_delay_2h` |
| 180 ~ 239 | `false` | **Claimable(2)** | `payout_delay_3h` |
| 240 ~ 359 | `false` | **Claimable(2)** | `payout_delay_4to5h` |
| 360+ | `false` | **Claimable(2)** | `payout_delay_6h_or_cancelled` |
| 아무 값 | `true` | **Claimable(2)** | `payout_delay_6h_or_cancelled` |

### 실행 예시

```bash
# 2시간 지연 → Claimable
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=150 \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 지연 없음 → NoClaim
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=60 \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 결항 → Claimable (최대 payout)
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=0 CANCELLED=true \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 6시간 이상 지연 → Claimable (최대 payout)
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=400 \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts
```

### 출력 예시

```
=== manual-resolve ===
leader        : 7xKX...
masterPda     : Abc1...
flightPda     : Def4...
delay_minutes : 150
cancelled     : false

현재 status   : 1

=== 완료 ===
tx            : 5yNp...
delay(온체인) : 150 분
status        : 2 (2=Claimable, 4=NoClaim)
```

---

## 2. manual-settle.ts

FlightPolicy의 정산을 실행합니다. 온체인 MasterPolicy 계정에서 wallet 주소를 자동으로 읽어오므로 `.state.json`이 필요 없습니다.

- `Claimable(2)` → `settle_flight_claim` → **Paid(3)**: 참여사 pool에서 leader deposit으로 payout 이체
- `NoClaim(4)` → `settle_flight_no_claim` → **Expired(5)**: leader deposit에서 참여사 deposit으로 premium 분배

### 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `MASTER_PDA` | **필수** | - | MasterPolicy 온체인 주소 |
| `CHILD_POLICY_ID` | 선택 | `4` | FlightPolicy의 child ID |
| `KEYPAIR_PATH` | 선택 | `~/.config/solana/id.json` | Leader 키페어 경로 |
| `ANCHOR_PROVIDER_URL` | 선택 | `https://api.devnet.solana.com` | Solana RPC URL |

### 실행 예시

```bash
# Claimable → Paid (보험금 지급)
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 \
  yarn demo:manual-settle

# NoClaim → Expired (프리미엄 분배)
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 \
  yarn demo:manual-settle
```

### 출력 예시 (Claimable → Paid)

```
=== manual-settle ===
leader        : 7xKX...
masterPda     : Abc1...
flightPda     : Def4...
flightNo      : KE653
delayMinutes  : 150
cancelled     : false
payoutAmount  : 40000000
현재 status   : 2 (Claimable)

→ Claimable: settle_flight_claim 실행 중...

=== 완료 ===
tx            : 3kMn...
status        : 3 (Paid)
payout        : 40000000 토큰 → leaderDepositWallet
```

### 출력 예시 (NoClaim → Expired)

```
=== manual-settle ===
leader        : 7xKX...
masterPda     : Abc1...
flightPda     : Def4...
flightNo      : KE653
delayMinutes  : 60
cancelled     : false
payoutAmount  : 0
현재 status   : 4 (NoClaim)

→ NoClaim: settle_flight_no_claim 실행 중...

=== 완료 ===
tx            : 8pQr...
status        : 5 (Expired)
premium       : 10000000 토큰 → 참여사 deposit wallets
```

---

## 전체 플로우 예시

API 의존성 없이 FlightPolicy의 전체 라이프사이클을 수동으로 실행하는 시나리오입니다.

### 시나리오 A: 보험금 지급 (지연 발생)

```bash
# 1. resolve: 2시간 30분 지연 → Claimable
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=150 \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 2. settle: payout 지급 → Paid
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 \
  yarn demo:manual-settle
```

### 시나리오 B: 프리미엄 분배 (지연 없음)

```bash
# 1. resolve: 지연 없음 → NoClaim
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=30 \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 2. settle: premium 분배 → Expired
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 \
  yarn demo:manual-settle
```

### 시나리오 C: 결항 (최대 보험금)

```bash
# 1. resolve: 결항 → Claimable (최대 payout)
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 DELAY_MINUTES=0 CANCELLED=true \
  yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 2. settle: payout 지급 → Paid
MASTER_PDA=Abc123... CHILD_POLICY_ID=1 \
  yarn demo:manual-settle
```

---

## FlightPolicy 상태 전환 전체 맵

```
                    manual-resolve.ts
                   (DELAY >= 120 or CANCELLED=true)
                  ┌─────────────────────────────────→ Claimable(2)
                  │                                       │
AwaitingOracle(1) ┤                                       │ manual-settle.ts
                  │                                       │ (settle_flight_claim)
                  │   manual-resolve.ts                   ▼
                  │  (DELAY < 120)                     Paid(3) ✓
                  └─────────────────────────────────→ NoClaim(4)
                                                          │
                                                          │ manual-settle.ts
                                                          │ (settle_flight_no_claim)
                                                          ▼
                                                      Expired(5) ✓
```
