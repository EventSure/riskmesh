# Open Parametric — Project Plan v1 and On-chain Design (Draft)

## 1. Project Summary
Open Parametric is a Solana-based parametric insurance infrastructure protocol. MVP focuses on a single insurance product: A→B flight delay insurance with a 2-hour departure delay threshold and a fixed full payout. The system is built for insurers (leader and participants) rather than end customers. On-chain logic standardizes policy terms, supports private co-underwriting, manages risk pools, and coordinates claims with oracle-based verification.

## 2. MVP Scope
- Product: Flight delay parametric insurance (A→B route, specific flight/date).
- Trigger: Departure delay >= 2 hours.
- Payout: Fixed full payout.
- Underwriting: Leader sets participation ratios; participants accept or reject.
- Funding: Participants escrow funds immediately upon acceptance.
- Claims: Oracle data determines delay; insurer approval is required before settlement (automation later).
- Policyholder onboarding: Minimal “data registration” only (no consumer UI).
- Risk Pool: On-chain pooled funds used for settlement.
- Oracle: Use existing oracle network with aviation data feed.

## 3. Key Users
- Leader insurer (creates policy, sets ratios, initiates lifecycle)
- Participant insurers (accept/reject ratios, escrow funds)
- Operator/admin (approves claims for now)

## 4. Oracle Usage (Existing Network)
- Select a Solana oracle network that provides aviation data for Korean flights.
- Policy stores the oracle feed account for the flight delay metric.
- Oracle feed values are read on-chain and validated by program (freshness and signature checks).
- Claim eligibility is created automatically once oracle indicates delay >= 2 hours.
- Final payout requires insurer approval in MVP (auto-approval later).

---

# On-chain Account Structure (Detailed Draft)

## 5. Accounts

### 5.1 `Policy`
Represents a single parametric insurance product.

Fields (draft):
- `policy_id` (u64)
- `leader` (Pubkey)
- `route` (e.g., `ICN-JFK` string or hashed bytes)
- `flight_no` (string or hashed bytes)
- `departure_date` (unix timestamp)
- `delay_threshold_min` (u16, 120 for 2 hours; 10-minute granularity)
- `payout_amount` (u64, in lamports or token units)
- `currency_mint` (Pubkey; SPL token mint)
- `oracle_feed` (Pubkey)
- `state` (enum)
- `underwriting` (Pubkey, points to Underwriting account)
- `pool` (Pubkey, points to RiskPool account)
- `created_at` (i64)
- `active_from` (i64)
- `active_to` (i64)

### 5.2 `Underwriting`
Stores co-underwriting structure and participation ratios.

Fields (draft):
- `policy` (Pubkey)
- `leader` (Pubkey)
- `participants` (Vec of `ParticipantShare`)
- `total_ratio` (u16, sum must be 10000 for 100.00%)
- `status` (enum)
- `created_at` (i64)

`ParticipantShare`:
- `insurer` (Pubkey)
- `ratio_bps` (u16; sum must be 10000)
- `status` (Pending/Accepted/Rejected)
- `escrow` (Pubkey, token account or vault)

### 5.3 `RiskPool`
Holds escrowed funds for a policy.

Fields (draft):
- `policy` (Pubkey)
- `currency_mint` (Pubkey)
- `vault` (Pubkey; token account or native SOL vault)
- `total_escrowed` (u64)
- `available_balance` (u64)
- `status` (enum)

### 5.4 `Claim`
Represents a claim for a specific policy and flight event.

Fields (draft):
- `policy` (Pubkey)
- `oracle_round` (u64)
- `oracle_value` (i64)
- `verified_at` (i64)
- `approved_by` (Pubkey)
- `status` (enum)
- `payout_amount` (u64)

### 5.5 `PolicyholderRegistry` (minimal, optional)
Stores minimal insured party data (non-PII placeholders for now).

Fields (draft):
- `policy` (Pubkey)
- `entries` (Vec of `PolicyholderEntry`)

`PolicyholderEntry`:
- `external_ref` (string or bytes)
- `premium_paid` (u64)
- `coverage_amount` (u64)
- `timestamp` (i64)

---

# On-chain State Transitions (Detailed Draft)

## 6. Policy Lifecycle States

Proposed `PolicyState`:
1. `Draft` — Policy created by leader; underwriting not opened.
2. `Open` — Underwriting open; participants can accept/reject.
3. `Funded` — All required shares accepted and escrowed.
4. `Active` — Coverage active and oracle monitoring enabled.
5. `Claimable` — Oracle indicates delay >= 2 hours.
6. `Approved` — Insurer approval provided (MVP requirement).
7. `Settled` — Payout executed and accounting updated.
8. `Expired` — Coverage window passed without claim.

## 7. Underwriting Lifecycle

`UnderwritingStatus`:
- `Proposed` → `Open` → `Finalized` (if all required shares accepted)
- `Failed` (if insufficient acceptance before deadline)

