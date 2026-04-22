# Riskmesh (Open Parametric)

[한국어](README.ko.md)

**Programmable settlement infrastructure for parametric insurance on Solana.**

Parametric insurance pays the moment an event happens — not after measuring exact damage. The market is scaling toward $40B, yet the settlement infrastructure behind it remains manual and analog. Policies are issued digitally, but insurers still reconcile balances by hand after events.

**Open Parametric** makes settlement programmable. Instead of reconciling after the event, the event updates the shared financial state itself — one on-chain truth, no disputes, no lag. The architecture is a three-tier system: an operator frontend for insurers, an off-chain oracle worker that verifies real-world events, and a Solana on-chain program that manages capital and state transitions deterministically.

The MVP targets **flight delay insurance** (a $10B+ market with 30% of flights delayed at major airports), with a modular architecture that extends to weather, supply chains, and natural disasters.

## Structure

- `contract/` — Anchor-based on-chain program (Rust)
- `backend/` — Oracle daemon + REST API server (Rust, Axum)
- `frontend/` — Operator dashboard & insurance portal (React + Vite + Emotion)
- `docs/` — Testing guides and design documents

## Key Features

- **Event-driven settlement** — claims settle on-chain as the event happens, no reconciliation step
- **Tiered payouts** — 2h / 3h / 4-5h / 6h+ delay tiers, plus cancellation override
- MasterAgreement + FlightPolicy architecture: one co-insurance agreement covers many individual flight contracts
- Co-underwriting with leader, participants, and reinsurer (basis-point ratios, on-chain confirmation)
- Modular oracle integration — centralized (AviationStack API via Track A) or decentralized (Switchboard On-Demand via Track B)
- REST API server with on-chain data sync (SQLite / Firebase Firestore)
- Real-time event streaming via SSE (Server-Sent Events)
- Tab-based operator UI (Contract / Feed / Oracle / Settlement / Inspector)
- Insurance portal for policy subscribers and insurer management

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | LandingPage | Project introduction and entry point |
| `/demo` | Dashboard | Tab-based operator dashboard (Contract / Feed / Oracle / Settlement / Inspector) |
| `/portal` | PortalPage | Master policy portal for participants |
| `/insurance` | InsurancePage | Insurance subscription and insurer management |

## Demo Modes

The `/demo` dashboard supports two operating modes, toggled from the header:

| Mode | Description | Wallet Required |
|------|-------------|-----------------|
| **DEVNET** (default) | On-chain mode — interacts with Solana devnet via connected wallet | Yes |
| **SIM** | Simulation mode — all data is local, no on-chain transactions | No |

Switch modes via the **DEVNET / SIM** toggle in the top-right header. SIM mode is available for offline testing without a wallet connection.

## Docs

### `contract/docs/`

| File | Description |
|------|-------------|
| [`oracle.md`](contract/docs/oracle.md) | Oracle integration guide — Track A (centralized) & Track B (Switchboard On-Demand) (Korean) |
| [`setup-and-test.md`](contract/docs/setup-and-test.md) | Development environment setup, test suite overview, demo scripts (Korean) |

### `docs/`

| File | Description |
|------|-------------|
| [`CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) | Contract testing guide — unit, integration, and settlement tests (Korean) |
| [`FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) | Frontend unit testing guide — business logic tests (Korean) |
| [`feature/settle_flight_settlement.md`](docs/feature/settle_flight_settlement.md) | Flight settlement logic — claim and no-claim flows (Korean) |

### `contract/`

| File | Description |
|------|-------------|
| [`README.md`](contract/README.md) | Contract setup notes — program ID, build/test, CI trigger |

### `backend/docs/`

| File | Description |
|------|-------------|
| [`backend-overview.md`](backend/docs/backend-overview.md) | Backend architecture — modules, config, oracle pipelines (Korean) |
| [`e2e-workflow.md`](backend/docs/e2e-workflow.md) | End-to-end operational guide — setup, daemon, settlement (Korean) |
| [`local-run.md`](backend/docs/local-run.md) | Local development quick start guide (Korean) |
| [`flight-policies-api-response-explained.md`](backend/docs/flight-policies-api-response-explained.md) | `/api/flight-policies` response key reference (Korean) |
| [`leader-flight-policy-ingestion-plan.md`](backend/docs/leader-flight-policy-ingestion-plan.md) | Leader-side policy ingestion API design plan (Korean) |
| [`track-b-explained.md`](backend/docs/track-b-explained.md) | Track B (Switchboard On-Demand) detailed walkthrough (Korean) |

