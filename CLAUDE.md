# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Open Parametric** — Solana-based parametric insurance infrastructure protocol. MVP product: flight delay insurance. Written in Rust using the Anchor framework, with a Rust oracle daemon backend and a React/TypeScript frontend dashboard.

## Build & Test

### Anchor Program (from `contract/`)

```bash
# Build
anchor build

# After build, sync the IDL to the frontend
cp target/idl/open_parametric.json ../frontend/src/lib/idl/open_parametric.json

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

Required env vars: `PROGRAM_ID`, `LEADER_PUBKEY`, `SWITCHBOARD_QUEUE`, `AVIATIONSTACK_API_KEY`. Optional: `DB_BACKEND` (`sqlite`|`firebase`), `DATABASE_PATH`, `WEB_BIND_ADDR` (default: `0.0.0.0:3000`), `ORACLE_CHECK_CRON`, `DB_SYNC_CRON`.

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

# Run a single test file
npx vitest run src/lib/__tests__/pda.test.ts

# Lint / format
npm run lint
npm run format
```

### Demo Scripts (from `contract/`, against devnet)

Scripts override cluster to devnet via `ANCHOR_PROVIDER_URL`; `Anchor.toml` defaults to localnet.

```bash
yarn demo:1-setup         # mint + airdrop setup
yarn demo:2-feed-create   # create Switchboard feed
yarn demo:3-master-setup  # create MasterAgreement + confirm participants
yarn demo:4-flight-create # issue a FlightPolicy under the master
yarn demo:5a-resolve      # resolve flight delay (Track A)
yarn demo:5b-claim        # settle claim (Track B)
yarn demo:6-settle        # settle no-claim
yarn demo:manual-list     # list current on-chain accounts
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
  main.rs                  — tokio entry; loads config, starts scheduler + API server
  config.rs                — Config::from_env() (reads .env)
  scheduler.rs             — two cron jobs: oracle check (default 15 min) + DB sync (30 s)
  oracle/track_a.rs        — AviationStack path: scan FlightPolicy → resolve → settle
  oracle/track_b.rs        — Switchboard path: scan FlightPolicy → check_oracle → settle
  api/                     — Axum REST API + SSE server (port 3000)
  db/                      — SQLite on-chain snapshot cache (InsuranceRepository trait)
  firebase/                — Firebase Firestore alternative backend
  events/                  — EventBus for SSE streams to frontend
  solana/client.rs         — RPC wrapper (get_program_accounts, send_tx)
  solana/pda.rs            — PDA derivation helpers
  flight_api.rs            — AviationStack HTTP client
  switchboard.rs           — Switchboard Crossbar fetch helpers
frontend/src/
  App.tsx                  — providers tree + routes + ChainSyncer component
  store/useProtocolStore.ts — Zustand store; simulation state + onchain sync
  lib/idl/                 — generated Anchor IDL (open_parametric.ts + .json)
  lib/pda.ts               — client-side PDA derivation (mirrors backend/solana/pda.rs)
  lib/constants.ts         — PROGRAM_ID, RPC_ENDPOINT, BACKEND_URL, payout defaults
  hooks/                   — one hook per on-chain instruction (useCreateMasterAgreement, etc.)
  services/insurerApi.ts   — HTTP client for backend REST API (enroll, fetch policies)
  components/tabs/         — tab-contract, tab-feed, tab-oracle, tab-settlement, tab-inspector
  i18n/locales/            — ko.ts / en.ts (react-i18next)
```

### On-Chain Design: Master/Flight

The protocol uses a two-level account structure:

| Account | PDA Seeds | Purpose |
|---|---|---|
| `MasterAgreement` | `["master_agreement", leader, master_id_le]` | Co-insurance agreement + reinsurance terms |
| `FlightPolicy` | `["flight_policy", master_agreement, child_policy_id_le]` | Individual flight issued under a master |

MasterAgreement lifecycle: `Draft → PendingConfirm → Active → Closed/Cancelled`
FlightPolicy lifecycle: `Issued → AwaitingOracle → Claimable/NoClaim → Paid/Expired`

### Oracle Daemon Tracks

**Track A** (`oracle/track_a.rs`): calls AviationStack API for flight data → sends `resolve_flight_delay` tx (sets delay/cancelled on `FlightPolicy`) → automatically calls `settle_flight_claim` or `settle_flight_no_claim`.

**Track B** (`oracle/track_b.rs`): fetches Switchboard On-Demand update from Crossbar API → sends a 3-instruction transaction: `[Ed25519 ix, verified_update ix, check_oracle_and_resolve_flight]` → if delay ≥ 120 min, automatically calls `settle_flight_claim`.

Both tracks run in the same cron cycle via `scheduler::run_oracle_check`. A separate `run_db_sync` job snapshots on-chain state to the DB backend every 30 seconds.

