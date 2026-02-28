# Open Parametric Smart Contract Guide

Detailed on-chain program documentation for the Solana-based parametric insurance infrastructure protocol.

---

## Table of Contents

1. [Overview](#1-overview)
2. [On-Chain Account Structure](#2-on-chain-account-structure)
3. [State Machines](#3-state-machines)
4. [Instruction Details](#4-instruction-details)
5. [PDA Seeds & Account Derivation](#5-pda-seeds--account-derivation)
6. [Token Flow](#6-token-flow)
7. [Oracle Integration](#7-oracle-integration)
8. [Authorization & Signing Rules](#8-authorization--signing-rules)
9. [Error Codes](#9-error-codes)
10. [End-to-End Flow Scenarios](#10-end-to-end-flow-scenarios)
11. [Master/Flight Flow (Track A)](#11-masterflight-flow-track-a)

---

## 1. Overview

Open Parametric is an Anchor program that implements flight delay parametric insurance on-chain.

- **Framework**: Anchor 0.31.1 (Rust)
- **Network**: Solana
- **Oracle**: Switchboard On-Demand
- **Token**: SPL Token (used for both escrow and payout)

### Core Mechanism

```
Leader creates insurance product → Participants co-underwrite → Funds escrowed → Policy activated
→ Oracle detects flight delay → Claim created → Approved → Settlement paid
```

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DELAY_THRESHOLD_MIN` | 120 | Delay threshold (minutes) |
| `ORACLE_MAX_STALENESS_SLOTS` | 150 | Oracle staleness window (~60-90 seconds) |
| `MAX_PARTICIPANTS` | 16 | Max participants per policy |
| `MAX_POLICYHOLDERS` | 128 | Max policyholders per policy |
| `MAX_ROUTE_LEN` | 16 | Max route string length |
| `MAX_FLIGHT_NO_LEN` | 16 | Max flight number string length |
| `MAX_EXTERNAL_REF_LEN` | 32 | Max external reference string length |
| `MAX_MASTER_PARTICIPANTS` | 8 | Max participants per master contract |
| `MAX_SUBSCRIBER_REF_LEN` | 64 | Max subscriber reference string length |

---

## 2. On-Chain Account Structure

The program uses 5 main account types. All accounts are derived as PDAs.

### 2.1 Policy (Insurance Product)

Represents a single parametric insurance product. Stores all metadata and current state of the insurance.

```
┌─────────────────────────────────────────────────┐
│ Policy (260 bytes)                              │
├─────────────────────────────────────────────────┤
│ policy_id        : u64       — Product ID       │
│ leader           : Pubkey    — Leader address    │
│ route            : String    — Route (e.g. ICN-JFK)│
│ flight_no        : String    — Flight (e.g. KE081)│
│ departure_date   : i64       — Scheduled departure│
│ delay_threshold_min : u16    — Delay threshold (min)│
│ payout_amount    : u64       — Fixed payout amount│
│ currency_mint    : Pubkey    — SPL Token Mint    │
│ oracle_feed      : Pubkey    — Oracle feed address│
│ state            : u8        — Current state     │
│ underwriting     : Pubkey    — Underwriting account│
│ pool             : Pubkey    — RiskPool account   │
│ created_at       : i64       — Creation timestamp │
│ active_from      : i64       — Coverage start    │
│ active_to        : i64       — Coverage end      │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘
```

### 2.2 Underwriting (Co-Insurance)

Stores the co-underwriting structure of an insurance product. Tracks participation ratios set by the leader and accept/reject status of each participant.

```
┌─────────────────────────────────────────────────┐
│ Underwriting (1292 bytes)                       │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — Linked Policy     │
│ leader           : Pubkey    — Leader address    │
│ participants     : Vec<ParticipantShare> (max 16)│
│ total_ratio      : u16       — Ratio sum (10000) │
│ status           : u8        — Underwriting status│
│ created_at       : i64       — Creation timestamp│
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ParticipantShare (per participant)               │
├─────────────────────────────────────────────────┤
│ insurer          : Pubkey    — Participant address│
│ ratio_bps        : u16       — Underwriting ratio (BPS)│
│ status           : u8        — Participation status│
│ escrow           : Pubkey    — Escrow token account│
│ escrowed_amount  : u64       — Escrowed amount   │
└─────────────────────────────────────────────────┘
```

**Ratio System (BPS)**: 10000 BPS = 100%. e.g.) Leader 4000 (40%), Participant A 3500 (35%), Participant B 2500 (25%)

### 2.3 RiskPool

Per-policy pool that holds escrowed funds. Owns the SPL Token Vault.

```
┌─────────────────────────────────────────────────┐
│ RiskPool (122 bytes)                            │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — Linked Policy     │
│ currency_mint    : Pubkey    — SPL Token Mint    │
│ vault            : Pubkey    — Token custody (ATA)│
│ total_escrowed   : u64       — Total escrowed    │
│ available_balance: u64       — Available balance  │
│ status           : u8        — Pool status       │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘
```

- `vault` is an Associated Token Account (ATA) with the `risk_pool` PDA as authority
- `total_escrowed`: cumulative total deposits
- `available_balance`: current spendable balance for payouts/refunds

### 2.4 Claim

Stores insurance claim information based on oracle results.

```
┌─────────────────────────────────────────────────┐
│ Claim (106 bytes)                               │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — Linked Policy     │
│ oracle_round     : u64       — Oracle round ID   │
│ oracle_value     : i64       — Oracle delay (min) │
│ verified_at      : i64       — Verification time  │
│ approved_by      : Pubkey    — Approver address  │
│ status           : u8        — Claim status      │
│ payout_amount    : u64       — Scheduled payout  │
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘
```

### 2.5 PolicyholderRegistry

Registers minimal policyholder (end insured) data on-chain. No PII is stored.

```
┌─────────────────────────────────────────────────┐
│ PolicyholderRegistry (13000 bytes)              │
├─────────────────────────────────────────────────┤
│ policy           : Pubkey    — Linked Policy     │
│ entries          : Vec<PolicyholderEntry> (max 128)│
│ bump             : u8        — PDA bump seed     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PolicyholderEntry (per policyholder)             │
├─────────────────────────────────────────────────┤
│ external_ref     : String    — Insurer internal ID│
│ policy_id        : u64       — Policy ID         │
│ flight_no        : String    — Flight number     │
│ departure_date   : i64       — Scheduled departure│
│ passenger_count  : u16       — Number of passengers│
│ premium_paid     : u64       — Premium paid      │
│ coverage_amount  : u64       — Coverage amount   │
│ timestamp        : i64       — Registration time │
└─────────────────────────────────────────────────┘
```

### Account Relationships

```
                    ┌──────────────┐
                    │    Policy    │
                    │  (Insurance) │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          │                │                │                  │
          ▼                ▼                ▼                  ▼
┌─────────────────┐ ┌───────────┐ ┌─────────────────┐ ┌──────────────┐
│  Underwriting   │ │ RiskPool  │ │    Claim(s)     │ │  Policyholder│
│ (Co-Insurance)  │ │ (Pool)    │ │    (Claims)     │ │  Registry    │
├─────────────────┤ ├───────────┤ ├─────────────────┤ │ (Enrollments)│
│ ParticipantShare│ │   Vault   │ │ One per         │ └──────────────┘
│ ParticipantShare│ │  (ATA)    │ │ oracle_round    │
│ ...up to 16    │ └───────────┘ └─────────────────┘
└─────────────────┘
```

---

## 3. State Machines

### 3.1 PolicyState

```
                         ┌──────────────────────────────────────────────────┐
                         │                                                  │
 ┌───────┐  open   ┌──────┐ accept_share ┌────────┐ activate ┌────────┐   │
 │ Draft │────────▶│ Open │─────────────▶│ Funded │────────▶│ Active │   │
 └───────┘         └──────┘  (all 100%)  └────────┘         └───┬────┘   │
                                                                 │        │
                                              ┌──────────────────┤        │
                                              │                  │        │
                                   oracle trigger          expire (timeout)│
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

| Value | State | Description |
|-------|-------|-------------|
| 0 | `Draft` | Leader created the policy, not yet open for recruitment |
| 1 | `Open` | Co-underwriting recruitment in progress |
| 2 | `Funded` | All ratios accepted (100%) + funds escrowed |
| 3 | `Active` | Coverage period has started |
| 4 | `Claimable` | Oracle condition met, claim possible |
| 5 | `Approved` | Leader approved the claim |
| 6 | `Settled` | Payout completed (terminal) |
| 7 | `Expired` | Coverage period ended, no claim (terminal) |

### 3.2 UnderwritingStatus

```
┌──────────┐  open   ┌──────┐  all accepted  ┌───────────┐
│ Proposed │────────▶│ Open │───────────────▶│ Finalized │
└──────────┘         └──────┘                └───────────┘
                         │
                         │ (on failure)
                         ▼
                    ┌────────┐
                    │ Failed │
                    └────────┘
```

| Value | State | Description |
|-------|-------|-------------|
| 0 | `Proposed` | Initial state |
| 1 | `Open` | Recruiting participants |
| 2 | `Finalized` | Ratio sum reached 10000 BPS |
| 3 | `Failed` | Underwriting failed |

### 3.3 ClaimStatus

```
┌──────┐         ┌───────────┐  approve  ┌──────────┐  settle  ┌─────────┐
│ None │────────▶│ Claimable │─────────▶│ Approved │────────▶│ Settled │
└──────┘         └───────────┘          └──────────┘         └─────────┘
                       │
                       │ (on rejection)
                       ▼
                 ┌──────────┐
                 │ Rejected │
                 └──────────┘
```

### 3.4 ParticipantStatus

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

## 4. Instruction Details

### 4.1 `create_policy` — Create Insurance Product

The leader creates a new parametric insurance product. Initializes 5 accounts in a single transaction: Policy, Underwriting, RiskPool, PolicyholderRegistry, and Vault.

**Signer**: `leader`

**Parameters** (`CreatePolicyParams`):

| Field | Type | Description |
|-------|------|-------------|
| `policy_id` | u64 | Unique product identifier |
| `route` | String | Route (e.g. "ICN-JFK") |
| `flight_no` | String | Flight number (e.g. "KE081") |
| `departure_date` | i64 | Scheduled departure (Unix timestamp) |
| `delay_threshold_min` | u16 | Delay threshold (must be 120) |
| `payout_amount` | u64 | Fixed payout amount (SPL token units) |
| `oracle_feed` | Pubkey | Switchboard oracle feed address |
| `active_from` | i64 | Coverage start time |
| `active_to` | i64 | Coverage end time |
| `participants` | Vec\<ParticipantInit\> | Participant list and ratios |

**Validation Rules**:
- `active_from < active_to`
- `payout_amount > 0`
- `delay_threshold_min == 120`
- `route` length ≤ 16, `flight_no` length ≤ 16
- Participant count ≤ 16
- Participant `ratio_bps` sum = 10000 (100%)

**Created Accounts**:

| Account | Seeds | Initial State |
|---------|-------|---------------|
| Policy | `["policy", leader, policy_id]` | state = Draft |
| Underwriting | `["underwriting", policy]` | status = Proposed |
| RiskPool | `["pool", policy]` | total_escrowed = 0 |
| PolicyholderRegistry | `["registry", policy]` | entries = [] |
| Vault | ATA(mint, risk_pool) | balance = 0 |

**State Transition**: → `Policy.state = Draft`

---

### 4.2 `open_underwriting` — Start Underwriting Recruitment

The leader starts co-underwriting recruitment.

**Signer**: `leader`

**Precondition**: `Policy.state == Draft`

**Actions**:
- `Policy.state` → `Open`
- `Underwriting.status` → `Open`

---

### 4.3 `accept_share` — Accept Underwriting Share & Escrow

A participant accepts their assigned underwriting ratio and escrows SPL tokens.

**Signer**: `participant`

**Parameters**:

| Field | Type | Description |
|-------|------|-------------|
| `index` | u8 | Index in participants vector |
| `deposit_amount` | u64 | Token amount to escrow |

**Validation Rules**:
- `Policy.state == Open`
- `insurer` at the given index matches the signer
- Participant's `status == Pending`
- `deposit_amount > 0`
- `deposit_amount >= payout_amount * ratio_bps / 10000` (minimum escrow)
- `participant_token.mint == policy.currency_mint` (token type match)
- `vault.mint == policy.currency_mint`

**Actions**:
1. SPL token transfer from participant's token account → Vault (CPI)
2. `ParticipantShare.status` → `Accepted`
3. `RiskPool.total_escrowed` += deposit_amount
4. `RiskPool.available_balance` += deposit_amount
5. Sum accepted participants' ratio_bps
6. **If sum == 10000**: `Underwriting.status` → `Finalized`, `Policy.state` → `Funded`

**Token Flow**:
```
Participant Token Account ──(SPL Transfer)──▶ RiskPool Vault
```

---

### 4.4 `reject_share` — Reject Underwriting Share

A participant rejects their assigned underwriting ratio.

**Signer**: `participant`

**Precondition**: `Policy.state == Open`, `ParticipantShare.status == Pending`

**Action**: `ParticipantShare.status` → `Rejected`

---

### 4.5 `activate_policy` — Activate Policy

The leader activates coverage for a fully funded policy.

**Signer**: `leader`

**Preconditions**:
- `Policy.state == Funded`
- `current_time >= active_from`

**Action**: `Policy.state` → `Active`

---

### 4.6 `check_oracle_and_create_claim` — Oracle Check & Claim Creation

Reads flight delay data from the Switchboard On-Demand oracle and creates a claim if conditions are met. **Permissionless** — anyone can call this.

**Signer**: `payer` (pays rent for the Claim account)

**Parameters**:

| Field | Type | Description |
|-------|------|-------------|
| `oracle_round` | u64 | Oracle round identifier |

**Precondition**: `Policy.state == Active`

**Oracle Verification Procedure**:
1. Verify `oracle_feed` address matches `Policy.oracle_feed`
2. Verify data integrity via Switchboard `QuoteVerifier`
   - Uses Queue, SlotHashes, Instructions sysvar
   - `max_age = 150 slots` (~60-90 seconds)
3. Verify difference between current slot and quote slot ≤ 150 (staleness check)
4. Read and validate feed value:
   - `value >= 0`
   - `value <= i64::MAX`
   - `value % 10 == 0` (10-minute increments)

**Actions** (if delay ≥ 120 minutes):
1. Create `Claim` account (PDA: `["claim", policy, oracle_round]`)
2. `Claim.oracle_value` = oracle delay value
3. `Claim.status` → `Claimable`
4. `Claim.payout_amount` = `Policy.payout_amount`
5. `Policy.state` → `Claimable`

> If delay < 120 minutes, the Claim account is initialized but left empty (only account initialization cost is spent).

**Required Transaction Structure** (3 instructions in the same TX):
```
IX 0: Ed25519 signature verification
IX 1: Switchboard verified_update
IX 2: check_oracle_and_create_claim (this program)
```

---

### 4.7 `approve_claim` — Approve Claim

The leader approves a claim that has met oracle conditions.

**Signer**: `leader`

**Preconditions**:
- `Policy.state == Claimable`
- `Claim.status == Claimable`

**Actions**:
- `Claim.status` → `Approved`
- `Claim.approved_by` = leader address
- `Policy.state` → `Approved`

---

### 4.8 `settle_claim` — Settle Claim (Payout)

Transfers tokens from the Vault to the beneficiary for an approved claim.

**Signer**: `leader`

**Preconditions**:
- `Policy.state == Approved`
- `Claim.status == Approved`
- `Claim.payout_amount <= RiskPool.available_balance`
- `beneficiary_token.mint == policy.currency_mint`

**Actions**:
1. PDA-signed SPL transfer: Vault → beneficiary token account
2. `RiskPool.available_balance` -= payout_amount
3. `Claim.status` → `Settled`
4. `Policy.state` → `Settled`

**Token Flow**:
```
RiskPool Vault ──(PDA-signed SPL Transfer)──▶ Beneficiary Token Account
```

---

### 4.9 `expire_policy` — Expire Policy

Marks a policy as expired after the coverage period ends. **Permissionless**.

**Preconditions**:
- `Policy.state == Active`
- `current_time > active_to`

**Action**: `Policy.state` → `Expired`

---

### 4.10 `refund_after_expiry` — Refund After Expiry

A participant reclaims their escrowed funds from an expired policy.

**Signer**: `participant`

**Parameters**:

| Field | Type | Description |
|-------|------|-------------|
| `share_index` | u8 | Index in participants vector |

**Preconditions**:
- `Policy.state == Expired`
- `insurer` at the given index matches the signer
- `ParticipantShare.status == Accepted`
- `escrowed_amount > 0`

**Actions**:
1. PDA-signed SPL transfer: Vault → participant token account (full amount)
2. `RiskPool.available_balance` -= escrowed_amount
3. `ParticipantShare.escrowed_amount` = 0

**Token Flow**:
```
RiskPool Vault ──(PDA-signed SPL Transfer)──▶ Participant Token Account
```

---

### 4.11 `register_policyholder` — Register Policyholder

The leader registers policyholder (end insured) information on-chain.

**Signer**: `leader`

**Parameters** (`PolicyholderEntryInput`):

| Field | Type | Description |
|-------|------|-------------|
| `external_ref` | String | Insurer internal identifier (not PII) |
| `policy_id` | u64 | Policy ID |
| `flight_no` | String | Flight number |
| `departure_date` | i64 | Scheduled departure |
| `passenger_count` | u16 | Number of passengers |
| `premium_paid` | u64 | Premium paid |
| `coverage_amount` | u64 | Coverage amount |

**Validation Rules**:
- `Policy.leader == leader` (only leader can register)
- `registry.policy == policy.key()`
- `external_ref` length ≤ 32
- `flight_no` length ≤ 16
- Current entry count < 128

---

## 5. PDA Seeds & Account Derivation

All major accounts are deterministically derived as Program Derived Addresses (PDAs).

| Account | Seeds | Description |
|---------|-------|-------------|
| Policy | `["policy", leader_pubkey, policy_id_le_bytes]` | Unique per leader + ID |
| Underwriting | `["underwriting", policy_pubkey]` | One per Policy |
| RiskPool | `["pool", policy_pubkey]` | One per Policy |
| Claim | `["claim", policy_pubkey, oracle_round_le_bytes]` | One per round |
| PolicyholderRegistry | `["registry", policy_pubkey]` | One per Policy |
| Vault | ATA(currency_mint, risk_pool_pda) | RiskPool is authority |

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

## 6. Token Flow

Visualizes the complete SPL token movement paths.

```
                        Escrow (accept_share)
  ┌──────────────┐    ───────────────────▶    ┌──────────────┐
  │ Participant A │                           │              │
  │ Token Account │                           │              │
  └──────────────┘                            │              │
  ┌──────────────┐    ───────────────────▶    │  RiskPool    │
  │ Participant B │         Escrow            │  Vault       │
  │ Token Account │                           │  (ATA)       │
  └──────────────┘                            │              │
  ┌──────────────┐    ───────────────────▶    │              │
  │ Leader Token  │         Escrow            │              │
  │ Account       │                           │              │
  └──────────────┘                            └──────┬───────┘
                                                     │
                          ┌──────────────────────────┤
                          │                          │
                    Settle (payout)           Refund (expiry)
                          │                          │
                          ▼                          ▼
                   ┌──────────────┐         ┌───────────────┐
                   │ Beneficiary  │         │ Each Partici- │
                   │ Token Account│         │ pant (full    │
                   │ (Insured)    │         │ refund)       │
                   └──────────────┘         └───────────────┘
```

### Token Transfer Mechanisms

| Direction | Instruction | Signing Method |
|-----------|-------------|----------------|
| Participant → Vault | `accept_share` | Participant direct signature (standard CPI) |
| Vault → Beneficiary | `settle_claim` | RiskPool PDA signature (`CpiContext::new_with_signer`) |
| Vault → Participant | `refund_after_expiry` | RiskPool PDA signature (`CpiContext::new_with_signer`) |

---

## 7. Oracle Integration

### 7.1 Switchboard On-Demand Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Transaction (3 instructions in a single TX)                     │
├─────────────────────────────────────────────────────────────────┤
│ IX 0: Ed25519 signature verification (Solana native)            │
│ IX 1: Switchboard verified_update (oracle data refresh)         │
│ IX 2: check_oracle_and_create_claim (this program)              │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Oracle Value Format

- Oracle value: **flight delay time (minutes)**
- Unit: **10-minute increments** (0, 10, 20, 30, ..., 120, 130, ...)
- Validation: `oracle_delay_min % 10 == 0`
- Range: `0 <= value <= i64::MAX`

### 7.3 Verification Checklist

```
1. oracle_feed address == Policy.oracle_feed      ✓ Feed match
2. QuoteVerifier.verify_instruction_at(0)          ✓ Switchboard integrity
3. current_slot - quote_slot <= 150                ✓ Staleness
4. feeds not empty                                 ✓ Data exists
5. value >= 0                                      ✓ Non-negative
6. value <= i64::MAX                               ✓ Overflow prevention
7. value % 10 == 0                                 ✓ 10-minute increments
8. value >= 120 → Create Claim                     ✓ Threshold check
```

---

## 8. Authorization & Signing Rules

### Role Definitions

| Role | Description | Identification |
|------|-------------|----------------|
| **Leader** | Creates policy, manages, approves, settles | `Policy.leader` |
| **Participant** | Co-underwriting, escrow, refund | `Underwriting.participants[i].insurer` |
| **Public** (Anyone) | Oracle trigger, expiry processing | No signing restriction |

### Per-Instruction Authorization Matrix

| Instruction | Leader | Participant | Public |
|-------------|--------|-------------|--------|
| `create_policy` | **Required** | - | - |
| `open_underwriting` | **Required** | - | - |
| `accept_share` | - | **Required** | - |
| `reject_share` | - | **Required** | - |
| `activate_policy` | **Required** | - | - |
| `check_oracle_and_create_claim` | - | - | **Allowed** |
| `approve_claim` | **Required** | - | - |
| `settle_claim` | **Required** | - | - |
| `expire_policy` | - | - | **Allowed** |
| `refund_after_expiry` | - | **Required** | - |
| `register_policyholder` | **Required** | - | - |

### Authorization Implementation

- **Leader verification**: Anchor `has_one = leader` constraint automatically checks `Policy.leader == signer`
- **Participant verification**: Manual check `share.insurer == participant.key()`
- **Public calls**: Only state/time conditions are verified

---

## 9. Error Codes

| Error | Code | Description | Trigger |
|-------|------|-------------|---------|
| `Unauthorized` | 6000 | Signer not authorized | Invalid leader/participant |
| `InvalidState` | 6001 | Invalid state transition | Called in disallowed state |
| `InvalidRatio` | 6002 | Underwriting ratio sum mismatch | ratio_bps sum ≠ 10000 |
| `AlreadyExists` | 6003 | Already exists | Duplicate creation attempt |
| `NotFound` | 6004 | Target not found | Invalid index |
| `InsufficientEscrow` | 6005 | Insufficient escrow | Below minimum deposit |
| `PoolInsufficient` | 6006 | Pool balance insufficient | payout > available_balance |
| `OracleStale` | 6007 | Oracle data stale | staleness > 150 slots |
| `OracleFormat` | 6008 | Oracle value format error | 10-min unit violation, negative, etc. |
| `InvalidTimeWindow` | 6009 | Time condition mismatch | active_from >= active_to, etc. |
| `InvalidInput` | 6010 | Invalid input parameter | Account mismatch, etc. |
| `InvalidAmount` | 6011 | Invalid amount | payout_amount == 0 |
| `InvalidDelayThreshold` | 6012 | Invalid delay threshold | threshold ≠ 120 |
| `InputTooLong` | 6013 | Input too long | String exceeds max length |
| `MathOverflow` | 6014 | Arithmetic overflow | checked_mul/sub/add failure |
| `MasterNotActive` | 6015 | Master contract not active | MasterPolicy.status ≠ Active |
| `MasterNotConfirmed` | 6016 | Master confirmation incomplete | Participant/reinsurer not confirmed |
| `InvalidRole` | 6017 | Invalid role | Wrong role in confirm_master |
| `InvalidPayout` | 6018 | Invalid payout | payout_amount == 0 |
| `AlreadySettled` | 6019 | Already settled | premium_distributed == true |
| `InvalidSettlementTarget` | 6020 | Invalid settlement target | Wallet owner mismatch |
| `InvalidAccountList` | 6021 | Invalid account list | remaining_accounts count mismatch |

---

## 10. End-to-End Flow Scenarios

### 10.1 Normal Payout Flow (Happy Path)

```
Time ──────────────────────────────────────────────────────────────▶

 1. create_policy        2. open_underwriting     3. accept_share (x N)
 Leader creates policy   Leader opens recruitment  Participants accept+escrow
 [Draft]                [Open]                   [Funded] (sum = 100%)
     │                      │                        │
     ▼                      ▼                        ▼
 Policy created          Recruitment begins       Funds accumulate in Vault
 Underwriting created                             Underwriting Finalized
 RiskPool created
 Registry created
 Vault (ATA) created

 4. activate_policy      5. check_oracle          6. approve_claim
 Leader activates        Oracle detects delay      Leader approves
 [Active]               [Claimable]              [Approved]
     │                      │                        │
     ▼                      ▼                        ▼
 Coverage begins         Claim account created    approved_by recorded
                        oracle_value stored

 7. settle_claim
 Leader executes settlement
 [Settled] ← Terminal
     │
     ▼
 Vault → Beneficiary token transfer
 available_balance reduced
```

### 10.2 No-Payout (Expiry) Flow

```
Time ──────────────────────────────────────────────────────────────▶

 1~4. (Same as normal flow up to Active)

 5. expire_policy                    6. refund_after_expiry (x N)
 Coverage period ends                Each participant requests refund
 [Expired]                          Full escrow returned
     │                                  │
     ▼                                  ▼
 active_to time exceeded            Vault → Participant token transfer (full)
 Oracle condition not met           escrowed_amount = 0
```

### 10.3 Sequence Diagram (Normal Payout)

```
 Leader          Participant A   Participant B   Oracle          Vault
   │               │               │              │              │
   │──create_policy─────────────────────────────────────────────▶│ (Policy,UW,Pool,Vault created)
   │               │               │              │              │
   │──open_underwriting──────────────────────────────────────────│
   │               │               │              │              │
   │               │──accept_share(40%)───────────────────────▶│ (400K escrowed)
   │               │               │              │              │
   │               │               │──accept_share(35%)──────▶│ (350K escrowed)
   │               │               │              │              │
   │               │               │              │              │ (Total 1M incl. leader)
   │──activate_policy───────────────────────────────────────────│
   │               │               │              │              │
   │               │               │              │──(130m delay)│
   │               │               │              │              │
   │──check_oracle_and_create_claim────────────────────────────│ (Claim created)
   │               │               │              │              │
   │──approve_claim─────────────────────────────────────────────│
   │               │               │              │              │
   │──settle_claim──────────────────────────────────────────────│──▶ Beneficiary
   │               │               │              │              │   (1M payout)
```

### 10.4 Escrow Calculation Example

Policy: `payout_amount = 1,000,000`

| Participant | ratio_bps | Ratio | Min. Escrow | Formula |
|-------------|-----------|-------|-------------|---------|
| Leader | 4000 | 40% | 400,000 | 1,000,000 * 4000 / 10000 |
| Participant A | 3500 | 35% | 350,000 | 1,000,000 * 3500 / 10000 |
| Participant B | 2500 | 25% | 250,000 | 1,000,000 * 2500 / 10000 |
| **Total** | **10000** | **100%** | **1,000,000** | |

---

## Appendix: Account Sizes

| Account | Allocated Size | Notes |
|---------|---------------|-------|
| Policy | 260 bytes | Fixed fields + String(route, flight_no) |
| Underwriting | 1,292 bytes | ParticipantShare * 16 + fixed fields |
| RiskPool | 122 bytes | Fixed fields only |
| Claim | 106 bytes | Fixed fields only |
| PolicyholderRegistry | 13,000 bytes | PolicyholderEntry * 128 + fixed fields |

---

## 11. Master/Flight Flow (Track A)

In addition to the Legacy flow (Section 4), a Master Contract + Individual Flight Insurance structure is implemented. This section describes the Track A (Trusted Resolver) instructions, accounts, and state machines.

### 11.1 Account Structure

#### MasterPolicy (Master Contract)

A top-level contract managed on a period basis. Manages common terms, shares, cession rates, payout tiers, and participant/reinsurer information.

```
┌─────────────────────────────────────────────────┐
│ MasterPolicy (4096 bytes)                       │
├─────────────────────────────────────────────────┤
│ master_id             : u64       — Contract ID  │
│ leader                : Pubkey    — Leader address│
│ operator              : Pubkey    — Operator      │
│ currency_mint         : Pubkey    — SPL Token Mint│
│ coverage_start_ts     : i64       — Coverage start│
│ coverage_end_ts       : i64       — Coverage end  │
│ premium_per_policy    : u64       — Premium/policy│
│ payout_delay_2h       : u64       — 2h delay payout│
│ payout_delay_3h       : u64       — 3h delay payout│
│ payout_delay_4to5h    : u64       — 4-5h payout   │
│ payout_delay_6h_or_cancelled : u64 — 6h+/cancel  │
│ ceded_ratio_bps       : u16       — Cession rate  │
│ reins_commission_bps  : u16       — Reins. commission│
│ reinsurer_effective_bps : u16     — Reins. effective│
│ reinsurer             : Pubkey    — Reinsurer addr│
│ reinsurer_confirmed   : bool      — Reins. confirmed│
│ reinsurer_pool_wallet : Pubkey    — Reins. pool wallet│
│ reinsurer_deposit_wallet : Pubkey — Reins. deposit│
│ leader_deposit_wallet : Pubkey    — Leader deposit│
│ participants          : Vec<MasterParticipant> (max 8)│
│ status                : u8        — Contract status│
│ created_at            : i64       — Creation time │
│ bump                  : u8        — PDA bump seed │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ MasterParticipant (per participant)              │
├─────────────────────────────────────────────────┤
│ insurer        : Pubkey    — Participant address  │
│ share_bps      : u16       — Share ratio (BPS)   │
│ confirmed      : bool      — Confirmation status │
│ pool_wallet    : Pubkey    — Pool wallet (claim source)│
│ deposit_wallet : Pubkey    — Deposit wallet (premium)│
└─────────────────────────────────────────────────┘
```

**Reinsurer effective ratio**: `reinsurer_effective_bps = ceded_ratio_bps * (10000 - reins_commission_bps) / 10000`

#### FlightPolicy (Individual Flight Insurance)

An individual insurance record under a master contract. Manages flight/subscriber info, oracle results, and payout status.

```
┌─────────────────────────────────────────────────┐
│ FlightPolicy (1024 bytes)                       │
├─────────────────────────────────────────────────┤
│ child_policy_id   : u64       — Individual ID    │
│ master            : Pubkey    — Parent MasterPolicy│
│ creator           : Pubkey    — Creator address  │
│ subscriber_ref    : String    — Subscriber ref (≤64)│
│ flight_no         : String    — Flight number    │
│ route             : String    — Route            │
│ departure_ts      : i64       — Scheduled departure│
│ premium_paid      : u64       — Premium paid     │
│ delay_minutes     : u16       — Delay (minutes)  │
│ cancelled         : bool      — Cancellation flag │
│ payout_amount     : u64       — Payout amount    │
│ status            : u8        — Current status   │
│ premium_distributed : bool    — Premium settled  │
│ created_at        : i64       — Creation time    │
│ updated_at        : i64       — Last updated     │
│ bump              : u8        — PDA bump seed    │
└─────────────────────────────────────────────────┘
```

#### Account Relationships

```
                    ┌──────────────────┐
                    │  MasterPolicy    │
                    │ (Master Contract)│
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │FlightPolicy│ │FlightPolicy│ │FlightPolicy│
       │ (Child #1) │ │ (Child #2) │ │ (Child #N) │
       └────────────┘ └────────────┘ └────────────┘
```

### 11.2 State Machines

#### MasterPolicyStatus

```
┌───────┐  create   ┌────────────────┐  activate  ┌────────┐
│ Draft │──────────▶│ PendingConfirm │──────────▶│ Active │
└───────┘           └────────────────┘           └────┬───┘
                                                      │
                                                 ┌────┴────┐
                                                 ▼         ▼
                                            ┌────────┐ ┌───────────┐
                                            │ Closed │ │ Cancelled │
                                            └────────┘ └───────────┘
```

| Value | State | Description |
|-------|-------|-------------|
| 0 | `Draft` | Initial creation state |
| 1 | `PendingConfirm` | Awaiting participant/reinsurer confirmation |
| 2 | `Active` | Active — individual policies can be created |
| 3 | `Closed` | Terminated |
| 4 | `Cancelled` | Cancelled |

#### FlightPolicyStatus

```
┌────────┐               ┌─────────────────┐
│ Issued │──────────────▶│ AwaitingOracle  │
└────────┘               └────────┬────────┘
                                  │
                    resolve_flight_delay
                                  │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
              ┌───────────┐               ┌──────────┐
              │ Claimable │               │ NoClaim  │
              └─────┬─────┘               └─────┬────┘
                    │                           │
            settle_flight_claim        settle_flight_no_claim
                    │                           │
                    ▼                           ▼
              ┌──────┐                    ┌─────────┐
              │ Paid │                    │ Expired │
              └──────┘                    └─────────┘
```

| Value | State | Description |
|-------|-------|-------------|
| 0 | `Issued` | Issued |
| 1 | `AwaitingOracle` | Awaiting oracle result |
| 2 | `Claimable` | Payout conditions met |
| 3 | `Paid` | Claim paid out |
| 4 | `NoClaim` | Payout conditions not met |
| 5 | `Expired` | Premium settled (NoClaim → Expired) |

#### Tiered Payout Structure

`resolve_flight_delay` applies a 4-tier payout based on delay duration from the MasterPolicy.

| Condition | Payout Field |
|-----------|-------------|
| Cancelled or delay ≥ 360 min | `payout_delay_6h_or_cancelled` |
| 240 min ≤ delay < 360 min | `payout_delay_4to5h` |
| 180 min ≤ delay < 240 min | `payout_delay_3h` |
| 120 min ≤ delay < 180 min | `payout_delay_2h` |
| delay < 120 min | 0 (no payout) |

### 11.3 Instruction Details

#### 11.3.1 `create_master_policy` — Create Master Contract

The leader creates a period-based master insurance contract.

**Signer**: `leader`

**Parameters** (`CreateMasterPolicyParams`):

| Field | Type | Description |
|-------|------|-------------|
| `master_id` | u64 | Master contract identifier |
| `coverage_start_ts` | i64 | Coverage start time |
| `coverage_end_ts` | i64 | Coverage end time |
| `premium_per_policy` | u64 | Premium per policy |
| `payout_delay_2h` | u64 | 2-hour delay payout |
| `payout_delay_3h` | u64 | 3-hour delay payout |
| `payout_delay_4to5h` | u64 | 4-5 hour delay payout |
| `payout_delay_6h_or_cancelled` | u64 | 6h+/cancellation payout |
| `ceded_ratio_bps` | u16 | Cession ratio (BPS) |
| `reins_commission_bps` | u16 | Reinsurance commission (BPS) |
| `participants` | Vec\<MasterParticipantInit\> | Participant list and shares |

**Validation Rules**:
- `coverage_start_ts < coverage_end_ts`
- `premium_per_policy > 0`
- 1-8 participants, `share_bps` sum = 10000
- Leader must be included in participants list
- All wallet mints must match `currency_mint`

**Created Accounts**:

| Account | Seeds | Initial State |
|---------|-------|---------------|
| MasterPolicy | `["master_policy", leader, master_id]` | status = PendingConfirm |

**State Transition**: → `MasterPolicy.status = PendingConfirm`

---

#### 11.3.2 `register_participant_wallets` — Register Participant Wallets

A participant registers their pool wallet (claim source) and deposit wallet (premium destination).

**Signer**: `insurer` (the participant)

**Precondition**: `MasterPolicy.status` ∉ {Active, Closed, Cancelled}

**Validation Rules**:
- Signer exists in participants list
- pool_wallet.mint == currency_mint
- deposit_wallet.mint == currency_mint

**Action**: Records `pool_wallet` and `deposit_wallet` for the participant

---

#### 11.3.3 `confirm_master` — Confirm Master Contract

A participant or reinsurer confirms their participation in the master contract.

**Signer**: `actor` (participant or reinsurer)

**Parameters**:

| Field | Type | Description |
|-------|------|-------------|
| `role` | u8 | 0 = Participant, 1 = Reinsurer |

**Precondition**: `MasterPolicy.status == PendingConfirm`

**Validation Rules**:
- Participant (role=0): Signer exists in participants, pool_wallet and deposit_wallet registered
- Reinsurer (role=1): Signer matches `MasterPolicy.reinsurer`

**Actions**:
- Participant: `MasterParticipant.confirmed` → true
- Reinsurer: `MasterPolicy.reinsurer_confirmed` → true

---

#### 11.3.4 `activate_master` — Activate Master Contract

The operator activates the master contract after all participant/reinsurer confirmations are complete.

**Signer**: `operator`

**Preconditions**:
- `MasterPolicy.status == PendingConfirm`
- `operator == MasterPolicy.operator`
- `reinsurer_confirmed == true`
- All participants `confirmed == true` with wallets registered

**Action**: `MasterPolicy.status` → `Active`

---

#### 11.3.5 `create_flight_policy_from_master` — Create Individual Flight Insurance

Creates an individual flight insurance policy under an active master contract. Premium is prepaid to leader_deposit_wallet at creation time.

**Signer**: `creator` (leader or operator)

**Parameters** (`CreateFlightPolicyParams`):

| Field | Type | Description |
|-------|------|-------------|
| `child_policy_id` | u64 | Individual policy identifier |
| `subscriber_ref` | String | Subscriber reference (≤64 chars) |
| `flight_no` | String | Flight number (≤16 chars) |
| `route` | String | Route (≤16 chars) |
| `departure_ts` | i64 | Scheduled departure time |

**Precondition**: `MasterPolicy.status == Active`

**Validation Rules**:
- Creator is leader or operator
- String length limits respected
- Token account mint matches

**Actions**:
1. SPL transfer from creator's token account → leader_deposit_wallet for `premium_per_policy`
2. Create FlightPolicy account (PDA: `["flight_policy", master_policy, child_policy_id]`)
3. `FlightPolicy.status` → `AwaitingOracle`

**Token Flow**:
```
Creator Token Account ──(SPL Transfer)──▶ leader_deposit_wallet
```

---

#### 11.3.6 `resolve_flight_delay` — Resolve Flight Delay (Track A)

The leader or operator resolves a FlightPolicy using delay data from the AviationStack API. This is a Trusted Resolver approach — relies on signer trust.

**Signer**: `resolver` (leader or operator)

**Parameters**:

| Field | Type | Description |
|-------|------|-------------|
| `delay_minutes` | u16 | Delay duration (minutes) |
| `cancelled` | bool | Cancellation flag |

**Preconditions**:
- `MasterPolicy.status == Active`
- `FlightPolicy.status` ∈ {Issued, AwaitingOracle}
- `flight.master == master_policy.key()`

**Actions**:
1. Calculate payout from tiered payout table
2. payout > 0 → `FlightPolicy.status` → `Claimable`
3. payout == 0 → `FlightPolicy.status` → `NoClaim`
4. Record `delay_minutes`, `cancelled`, `payout_amount`

---

#### 11.3.7 `settle_flight_claim` — Settle Flight Claim

Settles a Claimable FlightPolicy by collecting claim funds from each participant's pool wallet and the reinsurer's pool wallet into the leader deposit wallet.

**Signer**: `executor` (leader or operator)

**Preconditions**:
- `MasterPolicy.status == Active`
- `FlightPolicy.status == Claimable`
- `payout_amount > 0`
- `remaining_accounts` count = number of participants

**Amount Calculation**:
- Reinsurer share: `payout * reinsurer_effective_bps / 10000`
- Insurer share: `(payout - reinsurer share)` → distributed by `share_bps`

**Token Flow**:
```
Reinsurer Pool Wallet  ──(PDA-signed Transfer)──▶ leader_deposit_wallet
Participant A Pool     ──(PDA-signed Transfer)──▶ leader_deposit_wallet
Participant B Pool     ──(PDA-signed Transfer)──▶ leader_deposit_wallet
```

**State Transition**: `FlightPolicy.status` → `Paid`

---

#### 11.3.8 `settle_flight_no_claim` — Settle No-Claim Premium Distribution

Distributes premium to participants and reinsurer for a NoClaim FlightPolicy. Transfers premium collected in the leader deposit wallet to each party's deposit wallet.

**Signer**: `executor` (leader or operator)

**Preconditions**:
- `MasterPolicy.status == Active`
- `FlightPolicy.status == NoClaim`
- `premium_distributed == false`
- `remaining_accounts` count = number of participants

**Amount Calculation**:
- Reinsurer share: `premium * reinsurer_effective_bps / 10000`
- Insurer share: `(premium - reinsurer share)` → distributed by `share_bps`

**Token Flow**:
```
leader_deposit_wallet ──(PDA-signed Transfer)──▶ Reinsurer Deposit Wallet
leader_deposit_wallet ──(PDA-signed Transfer)──▶ Participant A Deposit Wallet
leader_deposit_wallet ──(PDA-signed Transfer)──▶ Participant B Deposit Wallet
```

**State Transition**: `FlightPolicy.status` → `Expired`, `premium_distributed` → true

### 11.4 PDA Seeds

| Account | Seeds |
|---------|-------|
| MasterPolicy | `["master_policy", leader_pubkey, master_id_le_bytes]` |
| FlightPolicy | `["flight_policy", master_policy_pubkey, child_policy_id_le_bytes]` |

### 11.5 Authorization Matrix

| Instruction | Leader | Operator | Participant | Reinsurer |
|-------------|--------|----------|-------------|-----------|
| `create_master_policy` | **Required** | - | - | - |
| `register_participant_wallets` | - | - | **Required** | - |
| `confirm_master` | - | - | **Allowed** | **Allowed** |
| `activate_master` | - | **Required** | - | - |
| `create_flight_policy_from_master` | **Allowed** | **Allowed** | - | - |
| `resolve_flight_delay` | **Allowed** | **Allowed** | - | - |
| `settle_flight_claim` | **Allowed** | **Allowed** | - | - |
| `settle_flight_no_claim` | **Allowed** | **Allowed** | - | - |

### 11.6 End-to-End Flow Scenario

#### Master Contract Setup → Individual Insurance → Claim Settlement

```
Time ──────────────────────────────────────────────────────────────▶

 1. create_master_policy     2. register_participant_wallets (x N)
 Leader creates master       Each participant registers pool/deposit wallets
 [PendingConfirm]           pool_wallet, deposit_wallet recorded
     │                          │
     ▼                          ▼
 MasterPolicy created       Wallet info recorded

 3. confirm_master (x N)     4. activate_master
 Participants/reinsurer      Operator activates
 confirmed = true            [Active]
     │                          │
     ▼                          ▼
 All confirmed verified      Individual policies can be created

 5. create_flight_policy     6. resolve_flight_delay
 Create individual flight    Oracle delay resolution
 Premium prepaid             [Claimable or NoClaim]
 [AwaitingOracle]
     │                          │
     ▼                          ▼
 FlightPolicy created       Payout calculated / status determined
 Premium → leader_deposit

 7a. settle_flight_claim     7b. settle_flight_no_claim
 (if Claimable)              (if NoClaim)
 Collect claim funds         Distribute premium
 [Paid]                      [Expired]
     │                          │
     ▼                          ▼
 Pool wallets → leader       leader_deposit → deposit wallets
```

### 11.7 Account Sizes

| Account | Allocated Size | Notes |
|---------|---------------|-------|
| MasterPolicy | 4,096 bytes | MasterParticipant * 8 + fixed fields (with buffer) |
| FlightPolicy | 1,024 bytes | Fixed fields + String(subscriber_ref, flight_no, route) |
