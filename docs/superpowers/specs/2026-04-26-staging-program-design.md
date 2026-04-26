# Staging Program Design

## Context

The participant-funded collateral work changes both instruction behavior and the
`MasterAgreement` account layout. Upgrading the existing devnet program
`ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh` immediately would preserve the
program address but replace the executable code behind existing devnet accounts.
Existing `MasterAgreement` accounts may not deserialize under the new layout.

RiskMesh needs a shared devnet staging program so collateral changes can be
tested end to end without touching the existing devnet program.

## Goals

- Keep the existing devnet program unchanged until staging validation is done.
- Add a single team-shared staging program id for devnet contract testing.
- Make frontend, backend, and contract scripts select the same active program id.
- Avoid direct source edits for normal stable/staging switching.
- Document the deployment and env workflow so IDL, PDA derivation, and backend
  scanning cannot silently point at different programs.

## Non-Goals

- Per-developer or per-branch staging program ids.
- Migrating existing `ETEEEss...` devnet accounts.
- Production deployment automation.
- Changing the SPL currency mint selection model.

## Program Id Model

RiskMesh will use two devnet program ids:

- Stable devnet program: `VITE_PROGRAM_ID` / `PROGRAM_ID`
- Staging devnet program: `VITE_STAGING_PROGRAM_ID` / `STAGING_PROGRAM_ID`

Frontend selects the active program with:

```env
VITE_PROGRAM_STAGE=stable
```

Allowed values:

- `stable`: use `VITE_PROGRAM_ID`
- `staging`: use `VITE_STAGING_PROGRAM_ID`

The stable default remains:

```env
VITE_PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
```

The staging value is filled with the new shared devnet staging program id after
that program is deployed:

```env
VITE_STAGING_PROGRAM_ID=${STAGING_PROGRAM_ID}
```

## Frontend Design

`frontend/src/lib/constants.ts` should stop hardcoding the only usable program
id. It should compute one exported `PROGRAM_ID` from the env selector:

1. Read `VITE_PROGRAM_STAGE`, defaulting to `stable`.
2. If `stable`, read `VITE_PROGRAM_ID`.
3. If `staging`, read `VITE_STAGING_PROGRAM_ID`.
4. Validate the selected value by constructing a `PublicKey`.
5. Export the selected `PROGRAM_ID` for all PDA helpers and hooks.

The frontend should also expose the active stage and selected program id as
small constants for debugging, for example `PROGRAM_STAGE` and
`PROGRAM_ID_SOURCE`. This is not a user-facing feature requirement, but it helps
catch misconfigured local environments during development.

Both `.env` and `.env.example` files must be updated together whenever these
frontend variables change. `.env.example` documents all required keys; local
`.env` or `.env.local` selects the active stage for a developer machine.

## Backend Design

The backend already reads the active on-chain program from `PROGRAM_ID`.
For staging, run the backend with:

```env
PROGRAM_ID=${STAGING_PROGRAM_ID}
```

No second runtime selector is required in backend code because the backend
process talks to exactly one active program at a time. Documentation and env
examples should make the stable/staging mapping explicit:

```env
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
STAGING_PROGRAM_ID=${STAGING_PROGRAM_ID}
```

When running against staging, `PROGRAM_ID` is set to `STAGING_PROGRAM_ID`.

Both `.env` and `.env.example` files must be updated together whenever backend
program id variables change.

## Contract Scripts Design

Contract scripts already support `PROGRAM_ID` override in `contract/scripts/common.ts`.
That behavior should become the official staging workflow:

```bash
PROGRAM_ID=${STAGING_PROGRAM_ID} \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
npm run demo:3-master-setup
```

The contract environment may also define:

```env
PROGRAM_ID=ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh
STAGING_PROGRAM_ID=${STAGING_PROGRAM_ID}
```

Scripts should continue deriving PDAs from the effective `PROGRAM_ID`, not from
`anchor keys list`, because local `target/deploy/*-keypair.json` files are
ignored build artifacts and can differ across worktrees.

## IDL And Deploy Rules

The active frontend IDL must match the deployed program binary for the selected
program id. For staging validation:

1. Build the contract.
2. Deploy to the shared staging program id.
3. Copy the generated IDL to the frontend.
4. Ensure the frontend selected program id is the same staging id.
5. Run backend with `PROGRAM_ID` set to the same staging id.

Do not upgrade `ETEEEss...` for layout-changing work until the staging program
has passed frontend, backend, and contract-script validation.

## Error Handling

- If `VITE_PROGRAM_STAGE=staging` and `VITE_STAGING_PROGRAM_ID` is missing, the
  frontend should fail fast with a clear configuration error.
- If `VITE_PROGRAM_STAGE` is not `stable` or `staging`, the frontend should fail
  fast.
- If the selected program id is not a valid Solana public key, the frontend
  should fail fast.
- Backend already fails when `PROGRAM_ID` is missing or invalid; keep that
  behavior.

## Testing

Frontend tests should cover:

- Stable stage selects `VITE_PROGRAM_ID`.
- Staging stage selects `VITE_STAGING_PROGRAM_ID`.
- Missing staging id throws a clear error.
- Invalid stage throws a clear error.
- PDA helpers continue using the exported active `PROGRAM_ID`.

Backend tests do not need a new selector test unless helper code is added.
Existing config tests should continue to verify `PROGRAM_ID` loading.

Contract script behavior can be verified with a lightweight TypeScript test or
manual command evidence showing `PROGRAM_ID` override changes PDA derivation.

## Documentation Updates

Update deployment documentation to replace direct `constants.ts` editing with
env-based stable/staging selection.

Update policy/deployment notes with:

- `ETEEEss...` is the stable devnet program.
- Layout-changing work is validated on the shared staging devnet program first.
- `anchor keys list` is not a source of truth when local deploy keypairs differ
  from `declare_id!` or `Anchor.toml`.
- `.env` and `.env.example` must be updated together for frontend, backend, and
  contract environment variables.

## Acceptance Criteria

- Developers can run frontend against stable or staging without editing source.
- Backend can scan stable or staging by changing env only.
- Contract scripts can target stable or staging by changing env only.
- Documentation names the stable and staging program id roles.
- The existing `ETEEEss...` program is not upgraded as part of staging setup.
