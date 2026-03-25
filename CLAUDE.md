# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Open Parametric** — Solana-based parametric insurance infrastructure protocol. MVP product: flight delay insurance. Written in Rust using the Anchor framework, with a Rust oracle daemon backend and a React/TypeScript frontend dashboard.

## Build & Test

### Anchor Program (from `contract/`)

```bash
# Build
anchor build

# Run all tests against local validator
anchor test

# Run tests directly (after validator is up)
yarn test

# Run a single test file
yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/settle_flight_claim.ts

# List program keypair
anchor keys list
```

Tests use `ts-mocha` against `contract/tests/*.ts`. The program ID in `lib.rs` and `Anchor.toml` must match — run `anchor keys list` to get the deployed key.

### Backend Oracle Daemon (from `backend/`)

```bash
# Build
cargo build

# Run (requires .env file — copy from .env.example)
cp .env.example .env   # fill in PROGRAM_ID, LEADER_PUBKEY, SWITCHBOARD_QUEUE
cargo run

# Log level controlled by RUST_LOG (default: info)
RUST_LOG=debug cargo run
```

### Frontend (from `frontend/`)

```bash
# Install dependencies
npm install

# Dev server (http://localhost:5173/riskmesh/)
npm run dev

# Type-check + production build
npm run build

# Run tests (vitest)
npm test

# Watch mode
npm run test:watch

# Lint / format
npm run lint
npm run format
```

### Demo Scripts (from `contract/`, against devnet)

```bash
# Legacy Policy flow (localnet)
yarn demo:setup && yarn demo:create-policy && yarn demo:open-uw \
  && yarn demo:accept-shares && yarn demo:activate

# Master/Flight flow (devnet)
yarn demo:master-setup   # creates MasterPolicy + confirms participants
yarn demo:flight-create  # issues a FlightPolicy under the master
yarn demo:settle         # runs resolve + settle after oracle check
```

## Architecture

### Repository Structure

```
contract/programs/open_parametric/src/
  lib.rs                   — entry point; re-exports all instructions
  constants.rs             — all sizing and domain constants
  errors.rs                — OpenParamError enum
  state.rs                 — all account structs and enums
  math.rs                  — tiered_payout, split_by_bps, effective_reinsurer_bps
  instructions/            — one file per instruction (+ *_test.rs unit tests)
backend/src/
  main.rs                  — tokio entry; loads config, starts scheduler
  config.rs                — Config::from_env() (reads .env)
  scheduler.rs             — cron job runner (default: every 15 min)
  oracle/track_a.rs        — AviationStack path: scan FlightPolicy → resolve → settle
  oracle/track_b.rs        — Switchboard path: scan Policy → check_oracle → approve → settle
  solana/client.rs         — RPC wrapper (get_program_accounts, send_tx)
  solana/pda.rs            — PDA derivation helpers
  flight_api.rs            — AviationStack HTTP client
  switchboard.rs           — Switchboard Crossbar fetch helpers
frontend/src/
  App.tsx                  — providers tree + routes (/  → LandingPage, /demo → Dashboard)
  store/useProtocolStore.ts — Zustand store; simulation state + onchain sync
  lib/idl/                 — generated Anchor IDL (open_parametric.ts + .json)
  lib/pda.ts               — client-side PDA derivation helpers (mirrors backend/solana/pda.rs)
  lib/constants.ts         — PROGRAM_ID, RPC_ENDPOINT, payout defaults
  hooks/                   — one hook per on-chain instruction (useCreateMasterPolicy, etc.)
  components/tabs/         — tab-contract, tab-feed, tab-oracle, tab-settlement, tab-inspector
  i18n/locales/            — ko.ts / en.ts (react-i18next)
```

### Two Policy Designs

**Legacy design** — co-insurance pool with Switchboard oracle (Track B):

