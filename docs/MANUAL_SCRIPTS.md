# Manual Scripts 사용법

`.state.json` 없이 온체인 데이터를 직접 읽어 실행하는 수동 스크립트 모음.
모든 명령은 `contract/` 디렉터리에서 실행.

---

## 공통 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `MASTER_PDA` | **필수** | — | MasterAgreement 온체인 주소 |
| `KEYPAIR_PATH` | 선택 | `~/.config/solana/id.json` | leader 키페어 경로 |

---

## 1. FlightPolicy 목록 조회

```bash
MASTER_PDA=<MasterAgreement주소> \
yarn demo:manual-list
```

출력: child_policy_id 순 정렬, flightNo / status / delay / payout / premium / PDA 표시

---

## 2. FlightPolicy 생성

```bash
MASTER_PDA=<MasterAgreement주소> \
FLIGHT_NO=KE001 \
ROUTE=ICN-NRT \
yarn demo:manual-create-flight
```

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `FLIGHT_NO` | `KE001` | 항공편명 |
| `ROUTE` | `ICN-NRT` | 노선 |
| `DEPARTURE_TS` | 현재+24시간 (Unix) | 출발 Unix timestamp |
| `SUBSCRIBER_REF` | `manual-test` | 가입자 참조 식별자 |
| `CHILD_POLICY_ID` | 자동 증가 | 직접 지정 시 사용 |

출발 시각 직접 지정 예시:

```bash
MASTER_PDA=<MasterAgreement주소> \
FLIGHT_NO=OZ201 \
ROUTE=ICN-LAX \
DEPARTURE_TS=$(date -v+2d +%s) \
yarn demo:manual-create-flight
```

---

## 3. 오라클 결과 수동 기록 (resolve)

> AviationStack 없이 `resolve_flight_delay`를 직접 호출합니다.

```bash
MASTER_PDA=<MasterAgreement주소> \
CHILD_POLICY_ID=4 \
DELAY_MINUTES=150 \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn ts-node -P tsconfig.json scripts/manual-resolve.ts
```

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `CHILD_POLICY_ID` | `4` | 대상 FlightPolicy ID |
| `DELAY_MINUTES` | `150` | 지연 분 (120 미만이면 NoClaim) |
| `CANCELLED` | `false` | 결항 여부 (`true` / `false`) |

결항 처리:

```bash
MASTER_PDA=<MasterAgreement주소> \
CHILD_POLICY_ID=4 \
CANCELLED=true \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn ts-node -P tsconfig.json scripts/manual-resolve.ts
```

결과 status: `2=Claimable` (지연 ≥ 120분 or 결항) / `4=NoClaim`

---

## 4. 정산 (settle)

> 온체인 status에 따라 `settle_flight_claim` 또는 `settle_flight_no_claim` 자동 선택.

```bash
MASTER_PDA=<MasterAgreement주소> \
CHILD_POLICY_ID=4 \
yarn demo:manual-settle
```

| status | 실행 instruction | 결과 |
|---|---|---|
| `2 Claimable` | `settle_flight_claim` | payout → leaderDepositWallet |
| `4 NoClaim` | `settle_flight_no_claim` | premium → 참여사 depositWallets |
| 그 외 | 실행 안 함 | 경고 메시지 출력 |

---

## 전체 수동 플로우 (devnet)

```bash
# 0. 환경변수 세팅
export MASTER_PDA=<MasterAgreement주소>

# 1. 현재 FlightPolicy 목록 확인
yarn demo:manual-list

# 2. 새 FlightPolicy 생성
MASTER_PDA=$MASTER_PDA FLIGHT_NO=KE001 yarn demo:manual-create-flight

# 3. 목록 재확인 (생성된 ID 확인)
yarn demo:manual-list

# 4. 오라클 결과 기록 (ID=5 기준, 150분 지연)
MASTER_PDA=$MASTER_PDA CHILD_POLICY_ID=5 DELAY_MINUTES=150 \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
yarn ts-node -P tsconfig.json scripts/manual-resolve.ts

# 5. 정산
MASTER_PDA=$MASTER_PDA CHILD_POLICY_ID=5 yarn demo:manual-settle
```
