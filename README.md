# Riskmesh (Open Parametric)

[한국어](README.ko.md)

**Programmable settlement infrastructure for parametric insurance on Solana.**

Parametric insurance pays the moment an event happens — not after measuring exact damage. The market is scaling toward $40B, yet the settlement infrastructure behind it remains manual and analog. Policies are issued digitally, but insurers still reconcile balances by hand after events.

**Open Parametric** makes settlement programmable. Instead of reconciling after the event, the event updates the shared financial state itself — one on-chain truth, no disputes, no lag. The architecture is a three-tier system: an operator frontend for insurers, an off-chain oracle worker that verifies real-world events, and a Solana on-chain program that manages capital and state transitions deterministically.

The MVP targets **flight delay insurance** (a $10B+ market with 30% of flights delayed at major airports), with a modular architecture that extends to weather, supply chains, and natural disasters.

## Structure

- `contract/` — Anchor-based on-chain program (Rust)
- `frontend/` — Operator dashboard (React + Vite + Emotion)
- `docs/` — Contract guide, testing guides, and design documents
- `OpenParametric.md` — MVP / design draft (Korean)

## Key Features

- **Event-driven settlement** — claims settle on-chain as the event happens, no reconciliation step
- Policy creation and co-underwriting (leader/participant ratio management)
- Escrowed risk pool with on-chain capital management
- Modular oracle integration — centralized (flight API) or decentralized (Switchboard)
- Tab-based operator UI (Contract / Feed / Oracle / Settlement / Inspector)

## Demo Modes

The frontend dashboard supports two operating modes, toggled from the header:

| Mode | Description | Wallet Required |
|------|-------------|-----------------|
| **DEVNET** (default) | On-chain mode — interacts with Solana devnet via connected wallet | Yes |
| **SIM** | Simulation mode — all data is local, no on-chain transactions | No |

Switch modes via the **DEVNET / SIM** toggle in the top-right header. SIM mode is available for offline testing without a wallet connection.

## Oracle Architecture

The oracle integration uses a **modular, dual-track design** — the same contract supports both centralized and decentralized oracle strategies, selectable per deployment scenario. Both tracks use [AviationStack API](https://aviationstack.com) as the flight delay data source.

| Track | Strategy | Trust Model | Target Account |
|-------|----------|-------------|----------------|
| **Track A** — Trusted Resolver | Leader/Operator fetches API data and calls `resolve_flight_delay` on-chain | Centralized (signer trust) | `FlightPolicy` |
| **Track B** — Switchboard On-Demand | Switchboard oracle nodes fetch API data, sign and write to an on-chain feed; `check_oracle_and_create_claim` verifies cryptographically | Decentralized (cryptographic verification) | `Policy` (Legacy) |

**In demo/simulation mode**, oracle resolution is triggered manually via the dashboard UI — no external API or oracle network is required.

This modular design allows flexible adoption:
- **Demo/local testing** — manual trigger, no external dependencies
- **Centralized production** — Track A with a trusted operator and real-time flight API
- **Decentralized production** — Track B with Switchboard oracle network for trustless verification

For full details, see [`contract/docs/oracle.md`](contract/docs/oracle.md).

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

### 2) Build / Test Contract

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

For detailed guides, see:
- [`docs/CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) — Contract testing guide (Korean)
- [`docs/FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) — Frontend testing guide (Korean)

## Docs

### Root

| File | Description |
|------|-------------|
| [`OpenParametric.md`](OpenParametric.md) | MVP design draft — account schemas, state machines, oracle spec (Korean) |

### `docs/`

| File | Description |
|------|-------------|
| [`CONTRACT_GUIDE.md`](docs/CONTRACT_GUIDE.md) | Smart contract detailed spec — accounts, instructions, error codes, sequences (Korean) |
| [`CONTRACT_TESTING_GUIDE_KO.md`](docs/CONTRACT_TESTING_GUIDE_KO.md) | Contract testing guide — unit, integration, and settlement tests (Korean) |
| [`FRONTEND_TESTING_GUIDE_KO.md`](docs/FRONTEND_TESTING_GUIDE_KO.md) | Frontend unit testing guide — business logic tests (Korean) |
| [`FILE_STATE_LOGIC_FULL_KO.md`](docs/FILE_STATE_LOGIC_FULL_KO.md) | Full file-by-file state/logic reference for the entire repo (Korean) |
| [`MASTER_POLICY_REDESIGN_PLAN_KO.md`](docs/MASTER_POLICY_REDESIGN_PLAN_KO.md) | Master policy + child flight policy restructuring plan (Korean) |
| [`feature/settle_flight_settlement.md`](docs/feature/settle_flight_settlement.md) | Flight settlement logic — claim and no-claim flows (Korean) |
| [`emotion-migration-handoff.md`](docs/emotion-migration-handoff.md) | Emotion CSS-in-JS migration handoff notes |

### `contract/docs/`

| File | Description |
|------|-------------|
| [`oracle.md`](contract/docs/oracle.md) | Oracle integration guide — Track A (centralized) & Track B (decentralized) (Korean) |
| [`setup-and-test.md`](contract/docs/setup-and-test.md) | Development environment setup — Rust, Solana CLI, Anchor installation (Korean) |

### `contract/`

| File | Description |
|------|-------------|
| [`README.md`](contract/README.md) | Contract setup notes — program ID, build/test, CI trigger |

## Architecture

The on-chain program manages Policy, Underwriting, RiskPool, Claim, and PolicyholderRegistry accounts as PDAs. The risk pool owns an SPL Token vault (ATA). Oracle verification creates claims once delay conditions are met.

```
Policy
  ├─ Underwriting (participants, ratios, escrow)
  ├─ RiskPool (vault, balances)
  ├─ Claim (per oracle_round)
  └─ PolicyholderRegistry (optional)
```

What each element means:
- `Policy`: The insurance product itself. Stores route/flight, departure time, delay threshold, payout amount, oracle feed, and state.
- `Underwriting`: Co-underwriting structure. Tracks leader/participant ratios, acceptance status, and escrowed funds.
- `RiskPool`: Pool holding escrowed funds. Manages the SPL Token vault, available balance, and total escrowed amount.
- `Claim`: Per-oracle-round claim record. Stores delay value, verification time, approval status, and payout amount.
- `PolicyholderRegistry`: (Optional) Minimal policyholder registry. Stores external references and coverage data without PII.

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