| Account | PDA Seeds | Purpose |
|---|---|---|
| `Policy` | `["policy", leader, policy_id_le]` | Single insurance product |
| `Underwriting` | `["underwriting", policy]` | Co-insurance ratios & participant state |
| `RiskPool` | `["pool", policy]` | Escrowed funds metadata |
| `Claim` | `["claim", policy, oracle_round_le]` | Oracle-triggered claim |
| `PolicyholderRegistry` | `["registry", policy]` | Policyholder external refs |
| vault | ATA of `risk_pool` PDA | SPL token custody |

Policy lifecycle: `Draft → Open → Funded → Active → Claimable → Approved → Settled` (or `Expired`)

**Master/Flight design** — trusted resolver with tiered payouts (Track A):

| Account | PDA Seeds | Purpose |
|---|---|---|
| `MasterPolicy` | `["master_policy", leader, master_id_le]` | Co-insurance agreement + reinsurance terms |
| `FlightPolicy` | `["flight_policy", master_policy, child_policy_id_le]` | Individual flight issued under a master |

MasterPolicy lifecycle: `Draft → PendingConfirm → Active → Closed/Cancelled`
FlightPolicy lifecycle: `Issued → AwaitingOracle → Claimable/NoClaim → Paid/Expired`

### Oracle Daemon Tracks

**Track A** (`oracle/track_a.rs`): calls AviationStack API for flight data → sends `resolve_flight_delay` tx (sets delay/cancelled on `FlightPolicy`) → automatically calls `settle_flight_claim` or `settle_flight_no_claim`.

**Track B** (`oracle/track_b.rs`): fetches Switchboard On-Demand update from Crossbar API → sends a 3-instruction transaction: `[Ed25519 ix, verified_update ix, check_oracle_and_create_claim]` → if delay ≥ 120 min, automatically calls `approve_claim` then `settle_claim`.

Both tracks run in the same cron cycle via `scheduler::run_oracle_check`.

### Instructions & Authorization

| Instruction | Signer | Notes |
|---|---|---|
| `create_policy` | Leader | Creates Policy + Underwriting + RiskPool + Registry in one tx |
| `open_underwriting` | Leader | Policy must be Draft |
| `accept_share` | Participant | Deposits SPL tokens into vault; ratio_bps > 0 required |
| `reject_share` | Participant | Validates `insurer == participant.pubkey` |
| `activate_policy` | Leader | Moves Policy to Active |
| `check_oracle_and_create_claim` | Anyone | Requires 3 ixs in same tx (Ed25519 + Switchboard + this) |
| `approve_claim` / `settle_claim` | Leader | Auto-called by Track B daemon |
| `expire_policy` / `refund_after_expiry` | Anyone / Participant | Time-gated |
| `create_master_policy` | Leader | Sets tiered payouts + ceded/reins ratios |
| `confirm_master` | Participant or Reinsurer | `role: u8` (0=Participant, 1=Reinsurer) |
| `activate_master` | Leader | All participants must have confirmed |
| `create_flight_policy_from_master` | Anyone (operator) | Issues child FlightPolicy |
| `resolve_flight_delay` | Leader or Operator | Sets delay_minutes + payout tier |
| `settle_flight_claim` / `settle_flight_no_claim` | Leader or Operator | Auto-called by Track A daemon |

### SPL Token Flow

**Legacy:** participants deposit to vault (ATA of `risk_pool` PDA) on `accept_share`. On `settle_claim`, `risk_pool` PDA signs transfer from vault to `beneficiary_token`. On `refund_after_expiry`, same PDA signs transfer back to participant.

**Master/Flight:** on `settle_flight_claim`, payout is split by `calc_claim_split` (reinsurer effective bps first, remainder by participant share bps), with transfers from each participant's `pool_wallet` and the `reinsurer_pool_wallet` to `leader_deposit_wallet`. On `settle_flight_no_claim`, premiums flow from `leader_deposit_wallet` to each participant's `deposit_wallet`.

### Math Helpers (`math.rs`)

- `tiered_payout(delay_minutes, cancelled, tiers)` — 2h/3h/4-5h/6h+ tiers; returns 0 if < 120 min
- `split_by_bps(total, ratios_bps)` — splits amount by bps array; remainder added to first slot
- `effective_reinsurer_bps(ceded_bps, commission_bps)` — `ceded * (1 - commission) / 10000`

