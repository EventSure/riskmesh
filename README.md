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
- `docs/` — Contract guide, testing guides, and design documents
- `OpenParametric.md` — MVP / design draft (Korean)

## Key Features

- **Event-driven settlement** — claims settle on-chain as the event happens, no reconciliation step
- Policy creation and co-underwriting (leader/participant ratio management)
- Escrowed risk pool with on-chain capital management
- Modular oracle integration — centralized (flight API) or decentralized (Switchboard)
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

### Root

| File | Description |
|------|-------------|
| [`OpenParametric.md`](OpenParametric.md) | MVP design draft — account schemas, state machines, oracle spec (Korean) |

### `docs/`

| File | Description |
|------|-------------|
| [`CONTRACT_GUIDE.md`](docs/CONTRACT_GUIDE.md) | Smart contract detailed spec — accounts, instructions, error codes, sequences (Korean) |
| [`CONTRACT_GUIDE_EN.md`](docs/CONTRACT_GUIDE_EN.md) | Smart contract detailed spec — accounts, instructions, error codes, sequences (English) |
| [`CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) | Contract testing guide — unit, integration, and settlement tests (Korean) |
| [`FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) | Frontend unit testing guide — business logic tests (Korean) |
| [`FILE_STATE_LOGIC_FULL_KO.md`](docs/FILE_STATE_LOGIC_FULL_KO.md) | Full file-by-file state/logic reference for the entire repo (Korean) |
| [`feature/settle_flight_settlement.md`](docs/feature/settle_flight_settlement.md) | Flight settlement logic — claim and no-claim flows (Korean) |

### `contract/docs/`

| File | Description |
|------|-------------|
| [`oracle.md`](contract/docs/oracle.md) | Oracle integration guide — Track A (centralized) & Track B (decentralized) (Korean) |
| [`setup-and-test.md`](contract/docs/setup-and-test.md) | Development environment setup — Rust, Solana CLI, Anchor installation (Korean) |

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
| [`master-flight-policy-explained.md`](backend/docs/master-flight-policy-explained.md) | Master/Flight policy domain model explained (Korean) |
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
| **Track A** — Trusted Resolver | Leader/Operator fetches API data and calls `resolve_flight_delay` on-chain | Centralized (signer trust) | `FlightPolicy` |
| **Track B** — Switchboard On-Demand | Switchboard oracle nodes fetch API data, sign and write to an on-chain feed; `check_oracle_and_create_claim` verifies cryptographically | Decentralized (cryptographic verification) | `Policy`  |

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

- **Atomic oracle verification** — `check_oracle_and_create_claim` performs Ed25519 signature verification, Switchboard oracle update, and claim creation in a single transaction. Solana's Instructions sysvar allows a program to inspect other instructions within the same TX — structurally impossible on EVM.
- **Trustless custody via PDAs** — The risk pool vault is owned by a program-derived address. No multisig, no admin key, no external custodian. The program itself is the custodian — there is no admin key to compromise because none exists.
- **Account-level parallelism** — Each Policy, Underwriting, RiskPool, and Claim is a separate on-chain account. The Solana runtime processes transactions touching different accounts in parallel. KE081 ICN→JFK claim processing never blocks OZ201 ICN→LAX underwriting. In EVM's single-contract model, all policies compete for the same storage.
- **Multi-party atomic settlement** — `settle_claim` transfers from the vault to the beneficiary in one transaction with PDA-signed authority. Up to 16 participants' basis-point ratios are calculated and settled atomically — all or nothing, no partial settlement.
- **On-chain state machine as policy terms** — The 8-step state transition (Draft → Open → Funded → Active → Claimable → Approved → Settled / Expired) is enforced on-chain. "Cannot activate before fully funded" is not a contractual clause subject to interpretation — it's a transaction that the program rejects.

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

The program has two policy designs:

**Legacy (co-insurance pool + Switchboard oracle):**

```
Policy
  ├─ Underwriting (participants, ratios, escrow)
  ├─ RiskPool (vault, balances)
  ├─ Claim (per oracle_round)
  └─ PolicyholderRegistry (optional)
```

**Master/Flight (trusted resolver + tiered payouts):**

```
MasterPolicy (co-insurance agreement + reinsurance terms)
  └─ FlightPolicy (individual flight issued under a master)
```

- `MasterPolicy`: Sets tiered payouts, ceded/reinsurance ratios, participant wallets. Lifecycle: `Draft → PendingConfirm → Active → Closed/Cancelled`
- `FlightPolicy`: Individual flight delay policy. Lifecycle: `Issued → AwaitingOracle → Claimable/NoClaim → Paid/Expired`

**Legacy accounts:**
- `Policy`: The insurance product itself. Stores route/flight, departure time, delay threshold, payout amount, oracle feed, and state.
- `Underwriting`: Co-underwriting structure. Tracks leader/participant ratios, acceptance status, and escrowed funds.
- `RiskPool`: Pool holding escrowed funds. Manages the SPL Token vault, available balance, and total escrowed amount.
- `Claim`: Per-oracle-round claim record. Stores delay value, verification time, approval status, and payout amount.
- `PolicyholderRegistry`: (Optional) Minimal policyholder registry. Stores external references and coverage data without PII.

### Backend

The backend runs as a single process with three responsibilities:

1. **Oracle scheduler** — cron-based (`ORACLE_CHECK_CRON`, default: 15min) pipeline that scans on-chain policies, fetches flight data, and sends resolve/settle transactions
2. **DB sync scheduler** — cron-based (`DB_SYNC_CRON`, default: 1min) pipeline that reads on-chain MasterPolicy/FlightPolicy accounts and persists them to SQLite or Firebase Firestore
3. **REST API server** — Axum-based HTTP server exposing policy data and real-time events

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/master-policies` | List all master policies |
| GET | `/api/master-policies/accounts` | List master policy on-chain accounts |
| GET | `/api/master-policies/:pubkey` | Get single master policy |
| GET | `/api/master-policies/tree` | Master policies with nested flight policies |
| GET | `/api/master-policies/:pubkey/flight-policies` | Flight policies under a master |
| POST | `/api/master-policies/:pubkey/flight-policies` | Create a flight policy |
| GET | `/api/flight-policies` | List all flight policies |
| GET | `/api/flight-policies/:pubkey` | Get single flight policy |
| GET | `/api/events` | SSE event stream |

## State Machines

Policy state flow:

```
Draft → Open → Funded → Active → Claimable → Approved → Settled
                                   └───────────────→ Expired
```

Underwriting state:

```
Proposed → Open → Finalized (or Failed)
```

Claim state:

```
None → PendingOracle → Claimable → Approved → Settled (or Rejected)
```

## Dev Notes

- Anchor 0.31.1
- Oracle: modular — Switchboard On-Demand (decentralized) or Trusted Resolver (centralized)
- SPL tokens used for escrow/payout
- Network: localnet (dev), devnet (demo), mainnet (production)