Transitions:
- Leader creates policy in `Draft` with underwriting ratios.
- Leader opens underwriting, state becomes `Open`.
- Participants accept or reject shares.
- On acceptance, escrow must be funded immediately.
- Once total accepted ratio == 10000 and all required escrow funded → `Finalized`.

## 8. Claim Lifecycle

`ClaimStatus`:
- `None` (no claim)
- `PendingOracle` (oracle check requested)
- `Claimable` (oracle condition met)
- `Approved` (manual insurer approval)
- `Settled` (payout executed)
- `Rejected` (oracle condition not met or manual rejection)

Flow:
1. During `Active`, system checks oracle feed at required time.
2. If delay >= 2 hours → create `Claim` and set `Claimable`.
3. Insurer approves to move `Claimable` → `Approved`.
4. Payout executed → `Settled` and policy → `Settled`.
5. If coverage window ends without claim → policy → `Expired` and escrow returned proportionally.

---

# Notes / Open Decisions
- Policyholder data schema is still undecided.
- Oracle network and exact feed format need confirmation (Korean flights).

---

# On-chain Detailed Design (v1)

## 9. Oracle Value Semantics
- Oracle feed value represents **departure delay in minutes**, rounded to **10-minute units**.
- Example: 0, 10, 20, 30 ...
- Threshold: `delay_threshold_min = 120`.
- Validation rule: `oracle_delay_min % 10 == 0`.

## 10. PDA and Account Addressing (Draft)

### PDAs
- `policy`: `PDA(["policy", leader, policy_id])`
- `underwriting`: `PDA(["underwriting", policy])`
- `risk_pool`: `PDA(["pool", policy])`
- `claim`: `PDA(["claim", policy, oracle_round])`
- `policyholder_registry`: `PDA(["registry", policy])`
- `vault`: token account owned by `risk_pool` PDA

Notes:
- `policy_id` is a leader-scoped sequential u64.
- `oracle_round` can be the feed round id or an epoch-based slot timestamp for uniqueness.

## 11. Instruction Set and Permissions

### Policy Creation
1. `create_policy` (leader only)
- Inputs: policy params, underwriting ratios, oracle_feed, payout
- Creates: `Policy`, `Underwriting`, `RiskPool` (empty), optional `Registry`
- Sets `Policy.state = Draft`

2. `open_underwriting` (leader only)
- Preconditions: `Policy.state == Draft`
- Sets `Policy.state = Open`, `Underwriting.status = Open`

### Underwriting Participation
3. `accept_share` (participant only)
- Preconditions: `Policy.state == Open`, share status `Pending`
- Escrow transfer into `RiskPool.vault` (SPL token transfer)
- Update share status `Accepted`
- Update `RiskPool.total_escrowed` and `available_balance`
- If total accepted ratio == 10000 → `Underwriting.status = Finalized`, `Policy.state = Funded`

4. `reject_share` (participant only)
- Preconditions: `Policy.state == Open`, share status `Pending`
- Update share status `Rejected`

5. `finalize_underwriting` (leader only, optional)
- Preconditions: `Underwriting.status = Finalized`
- Sets `Policy.state = Funded`

### Activation
6. `activate_policy` (leader only)
- Preconditions: `Policy.state == Funded`, current time within `active_from`
- Sets `Policy.state = Active`

### Claims
7. `check_oracle_and_create_claim` (anyone)
- Preconditions: `Policy.state == Active`
- Reads oracle feed, validates freshness and 10-minute granularity
- If delay >= threshold → create `Claim` with `ClaimStatus = Claimable`
- Sets `Policy.state = Claimable`

8. `approve_claim` (leader or designated operator)
- Preconditions: `ClaimStatus == Claimable`
- Sets `ClaimStatus = Approved`, `Policy.state = Approved`

9. `settle_claim` (leader or operator)
- Preconditions: `ClaimStatus == Approved`, pool has balance
- Transfers payout from pool to beneficiary escrow (or off-chain settlement account)
- Updates participant balances proportionally by `ratio_bps`
- Sets `ClaimStatus = Settled`, `Policy.state = Settled`

### Expiry / Refund
10. `expire_policy` (anyone)
- Preconditions: `Policy.state == Active`, current time > `active_to`
- Sets `Policy.state = Expired`

11. `refund_after_expiry` (participant)
- Preconditions: `Policy.state == Expired`
- Refund participant escrow proportionally

## 12. Validation / Safety Rules (Draft)
- `ratio_bps` sum must equal 10000.
- All escrow must be deposited before `Policy.state` can move to `Funded`.
- `payout_amount` must not exceed `RiskPool.available_balance`.
- Oracle data must be within freshness window (e.g., last 30 minutes).
- Oracle delay value must be in 10-minute increments.
- Only one active claim per policy.

