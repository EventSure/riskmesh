# RiskMesh Policy

This document records protocol-level policy decisions that shape contract and portal behavior.

## Pool Collateral Policy

Each master agreement must define a `collateral_claim_count` at creation time. The value represents how many maximum-payout claims each pool should be able to cover before the master agreement can become active.

- Allowed range: `1..=100`.
- Recommended default: `10`.
- The value is stored on the `MasterAgreement` account and is not changed after creation.
- A value of `0` is invalid because it disables collateral gating.

### Required Collateral Formula

The total collateral basis for a master agreement is:

```text
required_total = max_payout_tier * collateral_claim_count
```

Where `max_payout_tier` is the largest configured payout among the master agreement's delay/cancellation payout tiers.

Required collateral is allocated by settlement exposure:

```text
reinsurer_required = required_total * reinsurer_effective_bps / 10_000
insurer_total_required = required_total - reinsurer_required
leader_required = insurer_total_required * leader_share_bps / 10_000
participant_required[i] = insurer_total_required * participant[i].share_bps / 10_000
```

If no reinsurer is configured, `reinsurer_required` is zero and the insurer-side parties cover the full `required_total` according to their share basis points.

### Funding Responsibility

Each party funds its own pool.

- The leader funds the leader pool.
- Each participant funds its own participant pool.
- The reinsurer, when configured, funds the reinsurer pool.

The leader must not fund all party pools as the default operating flow. Master agreement activation depends on each party confirming and funding its own collateral obligation.

### Confirmation and Activation

Confirmation is a funding action and a consent action.

- During `confirm_master`, the program calculates the actor's required collateral, checks the current pool balance, transfers only the deficit from the actor's source token account into the actor's pool, and then marks that actor confirmed.
- If the pool already has enough balance, `confirm_master` does not transfer additional collateral.
- During `activate_master`, the program rechecks every required pool balance before setting the master agreement active.

The activation check is the final safety gate. It prevents activation if any required pool is underfunded, even if a party previously confirmed.

### Supplemental Funding

A separate `fund_pool` instruction may be used for supplemental collateral funding before or after confirmation. It must only allow an actor to fund its own expected pool and must validate the pool wallet, mint, owner, and amount.

Direct SPL transfers can still increase a pool balance, but product flows should use program instructions so role, target, and UX state remain explicit.

## Program Staging Policy

`ETEEEssGKAAQEGwz3ggDcy9vzPAPtBjtb2KocdyLBMjh` is the stable devnet program.
Layout-changing contract work, including changes to `MasterAgreement`, must be
validated against the shared devnet staging program before upgrading the stable
program.

Program id selection must be environment-driven:

- Frontend: `VITE_PROGRAM_STAGE`, `VITE_PROGRAM_ID`, `VITE_STAGING_PROGRAM_ID`
- Backend: active `PROGRAM_ID`; `STAGING_PROGRAM_ID` may be kept as a local reference, but backend targets staging only when `PROGRAM_ID` is explicitly set to the staging id
- Contract scripts: active `PROGRAM_ID`; `STAGING_PROGRAM_ID` may be kept as a local reference, but scripts target staging only when `PROGRAM_ID` is explicitly set/exported to the staging id

When a program-id env variable is added or renamed, update the matching `.env`
and `.env.example` files together. Local `target/deploy/*-keypair.json` files
and `anchor keys list` are not authoritative because ignored build artifacts can
differ across worktrees.