### Key Constants

```rust
DELAY_THRESHOLD_MIN: u16 = 120          // 2 hours
ORACLE_MAX_STALENESS_SLOTS: u64 = 150   // ~60-90s
MAX_PARTICIPANTS: usize = 16
MAX_MASTER_PARTICIPANTS: usize = 8
MAX_POLICYHOLDERS: usize = 128
REGISTRY_SPACE: usize = 8192            // constrained by 10240-byte CPI realloc limit
```

Ratios use basis points: 10000 bps = 100%. All participant ratios must sum to exactly 10000 bps.

### Frontend Architecture

The frontend is a React 19 + Vite + TypeScript SPA, styled with Emotion (`jsxImportSource: '@emotion/react'`, `@emotion/babel-plugin`). The `@` alias resolves to `frontend/src/`.

**Routing:** `BrowserRouter` with `basename="/riskmesh"`. Two pages: `/` (LandingPage) and `/demo` (Dashboard). The Dashboard is a tabbed layout (`tab-contract`, `tab-feed`, `tab-oracle`, `tab-settlement`, `tab-inspector`).

**State:** A single Zustand store (`useProtocolStore`) drives all UI state. It has two modes:
- `simulation` — all actions are local state mutations; no wallet required
- `onchain` — actions send real Anchor transactions; `ChainSyncer` component polls `MasterPolicyAccount` and `FlightPolicy` accounts and calls `syncMasterFromChain` / `syncFlightPoliciesFromChain` to update the store

**On-chain integration:** `useProgram()` constructs an `AnchorProvider` + `Program` from the wallet adapter connection. Each instruction has a dedicated hook in `hooks/` (e.g. `useCreateMasterPolicy`, `useSettleFlight`). The IDL at `lib/idl/open_parametric.json` must be regenerated after `anchor build` (`anchor build` outputs it to `target/idl/`). Client-side PDA derivation is in `lib/pda.ts` — seeds must stay in sync with the on-chain program.

**Styling convention:** Use Emotion `styled` components and `p.theme.*` tokens (from `src/styles/theme.ts`). Avoid raw `var(--*)` CSS variables in new code. Common primitives (`Card`, `Button`, `Tag`, `Form`, `SummaryRow`, `Divider`, `Mono`) are exported from `components/common/`.

**i18n:** `react-i18next` with `ko` and `en` locales in `src/i18n/locales/`. Add both locale keys when adding new strings.

**Frontend tests:** Vitest with jsdom. Test files live under `src/**/__tests__/`. Run a single test: `npx vitest run src/lib/__tests__/pda.test.ts`.

### Dependencies

**Contract:**
- `anchor-lang = "0.31.1"`, `anchor-spl = "0.31.1"`
- `switchboard-on-demand = { version = "0.9.5", features = ["anchor"] }`
- `blake3` pinned to `1.8.2` in `Cargo.lock` (avoids `constant_time_eq` edition2024 conflict)

**Frontend:** React 19, `@coral-xyz/anchor ^0.31.1`, `@solana/wallet-adapter-*`, `@tanstack/react-query ^5`, `zustand ^5`, `chart.js` + `react-chartjs-2`, `i18next`.

**Toolchain:** Solana CLI 2.3.13, platform-tools v1.48, Rust 1.84.1 (BPF). If `anchor build` fails due to host-std issues, run `cargo-build-sbf --force-tools-install`.

### Anchor 0.31 camelCase Quirk

Anchor 0.31 capitalizes the **first alphabetic character** of each underscore-delimited segment, not the first character of the segment string:
- `payout_delay_2h` → `payoutDelay2H` (not `payoutDelay2h`)
- `payout_delay_4to5h` → `payoutDelay4To5H`

If wrong camelCase keys are passed, Anchor silently serializes the field as `0`. Verify with `Object.keys(account)` at runtime when debugging.
