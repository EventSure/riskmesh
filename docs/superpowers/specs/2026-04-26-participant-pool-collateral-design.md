# Participant Pool Collateral Design

## Context

RiskMesh currently creates PDA-owned pool token accounts during master agreement setup. The leader dashboard then exposes a `Fund All Pools` action after activation that transfers collateral from the leader into the reinsurer, leader, and participant pools.

The target behavior is different: each party should fund its own pool before the master agreement can become active. Confirmation should both pay the required collateral deficit and record consent. Activation should fail if any party pool remains underfunded.

This design covers contract changes, portal/dashboard changes, policy documentation, and tests. Implementation should start after rebasing the work branch on `feature/frontend_develop` so `/portal` changes are based on the latest frontend state.

## Policy

Add `docs/POLICY.md` and record the pool collateral policy there.

Each master agreement has a creation-time `collateral_claim_count`.

- Range: `1..=100`.
- UI default: `10`.
- Stored on `MasterAgreement`.
- Used by `confirm_master`, `activate_master`, and frontend collateral status calculations.

Required collateral uses the largest configured payout tier:

```text
required_total = max_payout_tier * collateral_claim_count
reinsurer_required = required_total * reinsurer_effective_bps / 10_000
insurer_total_required = required_total - reinsurer_required
leader_required = insurer_total_required * leader_share_bps / 10_000
participant_required[i] = insurer_total_required * participant[i].share_bps / 10_000
```

## Contract Design

### Master Agreement State

Extend `CreateMasterAgreementParams` with `collateral_claim_count` and persist it on `MasterAgreement`.

Validation:

- Reject `collateral_claim_count == 0`.
- Reject `collateral_claim_count > 100`.
- Preserve existing participant/share/time/premium validation.

### Collateral Math

Extract pure helpers for:

- `max_payout_tier`.
- total required collateral.
- reinsurer required collateral.
- leader required collateral.
- participant required collateral by index.
- deficit calculation: `required.saturating_sub(current_balance)`.

Helpers should use checked arithmetic and return existing `OpenParamError::MathOverflow` on overflow.

### `confirm_master`

Extend `confirm_master` so it can transfer the actor's collateral deficit and then confirm.

The instruction should receive:

- `actor` signer.
- `master_agreement`.
- actor source token account.
- actor pool token account.
- token program.

For the actor's role, the program validates:

- master is `PendingConfirm`.
- actor is authorized for the provided role.
- the expected pool wallet is registered or configured.
- actor pool token account matches the expected pool wallet.
- actor pool mint equals `master.currency_mint`.
- actor pool owner is the master agreement PDA.
- actor source mint equals `master.currency_mint`.
- actor source owner is the actor.

Processing:

1. Calculate actor required collateral.
2. Read current actor pool balance.
3. Transfer only `required - current_balance` from actor source token account to actor pool when positive.
4. Verify the final expected balance is at least required.
5. Mark the leader, participant, or reinsurer confirmed.

If the actor pool already satisfies the requirement, no transfer occurs and confirmation can still succeed.

### `activate_master`

Extend `activate_master` to verify every party pool before activation.

The instruction should receive:

- operator signer.
- master agreement.
- leader pool token account.
- optional reinsurer pool token account when a reinsurer exists.
- remaining accounts for participant pool token accounts in `master.participants` order.

Validation:

- existing master status/operator/confirmation checks remain.
- every required pool account matches the wallet stored on `MasterAgreement`.
- each pool mint equals `master.currency_mint`.
- each pool owner is the master agreement PDA.
- each pool balance is at least its required collateral.
- remaining participant pool accounts length equals `master.participants.len()`.

Activation fails if any party is underfunded.

### `fund_pool`

Add a supplemental `fund_pool` instruction for explicit top-ups.

Inputs:

- actor signer.
- master agreement.
- actor source token account.
- actor pool token account.
- token program.
- amount.
- role identifier.

Validation:

- amount is positive.
- actor is authorized for the role.
- actor can only fund its own expected pool.
- source and pool mint equal `master.currency_mint`.
- source owner is actor.
- pool owner is the master agreement PDA.

`fund_pool` can be used before or after confirmation, but the primary confirmation path should automatically fund the deficit.

## Frontend Design

### Master Setup

Add a `collateral_claim_count` input to master agreement setup.

- Default: `10`.
- Min: `1`.
- Max: `100`.
- Send it through `createMasterAgreement`.
- Persist/display it in local store where master terms are shown.

Remove the existing leader `Fund All Pools` button and its default flow. The leader is responsible only for the leader pool through the same confirm/funding model as other parties.

### Portal Confirm

Change the confirm call-to-action to a combined funding and confirmation flow.

The portal should show:

- role.
- share/exposure basis.
- required collateral.
- current pool balance.
- deficit.
- confirmation status.

On click, call the extended `confirm_master`. The transaction pays only the deficit and confirms the actor. This applies to leader, participant, and reinsurer roles.

### Portal Supplemental Funding

Keep the portal funding card as a supplemental top-up control, but replace direct SPL transfer with `fund_pool`.

The user can enter an amount, and the program validates the actor can only fund its own pool.

### Pool Status Visualization

Add a visual pool status component for the leader dashboard and portal.

Show total pool health as the top-level summary:

- total funded collateral.
- total required collateral.
- total health percentage: `total_funded / total_required`, capped visually at 100%.
- total deficit or surplus.
- aggregate status: `Ready` only when total health is sufficient and every required party is individually ready.

Use required-vs-funded progress bars as the main party-level visualization. Each party gets a row-like visual band, but the emphasis is graphical rather than tabular:

- party label and role.
- share/exposure percentage.
- funded amount vs required amount.
- progress bar capped visually at 100%, with surplus shown in text.
- deficit/surplus text.
- confirmed indicator.
- status: `Ready`, `Underfunded`, or `Pending Confirm`.

Optional compact health rings may be used as summary cards above the bars. Do not rely only on total stacked collateral because one party's surplus must not hide another party's deficit.

Portal views should highlight the connected wallet's party while still showing the overall party funding context when available.

## Tests

### Contract Tests

Add pure helper tests for:

- max payout tier selection.
- `collateral_claim_count` range validation.
- required collateral split with and without reinsurer.
- deficit calculation when pool is empty, partially funded, exactly funded, and overfunded.
- overflow rejection.

Add instruction-level tests for:

- `confirm_master` transfers only the deficit.
- `confirm_master` confirms without transfer when already funded.
- leader, participant, and reinsurer confirmation paths.
- wrong actor rejected.
- wrong pool wallet rejected.
- wrong source owner rejected.
- wrong mint rejected.
- `activate_master` rejects any underfunded pool.
- `activate_master` succeeds only when all required pools are funded and confirmed.

### Frontend Tests

Add tests for:

- collateral calculation utilities.
- setup input range/default behavior.
- portal confirm displays required/current/deficit values.
- supplemental funding calls `fund_pool`.
- `Fund All Pools` is absent.
- visual pool status marks ready/underfunded/pending states correctly.

## Branch and Integration Notes

Before implementation, rebase the working branch on `feature/frontend_develop` to pick up the latest portal work.

Avoid committing `.superpowers/` brainstorming companion files. They are session artifacts.
