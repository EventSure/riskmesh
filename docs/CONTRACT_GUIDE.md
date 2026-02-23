# Open Parametric 스마트 컨트랙트 가이드

Solana 기반 파라메트릭 보험 인프라 프로토콜의 온체인 프로그램 상세 문서.

---

## 목차

1. [개요](#1-개요)
2. [온체인 계정 구조](#2-온체인-계정-구조)
3. [상태 머신](#3-상태-머신)
4. [인스트럭션 상세](#4-인스트럭션-상세)
5. [PDA 시드 및 계정 파생](#5-pda-시드-및-계정-파생)
6. [토큰 흐름](#6-토큰-흐름)
7. [오라클 연동](#7-오라클-연동)
8. [권한 및 서명 규칙](#8-권한-및-서명-규칙)
9. [에러 코드](#9-에러-코드)
10. [전체 플로우 시나리오](#10-전체-플로우-시나리오)

---

## 1. 개요

Open Parametric은 항공편 지연 파라메트릭 보험을 온체인으로 구현한 Anchor 프로그램입니다.

- **프레임워크**: Anchor 0.30 (Rust)
- **네트워크**: Solana
- **오라클**: Switchboard On-Demand
- **토큰**: SPL Token (예치/지급 모두 SPL 토큰 사용)

### 핵심 동작 원리

```
리더사가 보험상품 생성 → 참여사들이 공동 인수 → 자금 예치 → 보험 개시
→ 오라클이 항공편 지연 감지 → 청구 생성 → 승인 → 정산 지급
```

### 상수

| 상수 | 값 | 설명 |
|------|-----|------|
| `DELAY_THRESHOLD_MIN` | 120 | 지연 임계값 (분) |
| `ORACLE_MAX_STALENESS_SLOTS` | 150 | 오라클 최신성 윈도우 (~60-90초) |
| `MAX_PARTICIPANTS` | 16 | 보험상품당 최대 참여사 수 |
| `MAX_POLICYHOLDERS` | 128 | 보험상품당 최대 계약자 수 |
| `MAX_ROUTE_LEN` | 16 | 노선 문자열 최대 길이 |
| `MAX_FLIGHT_NO_LEN` | 16 | 항공편번호 문자열 최대 길이 |
| `MAX_EXTERNAL_REF_LEN` | 32 | 외부 참조 문자열 최대 길이 |

---

## 2. 온체인 계정 구조

프로그램은 5개의 주요 계정 타입을 사용합니다. 모든 계정은 PDA로 파생됩니다.

### 2.1 Policy (보험상품)

단일 파라메트릭 보험상품을 표현합니다. 보험의 모든 메타데이터와 현재 상태를 보관합니다.

```
┌─────────────────────────────────────────────────┐
│ Policy (260 bytes)                              │
├─────────────────────────────────────────────────┤
│ policy_id        : u64       — 상품 식별자       │
│ leader           : Pubkey    — 리더사 주소       │
│ route            : String    — 노선 (예: ICN-JFK)│
│ flight_no        : String    — 항공편 (예: KE081)│
│ departure_date   : i64       — 출발 예정 시각     │
│ delay_threshold_min : u16    — 지연 임계값 (분)   │
│ payout_amount    : u64       — 정액 지급액        │
│ currency_mint    : Pubkey    — SPL 토큰 Mint     │
│ oracle_feed      : Pubkey    — 오라클 피드 주소   │
│ state            : u8        — 현재 상태          │
│ underwriting     : Pubkey    — Underwriting 계정  │
│ pool             : Pubkey    — RiskPool 계정      │
│ created_at       : i64       — 생성 시각          │
│ active_from      : i64       — 보장 시작 시각     │
│ active_to        : i64       — 보장 종료 시각     │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘
```

### 2.2 Underwriting (공동 인수)

보험상품의 공동 인수 구조를 저장합니다. 리더사가 설정한 참여 비율과 각 참여사의 수락/거절 상태를 추적합니다.

```
┌─────────────────────────────────────────────────┐
│ Underwriting (1292 bytes)                       │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — 연결된 Policy     │
│ leader           : Pubkey    — 리더사 주소       │
│ participants     : Vec<ParticipantShare> (최대 16)│
│ total_ratio      : u16       — 비율 합계 (10000) │
│ status           : u8        — 인수 상태          │
│ created_at       : i64       — 생성 시각          │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ParticipantShare (각 참여사 정보)                 │
├─────────────────────────────────────────────────┤
│ insurer          : Pubkey    — 참여사 주소       │
│ ratio_bps        : u16       — 인수 비율 (BPS)   │
│ status           : u8        — 참여 상태          │
│ escrow           : Pubkey    — 예치 토큰 계정     │
│ escrowed_amount  : u64       — 예치 금액          │
└─────────────────────────────────────────────────┘
```

**비율 체계 (BPS)**: 10000 BPS = 100%. 예) 리더 4000 (40%), 참여사A 3500 (35%), 참여사B 2500 (25%)

### 2.3 RiskPool (리스크 풀)

보험상품별 예치 자금을 보관하는 풀입니다. SPL 토큰 Vault를 소유합니다.

```
┌─────────────────────────────────────────────────┐
│ RiskPool (122 bytes)                            │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — 연결된 Policy     │
│ currency_mint    : Pubkey    — SPL 토큰 Mint     │
│ vault            : Pubkey    — 토큰 보관 계정(ATA)│
│ total_escrowed   : u64       — 총 예치 금액      │
│ available_balance: u64       — 가용 잔액          │
│ status           : u8        — 풀 상태            │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘
```

- `vault`는 `risk_pool` PDA가 authority인 Associated Token Account (ATA)
- `total_escrowed`: 누적 예치 총액
- `available_balance`: 지급/환급 가능한 현재 잔액

### 2.4 Claim (청구)

오라클 결과 기반 보험 청구 정보를 저장합니다.

```
┌─────────────────────────────────────────────────┐
│ Claim (106 bytes)                               │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — 연결된 Policy     │
│ oracle_round     : u64       — 오라클 라운드 ID  │
│ oracle_value     : i64       — 오라클 지연값 (분) │
│ verified_at      : i64       — 검증 시각          │
│ approved_by      : Pubkey    — 승인자 주소       │
│ status           : u8        — 청구 상태          │
│ payout_amount    : u64       — 지급 예정액        │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘
```

### 2.5 PolicyholderRegistry (보험계약자 등록부)

보험계약자(최종 피보험자) 최소 데이터를 온체인에 등록합니다. PII는 저장하지 않습니다.

```
┌─────────────────────────────────────────────────┐
│ PolicyholderRegistry (13000 bytes)              │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — 연결된 Policy     │
│ entries          : Vec<PolicyholderEntry> (최대 128)│
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PolicyholderEntry (각 계약자 정보)               │
├─────────────────────────────────────────────────┤
│ external_ref     : String    — 보험사 내부 식별자 │
│ policy_id        : u64       — 보험상품 ID       │
│ flight_no        : String    — 항공편 번호       │
│ departure_date   : i64       — 출발 예정 시각     │
│ passenger_count  : u16       — 가입 인원 수       │
│ premium_paid     : u64       — 납입 보험료        │
│ coverage_amount  : u64       — 보장 금액          │
│ timestamp        : i64       — 등록 시각          │
└─────────────────────────────────────────────────┘
```

### 계정 관계도

```
                    ┌──────────────┐
                    │    Policy    │
                    │   (보험상품)  │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          │                │                │                  │
          ▼                ▼                ▼                  ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐ ┌──────────────┐
│  Underwriting   │ │ RiskPool  │ │    Claim(s)     │ │  Policyholder│
│  (공동 인수)     │ │ (리스크풀) │ │    (청구)        │ │  Registry    │
├─────────────────┤ ├───────────┤ ├─────────────────┤ │  (계약자등록) │
│ ParticipantShare│ │   Vault   │ │ oracle_round별  │ └──────────────┘
│ ParticipantShare│ │  (ATA)    │ │ 1개씩 생성       │
│ ...최대 16개    │ └───────────┘ └─────────────────┘
└─────────────────┘
```

---

## 3. 상태 머신

### 3.1 PolicyState (보험상품 상태)

```
                         ┌──────────────────────────────────────────────────┐
                         │                                                  │
 ┌───────┐  open   ┌──────┐ accept_share ┌────────┐ activate ┌────────┐   │
 │ Draft │────────▶│ Open │─────────────▶│ Funded │────────▶│ Active │   │
 └───────┘         └──────┘  (all 100%)  └────────┘         └───┬────┘   │
                                                                 │        │
                                              ┌──────────────────┤        │
                                              │                  │        │
                                   oracle trigger          expire (시간초과)│
                                              │                  │        │
                                              ▼                  ▼        │
                                        ┌───────────┐     ┌─────────┐   │
                                        │ Claimable │     │ Expired │   │
                                        └─────┬─────┘     └────┬────┘   │
                                              │                 │        │
                                        approve_claim     refund_after   │
                                              │            _expiry       │
                                              ▼                          │
                                        ┌──────────┐                     │
                                        │ Approved │                     │
                                        └─────┬────┘                     │
                                              │                          │
                                        settle_claim                     │
                                              │                          │
                                              ▼                          │
                                        ┌─────────┐                     │
                                        │ Settled │                      │
                                        └─────────┘                     │
```

| 값 | 상태 | 설명 |
|----|------|------|
| 0 | `Draft` | 리더사가 보험 생성, 아직 모집 전 |
| 1 | `Open` | 공동 인수 모집 중 |
| 2 | `Funded` | 인수 비율 100% 수락 + 예치 완료 |
| 3 | `Active` | 보험 보장 개시됨 |
| 4 | `Claimable` | 오라클 조건 충족, 청구 가능 |
| 5 | `Approved` | 리더사가 청구 승인 |
| 6 | `Settled` | 지급 완료 (종결) |
| 7 | `Expired` | 보장 기간 종료, 청구 없음 (종결) |

### 3.2 UnderwritingStatus (인수 상태)

```
┌──────────┐  open   ┌──────┐  all accepted  ┌───────────┐
│ Proposed │────────▶│ Open │───────────────▶│ Finalized │
└──────────┘         └──────┘                └───────────┘
                         │
                         │ (실패 시)
                         ▼
                    ┌────────┐
                    │ Failed │
                    └────────┘
```

| 값 | 상태 | 설명 |
|----|------|------|
| 0 | `Proposed` | 초기 상태 |
| 1 | `Open` | 참여사 모집 중 |
| 2 | `Finalized` | 비율 합계 10000 BPS 달성 |
| 3 | `Failed` | 인수 실패 |

### 3.3 ClaimStatus (청구 상태)

```
┌──────┐         ┌───────────┐  approve  ┌──────────┐  settle  ┌─────────┐
│ None │────────▶│ Claimable │─────────▶│ Approved │────────▶│ Settled │
└──────┘         └───────────┘          └──────────┘         └─────────┘
                       │
                       │ (거절 시)
                       ▼
                 ┌──────────┐
                 │ Rejected │
                 └──────────┘
```

### 3.4 ParticipantStatus (참여사 상태)

```
┌─────────┐  accept  ┌──────────┐
│ Pending │─────────▶│ Accepted │
└────┬────┘          └──────────┘
     │
     │ reject
     ▼
┌──────────┐
│ Rejected │
└──────────┘
```

---

## 4. 인스트럭션 상세

### 4.1 `create_policy` — 보험상품 생성

리더사가 새로운 파라메트릭 보험상품을 생성합니다. 단일 트랜잭션으로 Policy, Underwriting, RiskPool, PolicyholderRegistry, Vault 5개 계정을 동시에 초기화합니다.

**서명자**: `leader` (리더사)

**파라미터** (`CreatePolicyParams`):

| 필드 | 타입 | 설명 |
|------|------|------|
| `policy_id` | u64 | 상품 고유 식별자 |
| `route` | String | 노선 (예: "ICN-JFK") |
| `flight_no` | String | 항공편 번호 (예: "KE081") |
| `departure_date` | i64 | 출발 예정 시각 (Unix timestamp) |
| `delay_threshold_min` | u16 | 지연 임계값 (반드시 120) |
| `payout_amount` | u64 | 정액 지급액 (SPL 토큰 단위) |
| `oracle_feed` | Pubkey | Switchboard 오라클 피드 주소 |
| `active_from` | i64 | 보장 시작 시각 |
| `active_to` | i64 | 보장 종료 시각 |
| `participants` | Vec\<ParticipantInit\> | 참여사 목록 및 비율 |

**검증 규칙**:
- `active_from < active_to`
- `payout_amount > 0`
- `delay_threshold_min == 120`
- `route` 길이 ≤ 16, `flight_no` 길이 ≤ 16
- 참여사 수 ≤ 16
- 참여사 `ratio_bps` 합계 = 10000 (100%)

**생성되는 계정**:

| 계정 | 시드 | 초기 상태 |
|------|------|----------|
| Policy | `["policy", leader, policy_id]` | state = Draft |
| Underwriting | `["underwriting", policy]` | status = Proposed |
| RiskPool | `["pool", policy]` | total_escrowed = 0 |
| PolicyholderRegistry | `["registry", policy]` | entries = [] |
| Vault | ATA(mint, risk_pool) | balance = 0 |

**상태 전이**: → `Policy.state = Draft`

---

### 4.2 `open_underwriting` — 인수 모집 개시

리더사가 공동 인수 모집을 시작합니다.

**서명자**: `leader`

**전제 조건**: `Policy.state == Draft`

**동작**:
- `Policy.state` → `Open`
- `Underwriting.status` → `Open`

---

### 4.3 `accept_share` — 인수 참여 수락 및 예치

참여사가 자신에게 배정된 인수 비율을 수락하고 SPL 토큰을 예치합니다.

**서명자**: `participant` (해당 참여사)

**파라미터**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `index` | u8 | participants 벡터 내 인덱스 |
| `deposit_amount` | u64 | 예치할 토큰 수량 |

**검증 규칙**:
- `Policy.state == Open`
- 해당 인덱스의 `insurer`와 서명자 일치
- 해당 참여사의 `status == Pending`
- `deposit_amount > 0`
- `deposit_amount >= payout_amount * ratio_bps / 10000` (최소 예치액)
- `participant_token.mint == policy.currency_mint` (토큰 종류 일치)
- `vault.mint == policy.currency_mint`

**동작**:
1. 참여사 토큰 계정 → Vault로 SPL 토큰 전송 (CPI)
2. `ParticipantShare.status` → `Accepted`
3. `RiskPool.total_escrowed` += deposit_amount
4. `RiskPool.available_balance` += deposit_amount
5. 수락된 참여사의 ratio_bps 합산
6. **합산 == 10000이면**: `Underwriting.status` → `Finalized`, `Policy.state` → `Funded`

**토큰 흐름**:
```
참여사 토큰 계정 ──(SPL Transfer)──▶ RiskPool Vault
```

---

### 4.4 `reject_share` — 인수 참여 거절

참여사가 자신에게 배정된 인수 비율을 거절합니다.

**서명자**: `participant`

**전제 조건**: `Policy.state == Open`, `ParticipantShare.status == Pending`

**동작**: `ParticipantShare.status` → `Rejected`

---

### 4.5 `activate_policy` — 보험 개시

리더사가 자금 조달이 완료된 보험의 보장을 개시합니다.

**서명자**: `leader`

**전제 조건**:
- `Policy.state == Funded`
- `현재 시간 >= active_from`

**동작**: `Policy.state` → `Active`

---

### 4.6 `check_oracle_and_create_claim` — 오라클 확인 및 청구 생성

Switchboard On-Demand 오라클에서 항공편 지연 데이터를 읽고, 조건 충족 시 청구를 생성합니다. **누구나 호출 가능** (permissionless).

**서명자**: `payer` (Claim 계정 rent 지불자)

**파라미터**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `oracle_round` | u64 | 오라클 라운드 식별자 |

**전제 조건**: `Policy.state == Active`

**오라클 검증 절차**:
1. `oracle_feed` 주소가 `Policy.oracle_feed`와 일치 확인
2. Switchboard `QuoteVerifier`로 데이터 무결성 검증
   - Queue, SlotHashes, Instructions sysvar 사용
   - `max_age = 150 slots` (약 60-90초)
3. 현재 슬롯과 quote 슬롯의 차이가 150 이하인지 확인 (staleness check)
4. 피드 값 읽기 및 검증:
   - `value >= 0`
   - `value <= i64::MAX`
   - `value % 10 == 0` (10분 단위)

**동작** (지연 >= 120분인 경우):
1. `Claim` 계정 생성 (PDA: `["claim", policy, oracle_round]`)
2. `Claim.oracle_value` = 오라클 지연 값
3. `Claim.status` → `Claimable`
4. `Claim.payout_amount` = `Policy.payout_amount`
5. `Policy.state` → `Claimable`

> 지연 < 120분이면 Claim 계정이 생성되지만 비어있는 상태가 됩니다 (계정 초기화 비용만 소모).

**필수 트랜잭션 구조** (같은 TX에 3개 인스트럭션 필수):
```
IX 0: Ed25519 서명 검증
IX 1: Switchboard verified_update
IX 2: check_oracle_and_create_claim (이 프로그램)
```

---

### 4.7 `approve_claim` — 청구 승인

리더사가 오라클 조건이 충족된 청구를 승인합니다.

**서명자**: `leader`

**전제 조건**:
- `Policy.state == Claimable`
- `Claim.status == Claimable`

**동작**:
- `Claim.status` → `Approved`
- `Claim.approved_by` = leader 주소
- `Policy.state` → `Approved`

---

### 4.8 `settle_claim` — 청구 정산 (지급)

승인된 청구에 대해 Vault에서 수익자에게 토큰을 지급합니다.

**서명자**: `leader`

**전제 조건**:
- `Policy.state == Approved`
- `Claim.status == Approved`
- `Claim.payout_amount <= RiskPool.available_balance`
- `beneficiary_token.mint == policy.currency_mint`

**동작**:
1. RiskPool PDA 서명으로 Vault → 수익자 토큰 계정으로 SPL 전송
2. `RiskPool.available_balance` -= payout_amount
3. `Claim.status` → `Settled`
4. `Policy.state` → `Settled`

**토큰 흐름**:
```
RiskPool Vault ──(PDA-signed SPL Transfer)──▶ 수익자 토큰 계정
```

---

### 4.9 `expire_policy` — 보험 만기 처리

보장 기간이 종료된 보험을 만기 처리합니다. **누구나 호출 가능**.

**전제 조건**:
- `Policy.state == Active`
- `현재 시간 > active_to`

**동작**: `Policy.state` → `Expired`

---

### 4.10 `refund_after_expiry` — 만기 후 예치금 환급

만기된 보험에서 참여사가 자신의 예치금을 돌려받습니다.

**서명자**: `participant` (해당 참여사)

**파라미터**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `share_index` | u8 | participants 벡터 내 인덱스 |

**전제 조건**:
- `Policy.state == Expired`
- 해당 `insurer`와 서명자 일치
- `ParticipantShare.status == Accepted`
- `escrowed_amount > 0`

**동작**:
1. RiskPool PDA 서명으로 Vault → 참여사 토큰 계정으로 SPL 전송 (전액)
2. `RiskPool.available_balance` -= escrowed_amount
3. `ParticipantShare.escrowed_amount` = 0

**토큰 흐름**:
```
RiskPool Vault ──(PDA-signed SPL Transfer)──▶ 참여사 토큰 계정
```

---

### 4.11 `register_policyholder` — 보험계약자 등록

리더사가 보험계약자(최종 피보험자) 정보를 온체인에 등록합니다.

**서명자**: `leader`

**파라미터** (`PolicyholderEntryInput`):

| 필드 | 타입 | 설명 |
|------|------|------|
| `external_ref` | String | 보험사 내부 식별자 (PII 아님) |
| `policy_id` | u64 | 보험상품 ID |
| `flight_no` | String | 항공편 번호 |
| `departure_date` | i64 | 출발 예정 시각 |
| `passenger_count` | u16 | 가입 인원 수 |
| `premium_paid` | u64 | 납입 보험료 |
| `coverage_amount` | u64 | 보장 금액 |

**검증 규칙**:
- `Policy.leader == leader` (리더사만 등록 가능)
- `registry.policy == policy.key()`
- `external_ref` 길이 ≤ 32
- `flight_no` 길이 ≤ 16
- 현재 등록 수 < 128

---

## 5. PDA 시드 및 계정 파생

모든 주요 계정은 Program Derived Address (PDA)로 결정론적으로 파생됩니다.

| 계정 | 시드 | 설명 |
|------|------|------|
| Policy | `["policy", leader_pubkey, policy_id_le_bytes]` | 리더 + ID로 유니크 |
| Underwriting | `["underwriting", policy_pubkey]` | Policy당 1개 |
| RiskPool | `["pool", policy_pubkey]` | Policy당 1개 |
| Claim | `["claim", policy_pubkey, oracle_round_le_bytes]` | 라운드별 1개 |
| PolicyholderRegistry | `["registry", policy_pubkey]` | Policy당 1개 |
| Vault | ATA(currency_mint, risk_pool_pda) | RiskPool이 authority |

```
leader + policy_id ──▶ Policy PDA
                           │
                           ├──▶ Underwriting PDA  (seed: ["underwriting", policy])
                           ├──▶ RiskPool PDA      (seed: ["pool", policy])
                           │       └──▶ Vault ATA (authority: risk_pool)
                           ├──▶ Claim PDA         (seed: ["claim", policy, round])
                           └──▶ Registry PDA      (seed: ["registry", policy])
```

---

## 6. 토큰 흐름

전체 SPL 토큰 이동 경로를 시각화합니다.

```
                        예치 (accept_share)
  ┌──────────────┐    ───────────────────▶    ┌──────────────┐
  │ 참여사A 토큰  │                           │              │
  └──────────────┘                            │              │
  ┌──────────────┐    ───────────────────▶    │  RiskPool    │
  │ 참여사B 토큰  │         예치               │  Vault       │
  └──────────────┘                            │  (ATA)       │
  ┌──────────────┐    ───────────────────▶    │              │
  │ 리더사 토큰   │         예치               │              │
  └──────────────┘                            └──────┬───────┘
                                                     │
                          ┌──────────────────────────┤
                          │                          │
                    정산 (settle)              환급 (refund)
                          │                          │
                          ▼                          ▼
                   ┌──────────────┐         ┌───────────────┐
                   │ 수익자 토큰   │         │ 각 참여사 토큰  │
                   │ (피보험자)    │         │ (전액 반환)     │
                   └──────────────┘         └───────────────┘
```

### 토큰 전송 메커니즘

| 방향 | 인스트럭션 | 서명 방식 |
|------|-----------|----------|
| 참여사 → Vault | `accept_share` | 참여사 직접 서명 (일반 CPI) |
| Vault → 수익자 | `settle_claim` | RiskPool PDA 서명 (`CpiContext::new_with_signer`) |
| Vault → 참여사 | `refund_after_expiry` | RiskPool PDA 서명 (`CpiContext::new_with_signer`) |

---

## 7. 오라클 연동

### 7.1 Switchboard On-Demand 구조

```
┌─────────────────────────────────────────────────────────────────┐
│ 트랜잭션 (단일 TX에 3개 인스트럭션)                                │
├─────────────────────────────────────────────────────────────────┤
│ IX 0: Ed25519 서명 검증 (Solana native)                         │
│ IX 1: Switchboard verified_update (오라클 데이터 갱신)            │
│ IX 2: check_oracle_and_create_claim (이 프로그램)                │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 오라클 값 형식

- 오라클 값: **항공편 지연 시간 (분)**
- 단위: **10분 단위** (0, 10, 20, 30, ..., 120, 130, ...)
- 검증: `oracle_delay_min % 10 == 0`
- 범위: `0 <= value <= i64::MAX`

### 7.3 검증 체크리스트

```
1. oracle_feed 주소 == Policy.oracle_feed         ✓ 피드 일치
2. QuoteVerifier.verify_instruction_at(0)          ✓ Switchboard 무결성
3. current_slot - quote_slot <= 150                ✓ 최신성 (staleness)
4. feeds 비어있지 않음                              ✓ 데이터 존재
5. value >= 0                                      ✓ 양수
6. value <= i64::MAX                               ✓ 오버플로우 방지
7. value % 10 == 0                                 ✓ 10분 단위
8. value >= 120 → Claim 생성                       ✓ 임계값 판정
```

---

## 8. 권한 및 서명 규칙

### 역할 정의

| 역할 | 설명 | 식별 |
|------|------|------|
| **Leader** (리더사) | 보험 생성, 관리, 승인, 정산 | `Policy.leader` |
| **Participant** (참여사) | 인수 참여, 예치, 환급 | `Underwriting.participants[i].insurer` |
| **Public** (누구나) | 오라클 트리거, 만기 처리 | 서명 제한 없음 |

### 인스트럭션별 권한 매트릭스

| 인스트럭션 | Leader | Participant | Public |
|-----------|--------|-------------|--------|
| `create_policy` | **필수** | - | - |
| `open_underwriting` | **필수** | - | - |
| `accept_share` | - | **필수** | - |
| `reject_share` | - | **필수** | - |
| `activate_policy` | **필수** | - | - |
| `check_oracle_and_create_claim` | - | - | **가능** |
| `approve_claim` | **필수** | - | - |
| `settle_claim` | **필수** | - | - |
| `expire_policy` | - | - | **가능** |
| `refund_after_expiry` | - | **필수** | - |
| `register_policyholder` | **필수** | - | - |

### 권한 검증 구현

- **Leader 검증**: Anchor `has_one = leader` 제약 조건으로 `Policy.leader == signer` 자동 확인
- **Participant 검증**: `share.insurer == participant.key()` 수동 확인
- **Public 호출**: 상태/시간 조건만 검증

---

## 9. 에러 코드

| 에러 | 코드 | 설명 | 발생 상황 |
|------|------|------|----------|
| `Unauthorized` | 6000 | 서명자 권한 없음 | 잘못된 리더/참여사 |
| `InvalidState` | 6001 | 잘못된 상태 전이 | 허용되지 않는 상태에서 호출 |
| `InvalidRatio` | 6002 | 인수 비율 합계 불일치 | ratio_bps 합 ≠ 10000 |
| `AlreadyExists` | 6003 | 이미 존재 | 중복 생성 시도 |
| `NotFound` | 6004 | 대상 없음 | 잘못된 인덱스 |
| `InsufficientEscrow` | 6005 | 예치금 부족 | 최소 예치액 미달 |
| `PoolInsufficient` | 6006 | 풀 잔액 부족 | payout > available_balance |
| `OracleStale` | 6007 | 오라클 데이터 오래됨 | staleness > 150 slots |
| `OracleFormat` | 6008 | 오라클 값 형식 오류 | 10분 단위 위반, 음수 등 |
| `InvalidTimeWindow` | 6009 | 시간 조건 불일치 | active_from >= active_to 등 |
| `InvalidInput` | 6010 | 입력 파라미터 오류 | 계정 불일치 등 |
| `InvalidAmount` | 6011 | 금액 오류 | payout_amount == 0 |
| `InvalidDelayThreshold` | 6012 | 지연 임계값 오류 | threshold ≠ 120 |
| `InputTooLong` | 6013 | 입력 길이 초과 | 문자열 최대 길이 초과 |

---

## 10. 전체 플로우 시나리오

### 10.1 정상 지급 플로우 (Happy Path)

```
시간 ──────────────────────────────────────────────────────────────▶

 1. create_policy        2. open_underwriting     3. accept_share (x N)
 리더사가 보험 생성       리더사가 모집 개시        참여사들이 수락+예치
 [Draft]                [Open]                   [Funded] (합계 100%)
     │                      │                        │
     ▼                      ▼                        ▼
 Policy 생성             모집 시작                 Vault에 자금 축적
 Underwriting 생성                                Underwriting Finalized
 RiskPool 생성
 Registry 생성
 Vault(ATA) 생성

 4. activate_policy      5. check_oracle          6. approve_claim
 리더사가 보장 개시       오라클 지연 감지           리더사가 승인
 [Active]               [Claimable]              [Approved]
     │                      │                        │
     ▼                      ▼                        ▼
 보장 기간 시작          Claim 계정 생성           approved_by 기록
                        oracle_value 저장

 7. settle_claim
 리더사가 정산 실행
 [Settled] ← 종결
     │
     ▼
 Vault → 수익자 토큰 전송
 available_balance 차감
```

### 10.2 부지급 (만기) 플로우

```
시간 ──────────────────────────────────────────────────────────────▶

 1~4. (정상 플로우와 동일하게 Active까지 진행)

 5. expire_policy                    6. refund_after_expiry (x N)
 보장 기간 종료                       각 참여사가 환급 요청
 [Expired]                          예치금 전액 반환
     │                                  │
     ▼                                  ▼
 active_to 시간 초과 확인            Vault → 참여사 토큰 전송 (전액)
 오라클 조건 미충족                   escrowed_amount = 0
```

### 10.3 시퀀스 다이어그램 (정상 지급)

```
 리더사          참여사A         참여사B         오라클          Vault
   │               │               │              │              │
   │──create_policy─────────────────────────────────────────────▶│ (Policy,UW,Pool,Vault 생성)
   │               │               │              │              │
   │──open_underwriting──────────────────────────────────────────│
   │               │               │              │              │
   │               │──accept_share(40%)───────────────────────▶│ (400K 예치)
   │               │               │              │              │
   │               │               │──accept_share(35%)──────▶│ (350K 예치)
   │               │               │              │              │
   │               │               │              │              │ (리더 포함 총 1M)
   │──activate_policy───────────────────────────────────────────│
   │               │               │              │              │
   │               │               │              │──(지연 130분)│
   │               │               │              │              │
   │──check_oracle_and_create_claim────────────────────────────│ (Claim 생성)
   │               │               │              │              │
   │──approve_claim─────────────────────────────────────────────│
   │               │               │              │              │
   │──settle_claim──────────────────────────────────────────────│──▶ 수익자
   │               │               │              │              │   (1M 지급)
```

### 10.4 예치액 산정 예시

보험상품: `payout_amount = 1,000,000`

| 참여사 | ratio_bps | 비율 | 최소 예치액 | 산식 |
|--------|-----------|------|------------|------|
| 리더사 | 4000 | 40% | 400,000 | 1,000,000 * 4000 / 10000 |
| 참여사A | 3500 | 35% | 350,000 | 1,000,000 * 3500 / 10000 |
| 참여사B | 2500 | 25% | 250,000 | 1,000,000 * 2500 / 10000 |
| **합계** | **10000** | **100%** | **1,000,000** | |

---

## 부록: 계정 사이즈

| 계정 | 할당 크기 | 비고 |
|------|----------|------|
| Policy | 260 bytes | 고정 필드 + String(route, flight_no) |
| Underwriting | 1,292 bytes | ParticipantShare * 16 + 고정 필드 |
| RiskPool | 122 bytes | 고정 필드만 |
| Claim | 106 bytes | 고정 필드만 |
| PolicyholderRegistry | 13,000 bytes | PolicyholderEntry * 128 + 고정 필드 |