### `frontend/docs/`

| File | Description |
|------|-------------|
| [`demo_code_refactor.md`](frontend/docs/demo_code_refactor.md) | Demo-only code removal guide for production transition |
| [`deployment-guide.md`](frontend/docs/deployment-guide.md) | Frontend + contract deployment checklist (IDL, PROGRAM_ID, CURRENCY_MINT) |

## Oracle Architecture

The oracle integration uses a **modular, dual-track design** — the same contract supports both centralized and decentralized oracle strategies, selectable per deployment scenario. Both tracks use [AviationStack API](https://aviationstack.com) as the flight delay data source.

| Track | Strategy | Trust Model | Target Account |
|-------|----------|-------------|----------------|
| **Track A** — Trusted Resolver | Leader/Operator fetches AviationStack data and calls `resolve_flight_delay` on-chain | Centralized (signer trust) | `FlightPolicy` |
| **Track B** — Switchboard On-Demand | Switchboard oracle nodes fetch API data, sign and write to an on-chain feed; `check_oracle_and_resolve_flight` verifies cryptographically | Decentralized (cryptographic verification) | `FlightPolicy` |

**In demo/simulation mode**, oracle resolution is triggered manually via the dashboard UI — no external API or oracle network is required.

This modular design allows flexible adoption:
- **Demo/local testing** — manual trigger, no external dependencies
- **Centralized production** — Track A with a trusted operator and real-time flight API
- **Decentralized production** — Track B with Switchboard oracle network for trustless verification

For full details, see [`contract/docs/oracle.md`](contract/docs/oracle.md).

## Why Solana

A flight is delayed by 2 hours. In the same transaction where the oracle posts the data, a claim is automatically created and settlement is atomically executed across three insurers' ratios. No human intervention, no paperwork, no system downtime.

Building this workflow on legacy infrastructure — oracle verification, multi-party escrow, atomic settlement — would require at least three separate systems and days of reconciliation. On Solana, it's a single 400ms transaction.

Specifically, Solana enables five architectural properties that this protocol requires:

- **Atomic oracle verification** — Track B's `check_oracle_and_resolve_flight` performs Ed25519 signature verification, Switchboard oracle update, and FlightPolicy state update in a single transaction. Solana's Instructions sysvar allows a program to inspect other instructions within the same TX — structurally impossible on EVM.
- **Trustless custody via PDAs** — Pool wallets are owned by program-derived addresses. No multisig, no admin key, no external custodian. The program itself is the custodian — there is no admin key to compromise because none exists.
- **Account-level parallelism** — Each MasterAgreement and FlightPolicy is a separate on-chain account. The Solana runtime processes transactions touching different accounts in parallel. KE081 ICN→JFK settlement never blocks OZ201 ICN→LAX oracle resolution. In EVM's single-contract model, all policies compete for the same storage.
- **Multi-party atomic settlement** — `settle_flight_claim` splits payouts across reinsurer and participants by basis-point ratios and executes all transfers in one transaction — all or nothing, no partial settlement.
- **On-chain state machine as policy terms** — FlightPolicy's state transition (`Issued → AwaitingOracle → Claimable/NoClaim → Paid/Expired`) is enforced on-chain. "Cannot settle before oracle resolves" is not a contractual clause subject to interpretation — it's a transaction the program rejects.

## Quick Start

### 1) Run Frontend

```bash
cd frontend
npm install
npm run dev
```

- Build: `npm run build`
- Preview: `npm run preview`
- The app uses `BrowserRouter` with `basename` set to `/riskmesh`. Configure subpath hosting accordingly.

### 2) Run Backend

```bash
cd backend
cp .env.example .env   # fill in PROGRAM_ID, LEADER_PUBKEY, SWITCHBOARD_QUEUE
cargo run --bin oracle-daemon
```

- Health check: `curl http://localhost:3000/health`
- API docs: see [`backend/docs/backend-overview.md`](backend/docs/backend-overview.md)
- DB backend: SQLite (default) or Firebase Firestore (`DB_BACKEND=firebase`)

### 3) Build / Test Contract

```bash
cd contract
anchor build
anchor test
```

- Program ID is currently a placeholder. Update both:
  - `contract/programs/open_parametric/src/lib.rs`
  - `contract/Anchor.toml`

## CI / CD

Three GitHub Actions workflows automate quality checks and deployment:

| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| **Contract CI** | `.github/workflows/contract-ci.yml` | Push to `main` or PR — `contract/**` changes | `cargo fmt --check`, `cargo clippy`, `cargo test` |
| **Frontend Tests** | `.github/workflows/test-frontend.yml` | Push to `main`/`feature/**` or PR — `frontend/**` changes | `npm ci && npm test` |
| **Deploy Frontend** | `.github/workflows/deploy-frontend.yml` | Push to `main` — `frontend/**` changes | Build and deploy to GitHub Pages |

## Testing

### Contract

```bash
cd contract

# Rust unit tests (pure logic, no validator needed)
cargo test -p open_parametric --lib

# Anchor integration tests (requires local validator)
anchor test

# Settlement logic tests (Node.js)
node --test tests/master_settlement_logic.test.mjs
```

### Frontend

```bash
cd frontend

# Run all tests once
npm test

# Watch mode (re-run on file save)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Coverage Summary

| Area | Framework | Tests | Pass Rate | Line Coverage |
|------|-----------|-------|-----------|--------------------|
| Frontend | Vitest (v8) | 90 | 100% | 59% |
| Contract (Rust) | cargo-llvm-cov | 15 | 100% | 26% |
| Contract (Settlement) | node --test | 4 | 100% | — |

Frontend coverage breakdown:

| Module | Stmts | Branch | Funcs | Lines |
|--------|-------|--------|-------|-------|
| hooks/ | 100% | 100% | 100% | 100% |
| lib/ | 100% | 100% | 100% | 100% |
| store/ | 48% | 45% | 51% | 46% |
| **All files** | **60%** | **52%** | **65%** | **59%** |



For detailed guides, see:
- [`docs/CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) — Contract testing guide (Korean)
- [`docs/FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) — Frontend testing guide (Korean)

## Architecture

### On-Chain Accounts

The on-chain program uses a two-tier account structure. A `MasterAgreement` is a period-based co-insurance agreement (leader + up to 8 participants + reinsurer). Each individual flight is issued as a `FlightPolicy` PDA under the master.

```
MasterAgreement  (one per coverage period)
  └─ FlightPolicy (one per insured flight, issued on-demand)
```

- `MasterAgreement`: Co-insurance agreement. Stores tiered payout amounts, ceded/commission ratios, participant shares (bps), pool wallet addresses, oracle feed (Track B), and lifecycle status.
- `FlightPolicy`: Individual flight contract. Stores flight number, route, departure timestamp, premium paid, oracle-resolved delay, payout amount, and settlement status.

Pool wallets (PDAs) hold escrowed funds. On `settle_flight_claim`, payouts flow from the reinsurer pool and participant pools to the leader's deposit wallet. On `settle_flight_no_claim`, premiums flow from the leader's deposit wallet back to each participant's deposit wallet.

### Backend

The backend runs as a single process with three responsibilities:

1. **Oracle scheduler** — cron-based (`ORACLE_CHECK_CRON`, default: 15min) pipeline that scans on-chain policies, fetches flight data, and sends resolve/settle transactions
2. **DB sync scheduler** — cron-based (`DB_SYNC_CRON`, default: 1min) pipeline that reads on-chain MasterAgreement/FlightPolicy accounts and persists them to SQLite or Firebase Firestore
3. **REST API server** — Axum-based HTTP server exposing policy data and real-time events

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/master-agreements` | List all master policies |
| GET | `/api/master-agreements/accounts` | List master agreement on-chain accounts |
| GET | `/api/master-agreements/:pubkey` | Get single master agreement |
| GET | `/api/master-agreements/tree` | Master policies with nested flight policies |
| GET | `/api/master-agreements/:pubkey/flight-policies` | Flight policies under a master |
| POST | `/api/master-agreements/:pubkey/flight-policies` | Create a flight policy |
| GET | `/api/flight-policies` | List all flight policies |
| GET | `/api/flight-policies/:pubkey` | Get single flight policy |
| GET | `/api/events` | SSE event stream |

## State Machines

MasterAgreement lifecycle:

```
PendingConfirm → Active → Closed
                        → Cancelled
```

FlightPolicy lifecycle:

```
Issued → AwaitingOracle → Claimable → Paid
                        → NoClaim   → Expired
```

## Dev Notes

- Anchor 0.31.1
- Oracle: modular — Switchboard On-Demand (Track B, decentralized) or Trusted Resolver (Track A, centralized)
- SPL tokens used for pool wallets and payouts
- Network: localnet (dev/test), devnet (demo), mainnet (production)
