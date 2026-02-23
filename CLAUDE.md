# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Open Parametric** — Solana-based parametric insurance infrastructure protocol. MVP targets a single product: flight delay insurance (route A→B, 2-hour delay threshold, fixed payout). Written in Rust using the Anchor framework, with a static HTML/CSS frontend preview (no backend).

## Build & Test

From within `contract/`:

```bash
# Build the Anchor program
anchor build

# Run tests (requires local validator)
anchor test

# Generate/list program keypair
anchor keys list
```

Tests run via `yarn mocha` against `contract/tests/open_parametric.ts`.

> **Important:** The `declare_id!` in `lib.rs` and the program ID in `Anchor.toml` are currently placeholders (`OpenParametric11111111111111111111111111111111`). Before deploying, run `anchor keys list` and replace both.

## Architecture

### Repository Structure

- `contract/` — Anchor/Solana program (`open_parametric`)
  - `programs/open_parametric/src/lib.rs` — entire program (single file)
  - `tests/open_parametric.ts` — TypeScript integration tests (scaffold only)
  - `Anchor.toml` — cluster config (`localnet`), wallet path, test script
- `frontend/` — Static HTML/CSS preview console (no JS logic, no wallet integration)
- `OpenParametric.md` — Full design document (Korean): account schemas, state machines, oracle spec, size calculations

### On-Chain Accounts & PDAs

| Account | PDA Seeds | Purpose |
|---|---|---|
| `Policy` | `["policy", leader, policy_id_le]` | Single insurance product |
| `Underwriting` | `["underwriting", policy]` | Co-insurance ratios & participant state |
| `RiskPool` | `["pool", policy]` | Escrowed funds metadata |
| `Claim` | `["claim", policy, oracle_round_le]` | Oracle-triggered claim |
| `PolicyholderRegistry` | `["registry", policy]` | Policyholder external refs (no PII) |
| vault (SPL TokenAccount) | Associated token account of `risk_pool` PDA | Actual SPL token custody |

### State Machines

**Policy lifecycle:** `Draft → Open → Funded → Active → Claimable → Approved → Settled` (or `Expired`)

**Underwriting:** `Proposed → Open → Finalized` (or `Failed`)

**Claim:** `Claimable → Approved → Settled` (or `Rejected`)

### Instructions & Authorization

| Instruction | Signer |
|---|---|
| `create_policy` | Leader |
| `open_underwriting` | Leader |
| `accept_share` | Participant (deposits SPL tokens into vault) |
| `reject_share` | Participant |
| `activate_policy` | Leader |
| `check_oracle_and_create_claim` | Anyone (public) |
| `approve_claim` | Leader |
| `settle_claim` | Leader (transfers from vault to beneficiary) |
| `expire_policy` | Anyone (public, time-gated) |
| `refund_after_expiry` | Participant |
| `register_policyholder` | Leader |

### Oracle Integration (Switchboard On-Demand)

`check_oracle_and_create_claim` requires **three instructions in the same transaction**:
1. Ed25519 verification instruction
2. Switchboard `verified_update` instruction
3. This program's `check_oracle_and_create_claim`

The oracle feed account address must match `Policy.oracle_feed` and the Switchboard canonical key derived from `(queue, feed_id)`. Oracle value represents delay in **10-minute increments** (`delay_min % 10 == 0`). Staleness limit: `ORACLE_MAX_STALENESS_SLOTS = 150` slots (~60–90s).

### Key Constants

```rust
DELAY_THRESHOLD_MIN: u16 = 120          // 2 hours, fixed for MVP
ORACLE_MAX_STALENESS_SLOTS: u64 = 150
MAX_PARTICIPANTS: usize = 16
MAX_POLICYHOLDERS: usize = 128
MAX_ROUTE_LEN: usize = 16
MAX_FLIGHT_NO_LEN: usize = 16
MAX_EXTERNAL_REF_LEN: usize = 32
```

Ratios use basis points: 10000 bps = 100%. All participant ratios must sum to exactly 10000 bps before `Underwriting` can finalize.

### SPL Token Flow

- Participants transfer tokens to `vault` (ATA owned by `risk_pool` PDA) on `accept_share`
- On `settle_claim`: `risk_pool` PDA signs a transfer from `vault` to `beneficiary_token`
- On `refund_after_expiry`: same PDA-signed transfer back to participant's token account
- `RiskPool.available_balance` tracks spendable balance; `total_escrowed` tracks cumulative deposits

### Dependencies

- `anchor-lang = "0.30.0"`
- `anchor-spl = "0.30.0"`
- `switchboard-on-demand = "0.8.0"`