## 13. Token Flow (SPL)
- Participants deposit SPL tokens into `RiskPool.vault`.
- Payouts are transferred from `RiskPool.vault`.
- If no claim, escrow is returned pro-rata.

---

# On-chain Detailed Design (v1.1) — Account Size and PDA Seeds

## 14. PDA Seeds (Finalized for Now)
- `policy`: `PDA([\"policy\", leader, policy_id])`
- `underwriting`: `PDA([\"underwriting\", policy])`
- `risk_pool`: `PDA([\"pool\", policy])`
- `claim`: `PDA([\"claim\", policy, oracle_round])`
- `policyholder_registry`: `PDA([\"registry\", policy])`
- `vault`: SPL token account owned by `risk_pool` PDA

Notes:
- `policy_id` is a leader-scoped sequential `u64`.
- `oracle_round` is a `u64` (e.g., feed round id or slot-based timestamp).

## 15. Account Size Estimates (Anchor-style, Draft)
These estimates assume Anchor-style accounts with an 8-byte discriminator. Variable-length fields require explicit max sizes. Sizes should be finalized after defining maximum string/vector lengths.

### Common Sizing Rules
- `u8`: 1 byte
- `u16`: 2 bytes
- `u32`: 4 bytes
- `u64`: 8 bytes
- `i64`: 8 bytes
- `Pubkey`: 32 bytes
- `String`: 4-byte length prefix + max bytes
- `Vec<T>`: 4-byte length prefix + max elements * size(T)

### Proposed Max Lengths (Draft)
- `MAX_ROUTE_LEN = 16` (e.g., `ICN-JFK`)
- `MAX_FLIGHT_NO_LEN = 16` (e.g., `KE081`)
- `MAX_EXTERNAL_REF_LEN = 32`
- `MAX_PARTICIPANTS = 16`
- `MAX_POLICYHOLDERS = 128`

### `Policy` Size (Draft)
Fields (fixed sizes):
- `policy_id` 8
- `leader` 32
- `delay_threshold_min` 2
- `payout_amount` 8
- `currency_mint` 32
- `oracle_feed` 32
- `state` 1
- `underwriting` 32
- `pool` 32
- `created_at` 8
- `active_from` 8
- `active_to` 8

Variable fields:
- `route` 4 + `MAX_ROUTE_LEN`
- `flight_no` 4 + `MAX_FLIGHT_NO_LEN`
- `departure_date` 8 (if stored as `i64`) — add only if kept

Estimated size:
- Fixed = 211 bytes (without `departure_date`)
- Add `route` + `flight_no` + optional `departure_date`

Anchor allocation example:
- `8 (discriminator)` + `fixed` + `route` + `flight_no` + optional `departure_date`

### `ParticipantShare` Size (Draft)
- `insurer` 32
- `ratio_bps` 2
- `status` 1
- `escrow` 32
- Total = 67 bytes

### `Underwriting` Size (Draft)
Fixed fields:
- `policy` 32
- `leader` 32
- `total_ratio` 2
- `status` 1
- `created_at` 8

Variable:
- `participants` Vec<ParticipantShare>
  - 4 + `MAX_PARTICIPANTS * 67`

Estimated size:
- `fixed` 75 bytes + `participants`
- Anchor allocation example:
  - `8 + 75 + 4 + (MAX_PARTICIPANTS * 67)`

### `RiskPool` Size (Draft)
- `policy` 32
- `currency_mint` 32
- `vault` 32
- `total_escrowed` 8
- `available_balance` 8
- `status` 1
- Total = 113 bytes
- Anchor allocation example: `8 + 113`

### `Claim` Size (Draft)
- `policy` 32
- `oracle_round` 8
- `oracle_value` 8
- `verified_at` 8
- `approved_by` 32
- `status` 1
- `payout_amount` 8
- Total = 97 bytes
- Anchor allocation example: `8 + 97`

### `PolicyholderEntry` Size (Draft)
- `external_ref` 4 + `MAX_EXTERNAL_REF_LEN`
- `premium_paid` 8
- `coverage_amount` 8
- `timestamp` 8
- Total = `28 + MAX_EXTERNAL_REF_LEN`

### `PolicyholderRegistry` Size (Draft)
Fixed fields:
- `policy` 32
Variable:
- `entries` Vec<PolicyholderEntry>
  - 4 + `MAX_POLICYHOLDERS * (28 + MAX_EXTERNAL_REF_LEN)`

Anchor allocation example:
- `8 + 32 + 4 + MAX_POLICYHOLDERS * (28 + MAX_EXTERNAL_REF_LEN)`

## 16. Finalization Checklist
- Confirm if `route`, `flight_no` are stored as `String` or fixed bytes.
- Confirm `MAX_PARTICIPANTS` and `MAX_POLICYHOLDERS`.
- Confirm if `departure_date` is stored in `Policy`.
- Confirm `oracle_round` type (round id vs slot timestamp).