### Instructions & Authorization

| Instruction | Signer | Notes |
|---|---|---|
| `create_master_agreement` | Leader | Sets tiered payouts + ceded/reins ratios |
| `register_participant_wallets` | Leader | Registers token wallet PDAs for all participants |
| `confirm_master` | Participant or Reinsurer | `role: u8` (0=Participant, 1=Reinsurer) |
| `activate_master` | Leader | All participants must have confirmed |
| `create_flight_policy_from_master` | Anyone (operator) | Issues child FlightPolicy |
| `resolve_flight_delay` | Leader or Operator | Track A: sets delay_minutes + triggers settlement |
| `check_oracle_and_resolve_flight` | Anyone | Track B: requires 3 ixs in same tx (Ed25519 + Switchboard + this) |
| `settle_flight_claim` | Leader or Operator | Auto-called after delay confirmed |
| `settle_flight_no_claim` | Leader or Operator | Auto-called when no delay |

### SPL Token Flow

On `settle_flight_claim`, payout is split by `calc_claim_split` (reinsurer effective bps first, remainder by participant share bps), with transfers from each participant's `pool_wallet` and the `reinsurer_pool_wallet` to `leader_deposit_wallet`. On `settle_flight_no_claim`, premiums flow from `leader_deposit_wallet` to each participant's `deposit_wallet`.

### Math Helpers (`math.rs`)

- `tiered_payout(delay_minutes, cancelled, tiers)` — 2h/3h/4-5h/6h+ tiers; returns 0 if < 120 min
- `split_by_bps(total, ratios_bps)` — splits amount by bps array; remainder added to first slot
- `effective_reinsurer_bps(ceded_bps, commission_bps)` — `ceded * (1 - commission) / 10000`

### Key Constants

```rust
ORACLE_MAX_STALENESS_SLOTS: u64 = 150   // ~60-90s
MAX_MASTER_PARTICIPANTS: usize = 4
MAX_ROUTE_LEN: usize = 16
MAX_FLIGHT_NO_LEN: usize = 16
MAX_SUBSCRIBER_REF_LEN: usize = 64
```

Ratios use basis points: 10000 bps = 100%. All participant ratios must sum to exactly 10000 bps.

Frontend key constants (`lib/constants.ts`):
- `PROGRAM_ID` — deployed program address (devnet: `ETEEEss...`)
- `CURRENCY_MINT` — SPL token mint used for all premiums and payouts (devnet: `5YsAiRY...`)
- `BACKEND_URL` — defaults to `http://localhost:3000`; override with `VITE_BACKEND_URL` env var

### Frontend Architecture

The frontend is a React 19 + Vite + TypeScript SPA, styled with Emotion (`jsxImportSource: '@emotion/react'`). The `@` alias resolves to `frontend/src/`.

**Routing:** `BrowserRouter` with `basename="/riskmesh"`. Four pages:
- `/` → `LandingPage`
- `/dashboard` → `Dashboard` (wrapped in `Layout`; tabbed: contract, feed, oracle, settlement, inspector)
- `/portal` → `PortalPage` (operator/insurer portal)
- `/insurance` → `InsurancePage` (policyholder enrollment flow)

**State:** A single Zustand store (`useProtocolStore`) drives all UI state. It has two modes:
- `simulation` — all actions are local state mutations; no wallet required
- `onchain` — actions send real Anchor transactions; `ChainSyncer` component (in `App.tsx`) polls `MasterAgreementAccount` and `FlightPolicy` accounts and calls `syncMasterFromChain` / `syncFlightPoliciesFromChain` to update the store

**On-chain integration:** `useProgram()` constructs an `AnchorProvider` + `Program` from the wallet adapter connection. Each instruction has a dedicated hook in `hooks/`. The IDL at `lib/idl/open_parametric.json` must be copied from `contract/target/idl/` after every `anchor build` — it is not auto-synced. Client-side PDA derivation is in `lib/pda.ts` — seeds must stay in sync with the on-chain program.

**Backend API integration:** `services/insurerApi.ts` calls the Axum REST API (URL from `lib/constants.ts` `BACKEND_URL`). The backend also pushes real-time events via SSE.

**Styling convention:** Use Emotion `styled` components and `p.theme.*` tokens (from `src/styles/theme.ts`). Avoid raw `var(--*)` CSS variables in new code. Common primitives (`Card`, `Button`, `Tag`, `Form`, `SummaryRow`, `Divider`, `Mono`) are exported from `components/common/`.

**i18n:** `react-i18next` with `ko` and `en` locales in `src/i18n/locales/`. Add both locale keys when adding new strings.

**Frontend tests:** Vitest with jsdom. Test files live under `src/**/__tests__/`.

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
