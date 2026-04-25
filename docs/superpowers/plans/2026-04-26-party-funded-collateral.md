# Party-Funded Collateral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace leader-funded pool activation with party-funded collateral confirmation, activation balance gates, supplemental top-ups, and visual pool health dashboards.

**Architecture:** The contract stores `collateral_claim_count`, calculates required collateral per party from max payout exposure, and makes `confirm_master` transfer only the actor's collateral deficit before confirming. `activate_master` becomes the final all-pool balance gate, while `fund_pool` provides supplemental top-ups. The frontend consumes the same calculation model to show total pool health plus party-level required-vs-funded bars in dashboard and portal flows.

**Tech Stack:** Anchor 0.31/Solana SPL Token (`contract/programs/open_parametric`), Rust unit tests, Vite React/TypeScript, Zustand, Chart.js, Vitest, Emotion.

---

## File Structure

- Modify `contract/programs/open_parametric/src/state.rs`: add `collateral_claim_count` to params and account state.
- Modify `contract/programs/open_parametric/src/math.rs`: add pure collateral helpers.
- Modify `contract/programs/open_parametric/src/instructions/create_master_agreement.rs`: validate and store `collateral_claim_count`.
- Modify `contract/programs/open_parametric/src/instructions/confirm_master.rs`: validate token accounts, transfer deficit, then confirm.
- Modify `contract/programs/open_parametric/src/instructions/activate_master.rs`: validate all pool token accounts and balances.
- Create `contract/programs/open_parametric/src/instructions/fund_pool.rs`: supplemental top-up instruction.
- Modify `contract/programs/open_parametric/src/instructions/mod.rs`: export and test `fund_pool`.
- Modify `contract/programs/open_parametric/src/lib.rs`: expose `fund_pool`.
- Modify contract tests under `contract/programs/open_parametric/src/instructions/*_test.rs` and add math tests in `contract/programs/open_parametric/src/math.rs`.
- Regenerate `contract/target/idl/open_parametric.json` with Anchor.
- Modify `frontend/src/lib/idl/open_parametric.json` and `frontend/src/lib/idl/open_parametric.ts`: sync IDL and hand-maintained TypeScript account/param types.
- Create `frontend/src/lib/collateral.ts`: frontend collateral calculations and status shaping.
- Create `frontend/src/lib/__tests__/collateral.test.ts`: calculation tests.
- Modify `frontend/src/store/useProtocolStore.ts`: add `collateralClaimCount` and persistence.
- Modify `frontend/src/components/tabs/tab-contract/MasterContractSetup.tsx`: add collateral count input and remove Fund All Pools.
- Modify `frontend/src/components/tabs/tab-contract/PoolStatus.tsx`: render the reusable party-level visual status component.
- Create `frontend/src/components/tabs/shared/PoolHealthVisual.tsx`: reusable total health + party bars visualization.
- Create `frontend/src/hooks/usePoolCollateralStatus.ts`: fetch pool balances and derive visual state from master account.
- Modify `frontend/src/components/tabs/tab-portal/PortalConfirm.tsx`: show required/current/deficit and call expanded `confirm_master`.
- Modify `frontend/src/components/tabs/tab-portal/PortalOverview.tsx`: use `fund_pool` for supplemental top-up and show pool visual context.
- Modify `frontend/src/hooks/useCreateMasterAgreement.ts`, `frontend/src/hooks/useConfirmMaster.ts`, `frontend/src/hooks/useActivateMaster.ts`: update instruction account/arg shapes.
- Create `frontend/src/hooks/useFundPool.ts`: supplemental funding hook.
- Modify i18n files `frontend/src/i18n/locales/en.ts` and `frontend/src/i18n/locales/ko.ts`: labels for collateral count, health, deficit, and confirm funding.
- Modify guide/test files that reference `Fund All Pools`.

## Task 0: Prepare Branch

**Files:**
- No source edits.

- [ ] **Step 1: Confirm clean committed spec state**

Run:

```bash
git status --short
```

Expected: Only `.superpowers/` is untracked, or no output if the session artifacts were cleaned. Do not stage `.superpowers/`.

- [ ] **Step 2: Fetch latest frontend branch**

Run:

```bash
git fetch origin feature/frontend_develop
```

Expected: fetch completes without errors.

- [ ] **Step 3: Rebase current branch onto frontend development**

Run:

```bash
git rebase origin/feature/frontend_develop
```

Expected: rebase completes. If conflicts appear, resolve only files touched by this feature and keep the docs from commit `7efda4f`.

- [ ] **Step 4: Verify baseline builds/tests before feature edits**

Run:

```bash
cd contract && cargo test
cd ../frontend && yarn test --runInBand
```

Expected: contract tests pass. If `yarn test --runInBand` is unsupported by Vitest in this repo, run `yarn test` and record the actual command used in the commit message.

- [ ] **Step 5: Confirm rebase left no unstaged source edits**

Run:

```bash
git status --short
```

Expected: no source-file output from the rebase. `.superpowers/` may remain untracked and must not be staged.

If source files are listed, stop Task 0 and inspect them with:

```bash
git diff -- docs/POLICY.md docs/superpowers/specs/2026-04-26-participant-pool-collateral-design.md
git diff -- frontend/src
git diff -- contract
```

Expected: either no diff, or only conflict-resolution edits that were already committed by `git rebase --continue`.

## Task 1: Contract Collateral State and Math

**Files:**
- Modify: `contract/programs/open_parametric/src/state.rs`
- Modify: `contract/programs/open_parametric/src/math.rs`
- Modify: `contract/programs/open_parametric/src/instructions/create_master_agreement.rs`
- Modify: `contract/programs/open_parametric/src/instructions/create_master_agreement_test.rs`

- [ ] **Step 1: Write failing tests for collateral count validation**

Add tests to `contract/programs/open_parametric/src/instructions/create_master_agreement_test.rs`:

```rust
#[test]
fn rejects_zero_collateral_claim_count() {
    let leader = Pubkey::new_unique();
    let participants = vec![participant(Pubkey::new_unique(), 5_000)];

    let result = validate_create_master_inputs(
        5_000,
        &participants,
        leader,
        0,
    );

    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
}

#[test]
fn rejects_collateral_claim_count_above_100() {
    let leader = Pubkey::new_unique();
    let participants = vec![participant(Pubkey::new_unique(), 5_000)];

    let result = validate_create_master_inputs(
        5_000,
        &participants,
        leader,
        101,
    );

    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
}

#[test]
fn accepts_collateral_claim_count_between_1_and_100() {
    let leader = Pubkey::new_unique();
    let participants = vec![participant(Pubkey::new_unique(), 5_000)];

    let result = validate_create_master_inputs(
        5_000,
        &participants,
        leader,
        10,
    );

    assert!(result.is_ok());
}
```

If the existing helper is named only `validate_master_participants`, create `validate_create_master_inputs` in Step 3 and update existing tests to call it where validation spans participants plus collateral count.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd contract && cargo test create_master_agreement_test
```

Expected: FAIL because `collateral_claim_count` and `validate_create_master_inputs` do not exist.

- [ ] **Step 3: Add state field and validation helper**

In `contract/programs/open_parametric/src/state.rs`, add the field to `CreateMasterAgreementParams` after payout tiers:

```rust
pub collateral_claim_count: u16,
```

Add the stored field to `MasterAgreement` after payout tiers:

```rust
pub collateral_claim_count: u16,
```

In `contract/programs/open_parametric/src/instructions/create_master_agreement.rs`, add:

```rust
pub(crate) fn validate_create_master_inputs(
    leader_share_bps: u16,
    participants: &[MasterParticipantInit],
    leader: Pubkey,
    collateral_claim_count: u16,
) -> std::result::Result<(), OpenParamError> {
    if collateral_claim_count == 0 || collateral_claim_count > 100 {
        return Err(OpenParamError::InvalidInput);
    }
    validate_master_participants(leader_share_bps, participants, leader)
}
```

Replace the existing `validate_master_participants(...)` call in `handler` with:

```rust
validate_create_master_inputs(
    params.leader_share_bps,
    &params.participants,
    ctx.accounts.leader.key(),
    params.collateral_claim_count,
)?;
```

Set the stored field:

```rust
master.collateral_claim_count = params.collateral_claim_count;
```

- [ ] **Step 4: Write failing collateral math tests**

Add tests in `contract/programs/open_parametric/src/math.rs` under the existing test module or create one:

```rust
#[test]
fn calculates_required_collateral_with_reinsurer() {
    let tiers = TierPayouts {
        delay_2h: 5_000_000,
        delay_3h: 8_000_000,
        delay_4to5h: 12_000_000,
        delay_6h_or_cancelled: 15_000_000,
    };

    let req = collateral_requirements(
        tiers,
        10,
        4_500,
        5_000,
        &[3_000, 2_000],
    ).unwrap();

    assert_eq!(req.total_required, 150_000_000);
    assert_eq!(req.reinsurer_required, 67_500_000);
    assert_eq!(req.leader_required, 41_250_000);
    assert_eq!(req.participant_required, vec![24_750_000, 16_500_000]);
}

#[test]
fn deficit_saturates_at_zero_when_overfunded() {
    assert_eq!(collateral_deficit(100, 120), 0);
    assert_eq!(collateral_deficit(100, 40), 60);
}
```

- [ ] **Step 5: Run tests to verify math failure**

Run:

```bash
cd contract && cargo test collateral
```

Expected: FAIL because `collateral_requirements` and `collateral_deficit` do not exist.

- [ ] **Step 6: Implement collateral helpers**

Add to `contract/programs/open_parametric/src/math.rs`:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CollateralRequirements {
    pub total_required: u64,
    pub reinsurer_required: u64,
    pub insurer_total_required: u64,
    pub leader_required: u64,
    pub participant_required: Vec<u64>,
}

pub fn max_payout_tier(tiers: TierPayouts) -> u64 {
    tiers
        .delay_2h
        .max(tiers.delay_3h)
        .max(tiers.delay_4to5h)
        .max(tiers.delay_6h_or_cancelled)
}

pub fn collateral_deficit(required: u64, current_balance: u64) -> u64 {
    required.saturating_sub(current_balance)
}

pub fn collateral_requirements(
    tiers: TierPayouts,
    collateral_claim_count: u16,
    reinsurer_effective_bps: u16,
    leader_share_bps: u16,
    participant_share_bps: &[u16],
) -> Result<CollateralRequirements, OpenParamError> {
    let total_required = max_payout_tier(tiers)
        .checked_mul(collateral_claim_count as u64)
        .ok_or(OpenParamError::MathOverflow)?;
    let reinsurer_required = total_required
        .checked_mul(reinsurer_effective_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?
        / 10_000;
    let insurer_total_required = total_required
        .checked_sub(reinsurer_required)
        .ok_or(OpenParamError::MathOverflow)?;
    let leader_required = insurer_total_required
        .checked_mul(leader_share_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?
        / 10_000;
    let mut participant_required = Vec::with_capacity(participant_share_bps.len());
    for share_bps in participant_share_bps {
        participant_required.push(
            insurer_total_required
                .checked_mul(*share_bps as u64)
                .ok_or(OpenParamError::MathOverflow)?
                / 10_000,
        );
    }

    Ok(CollateralRequirements {
        total_required,
        reinsurer_required,
        insurer_total_required,
        leader_required,
        participant_required,
    })
}
```

Add imports as needed:

```rust
use crate::errors::OpenParamError;
```

- [ ] **Step 7: Run focused contract tests**

Run:

```bash
cd contract && cargo test create_master_agreement_test && cargo test collateral
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add contract/programs/open_parametric/src/state.rs contract/programs/open_parametric/src/math.rs contract/programs/open_parametric/src/instructions/create_master_agreement.rs contract/programs/open_parametric/src/instructions/create_master_agreement_test.rs
git commit -m "Gate master setup on collateral coverage policy" \
  -m "Master agreements need a stored collateral claim count so every later funding and activation check uses the same exposure basis." \
  -m "Constraint: collateral_claim_count must be in 1..=100" \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd contract && cargo test create_master_agreement_test && cargo test collateral"
```

## Task 2: Contract Confirm Funding

**Files:**
- Modify: `contract/programs/open_parametric/src/instructions/confirm_master.rs`
- Modify: `contract/programs/open_parametric/src/instructions/confirm_master_test.rs`

- [ ] **Step 1: Add pure helper tests for confirm collateral target selection**

Add tests to `confirm_master_test.rs`:

```rust
#[test]
fn leader_confirm_requires_leader_collateral() {
    let leader = Pubkey::new_unique();
    let participants = vec![make_participant(false, true)];

    let effect = apply_confirm(
        pending(),
        participant_role(),
        leader,
        leader,
        &participants,
        None,
        Pubkey::new_unique(),
    ).unwrap();

    assert!(matches!(effect, ConfirmEffect::Leader));
}

#[test]
fn participant_confirm_returns_participant_index_for_collateral() {
    let leader = Pubkey::new_unique();
    let p = make_participant(false, true);
    let actor = p.insurer;

    let effect = apply_confirm(
        pending(),
        participant_role(),
        actor,
        leader,
        &[p],
        None,
        Pubkey::new_unique(),
    ).unwrap();

    assert!(matches!(effect, ConfirmEffect::Participant { idx: 0 }));
}
```

Keep these pure tests passing while the account-level handler changes.

- [ ] **Step 2: Update `ConfirmMaster` accounts**

In `confirm_master.rs`, import SPL token types:

```rust
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::math::{collateral_deficit, collateral_requirements, TierPayouts};
```

Change the accounts struct:

```rust
#[derive(Accounts)]
pub struct ConfirmMaster<'info> {
    pub actor: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
    #[account(mut)]
    pub actor_source_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub actor_pool_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
```

- [ ] **Step 3: Implement token account validation and deficit transfer**

Add helpers:

```rust
fn tier_payouts(master: &MasterAgreement) -> TierPayouts {
    TierPayouts {
        delay_2h: master.payout_delay_2h,
        delay_3h: master.payout_delay_3h,
        delay_4to5h: master.payout_delay_4to5h,
        delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
    }
}

fn expected_pool_and_required(
    master: &MasterAgreement,
    effect: &ConfirmEffect,
) -> Result<(Pubkey, u64)> {
    let participant_shares: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
    let req = collateral_requirements(
        tier_payouts(master),
        master.collateral_claim_count,
        master.reinsurer_effective_bps,
        master.leader_share_bps,
        &participant_shares,
    )?;

    match effect {
        ConfirmEffect::Leader => Ok((master.leader_pool_wallet, req.leader_required)),
        ConfirmEffect::Participant { idx } => {
            Ok((master.participants[*idx].pool_wallet, req.participant_required[*idx]))
        }
        ConfirmEffect::Reinsurer => {
            let pool = master.reinsurer_pool_wallet.ok_or(OpenParamError::InvalidRole)?;
            Ok((pool, req.reinsurer_required))
        }
    }
}
```

In `handler`, after `apply_confirm` and before setting confirmed flags, validate and transfer:

```rust
let effect = apply_confirm(/* existing args */)?;
let (expected_pool, required) = expected_pool_and_required(master, &effect)?;

require!(
    ctx.accounts.actor_pool_token.key() == expected_pool,
    OpenParamError::InvalidSettlementTarget
);
require!(
    ctx.accounts.actor_pool_token.mint == master.currency_mint,
    OpenParamError::InvalidInput
);
require!(
    ctx.accounts.actor_pool_token.owner == master.key(),
    OpenParamError::InvalidSettlementTarget
);
require!(
    ctx.accounts.actor_source_token.mint == master.currency_mint,
    OpenParamError::InvalidInput
);
require!(
    ctx.accounts.actor_source_token.owner == ctx.accounts.actor.key(),
    OpenParamError::Unauthorized
);

let deficit = collateral_deficit(required, ctx.accounts.actor_pool_token.amount);
if deficit > 0 {
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.actor_source_token.to_account_info(),
                to: ctx.accounts.actor_pool_token.to_account_info(),
                authority: ctx.accounts.actor.to_account_info(),
            },
        ),
        deficit,
    )?;
}
```

Then keep the existing match that sets confirmed flags.

- [ ] **Step 4: Run focused tests and build**

Run:

```bash
cd contract && cargo test confirm_master_test && cargo build
```

Expected: PASS. If borrow checker issues appear because `master.key()` is used while `master` is mutably borrowed, store `let master_key = ctx.accounts.master_agreement.key();` before `let master = &mut ...`.

- [ ] **Step 5: Commit**

```bash
git add contract/programs/open_parametric/src/instructions/confirm_master.rs contract/programs/open_parametric/src/instructions/confirm_master_test.rs
git commit -m "Make confirmation fund each actor's collateral deficit" \
  -m "Confirmation now carries both consent and funding responsibility by moving only the missing collateral from the actor into their own pool." \
  -m "Constraint: direct transfers may pre-fund a pool, so confirmation must transfer only the deficit" \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd contract && cargo test confirm_master_test && cargo build"
```

## Task 3: Contract Activation Gate and Fund Pool

**Files:**
- Modify: `contract/programs/open_parametric/src/instructions/activate_master.rs`
- Modify: `contract/programs/open_parametric/src/instructions/activate_master_test.rs`
- Create: `contract/programs/open_parametric/src/instructions/fund_pool.rs`
- Create: `contract/programs/open_parametric/src/instructions/fund_pool_test.rs`
- Modify: `contract/programs/open_parametric/src/instructions/mod.rs`
- Modify: `contract/programs/open_parametric/src/lib.rs`

- [ ] **Step 1: Add activation pure validation tests**

Add to `activate_master_test.rs`:

```rust
#[test]
fn collateral_status_requires_each_party_ready() {
    let required = vec![100, 75, 25];
    let balances = vec![100, 74, 1_000];

    assert!(has_underfunded_pool(&required, &balances));
}

#[test]
fn collateral_status_accepts_all_ready() {
    let required = vec![100, 75, 25];
    let balances = vec![100, 75, 30];

    assert!(!has_underfunded_pool(&required, &balances));
}
```

- [ ] **Step 2: Implement helper used by activation validation**

Add to `activate_master.rs`:

```rust
pub(crate) fn has_underfunded_pool(required: &[u64], balances: &[u64]) -> bool {
    required.len() != balances.len()
        || required.iter().zip(balances.iter()).any(|(r, b)| b < r)
}
```

- [ ] **Step 3: Extend activation accounts**

Update `ActivateMaster`:

```rust
use anchor_spl::token::TokenAccount;
use crate::math::{collateral_requirements, TierPayouts};

#[derive(Accounts)]
pub struct ActivateMaster<'info> {
    pub operator: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
    pub leader_pool_token: Account<'info, TokenAccount>,
    pub reinsurer_pool_token: Account<'info, TokenAccount>,
}
```

Use `ctx.remaining_accounts` for participant pool token accounts in `master.participants` order.

- [ ] **Step 4: Implement all-pool balance checks**

Inside `handler`, after confirmation checks and before status update:

```rust
let master_key = master.key();
validate_pool_account(
    &ctx.accounts.leader_pool_token,
    master.leader_pool_wallet,
    master.currency_mint,
    master_key,
)?;

let participant_shares: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
let req = collateral_requirements(
    TierPayouts {
        delay_2h: master.payout_delay_2h,
        delay_3h: master.payout_delay_3h,
        delay_4to5h: master.payout_delay_4to5h,
        delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
    },
    master.collateral_claim_count,
    master.reinsurer_effective_bps,
    master.leader_share_bps,
    &participant_shares,
)?;

require!(
    ctx.accounts.leader_pool_token.amount >= req.leader_required,
    OpenParamError::InvalidAmount
);

if let Some(reinsurer_pool_wallet) = master.reinsurer_pool_wallet {
    validate_pool_account(
        &ctx.accounts.reinsurer_pool_token,
        reinsurer_pool_wallet,
        master.currency_mint,
        master_key,
    )?;
    require!(
        ctx.accounts.reinsurer_pool_token.amount >= req.reinsurer_required,
        OpenParamError::InvalidAmount
    );
}

require!(
    ctx.remaining_accounts.len() == master.participants.len(),
    OpenParamError::InvalidAccountList
);

for (idx, account_info) in ctx.remaining_accounts.iter().enumerate() {
    let pool: Account<TokenAccount> = Account::try_from(account_info)?;
    validate_pool_account(
        &pool,
        master.participants[idx].pool_wallet,
        master.currency_mint,
        master_key,
    )?;
    require!(
        pool.amount >= req.participant_required[idx],
        OpenParamError::InvalidAmount
    );
}
```

Add helper:

```rust
fn validate_pool_account(
    pool: &Account<TokenAccount>,
    expected_key: Pubkey,
    currency_mint: Pubkey,
    master_key: Pubkey,
) -> Result<()> {
    require!(pool.key() == expected_key, OpenParamError::InvalidSettlementTarget);
    require!(pool.mint == currency_mint, OpenParamError::InvalidInput);
    require!(pool.owner == master_key, OpenParamError::InvalidSettlementTarget);
    Ok(())
}
```

- [ ] **Step 5: Add `fund_pool` instruction**

Create `fund_pool.rs`:

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct FundPool<'info> {
    pub actor: Signer<'info>,
    pub master_agreement: Account<'info, MasterAgreement>,
    #[account(mut)]
    pub actor_source_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub actor_pool_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FundPool>, role: u8, amount: u64) -> Result<()> {
    require!(amount > 0, OpenParamError::InvalidAmount);

    let master = &ctx.accounts.master_agreement;
    let expected_pool = if role == ConfirmRole::Participant as u8 {
        if ctx.accounts.actor.key() == master.leader {
            master.leader_pool_wallet
        } else {
            let idx = master
                .participants
                .iter()
                .position(|p| p.insurer == ctx.accounts.actor.key())
                .ok_or(OpenParamError::Unauthorized)?;
            master.participants[idx].pool_wallet
        }
    } else if role == ConfirmRole::Reinsurer as u8 {
        let reinsurer = master.reinsurer.ok_or(OpenParamError::InvalidRole)?;
        require!(ctx.accounts.actor.key() == reinsurer, OpenParamError::Unauthorized);
        master.reinsurer_pool_wallet.ok_or(OpenParamError::InvalidRole)?
    } else {
        return Err(OpenParamError::InvalidRole.into());
    };

    require!(
        ctx.accounts.actor_pool_token.key() == expected_pool,
        OpenParamError::InvalidSettlementTarget
    );
    require!(
        ctx.accounts.actor_pool_token.mint == master.currency_mint,
        OpenParamError::InvalidInput
    );
    require!(
        ctx.accounts.actor_pool_token.owner == master.key(),
        OpenParamError::InvalidSettlementTarget
    );
    require!(
        ctx.accounts.actor_source_token.mint == master.currency_mint,
        OpenParamError::InvalidInput
    );
    require!(
        ctx.accounts.actor_source_token.owner == ctx.accounts.actor.key(),
        OpenParamError::Unauthorized
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.actor_source_token.to_account_info(),
                to: ctx.accounts.actor_pool_token.to_account_info(),
                authority: ctx.accounts.actor.to_account_info(),
            },
        ),
        amount,
    )
}
```

- [ ] **Step 6: Wire exports and program entrypoint**

In `instructions/mod.rs` add:

```rust
pub mod fund_pool;

#[cfg(test)]
mod fund_pool_test;

#[allow(ambiguous_glob_reexports)]
pub use fund_pool::*;
```

In `lib.rs` add:

```rust
pub fn fund_pool(ctx: Context<FundPool>, role: u8, amount: u64) -> Result<()> {
    instructions::fund_pool::handler(ctx, role, amount)
}
```

- [ ] **Step 7: Run contract checks**

Run:

```bash
cd contract && cargo fmt && cargo test activate_master_test && cargo test fund_pool && cargo test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add contract/programs/open_parametric/src/instructions/activate_master.rs contract/programs/open_parametric/src/instructions/activate_master_test.rs contract/programs/open_parametric/src/instructions/fund_pool.rs contract/programs/open_parametric/src/instructions/fund_pool_test.rs contract/programs/open_parametric/src/instructions/mod.rs contract/programs/open_parametric/src/lib.rs
git commit -m "Require funded pools before master activation" \
  -m "Activation is the final safety gate, and supplemental top-ups need a program-validated path that only funds the actor's own pool." \
  -m "Rejected: Trust total pool balance only | individual underfunding must block activation" \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd contract && cargo fmt && cargo test"
```

## Task 4: IDL and Frontend Types

**Files:**
- Modify: `contract/target/idl/open_parametric.json`
- Modify: `frontend/src/lib/idl/open_parametric.json`
- Modify: `frontend/src/lib/idl/open_parametric.ts`

- [ ] **Step 1: Build Anchor IDL**

Run:

```bash
cd contract && anchor build
```

Expected: `target/idl/open_parametric.json` updates with `collateral_claim_count`, expanded `confirm_master`, expanded `activate_master`, and `fund_pool`.

- [ ] **Step 2: Sync frontend IDL JSON**

Run:

```bash
cd frontend && yarn sync-idl
```

Expected: `frontend/src/lib/idl/open_parametric.json` matches contract target IDL.

- [ ] **Step 3: Update hand-maintained frontend types**

In `frontend/src/lib/idl/open_parametric.ts`, add to `MasterAgreementAccount`:

```ts
collateralClaimCount: number;
```

Add to `CreateMasterAgreementParams`:

```ts
collateralClaimCount: number;
```

Confirm the generated IDL type section includes `fundPool` and new accounts. If the file contains a literal generated type object, update the affected instruction account lists to match the JSON IDL.

- [ ] **Step 4: Typecheck frontend**

Run:

```bash
cd frontend && yarn build
```

Expected: FAIL only where hooks/components still call the old instruction shape. Those failures are expected and will be resolved in later tasks.

- [ ] **Step 5: Commit IDL/type contract**

```bash
git add contract/target/idl/open_parametric.json frontend/src/lib/idl/open_parametric.json frontend/src/lib/idl/open_parametric.ts
git commit -m "Sync collateral funding IDL with frontend types" \
  -m "Frontend instruction calls need the expanded account shapes and stored collateral count before UI work can compile." \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd contract && anchor build; cd frontend && yarn sync-idl; yarn build expected old-call failures"
```

## Task 5: Frontend Collateral Calculation Utilities

**Files:**
- Create: `frontend/src/lib/collateral.ts`
- Create: `frontend/src/lib/__tests__/collateral.test.ts`

- [ ] **Step 1: Write failing utility tests**

Create `frontend/src/lib/__tests__/collateral.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCollateralStatus, collateralDeficit, maxPayoutTier } from '../collateral';

describe('collateral utilities', () => {
  it('selects the max payout tier', () => {
    expect(maxPayoutTier({
      delay2h: 5,
      delay3h: 8,
      delay4to5h: 12,
      delay6hOrCancelled: 15,
    })).toBe(15);
  });

  it('saturates deficit at zero', () => {
    expect(collateralDeficit(100, 40)).toBe(60);
    expect(collateralDeficit(100, 120)).toBe(0);
  });

  it('builds total and party collateral status', () => {
    const status = buildCollateralStatus({
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      collateralClaimCount: 10,
      reinsurerEffectiveBps: 4500,
      leaderShareBps: 5000,
      participants: [
        { id: 'p1', label: 'Participant A', shareBps: 3000, confirmed: true, balance: 20 },
        { id: 'p2', label: 'Participant B', shareBps: 2000, confirmed: false, balance: 20 },
      ],
      leader: { label: 'Leader', confirmed: true, balance: 50 },
      reinsurer: { label: 'Reinsurer', confirmed: true, balance: 70 },
    });

    expect(status.totalRequired).toBe(150);
    expect(status.totalFunded).toBe(160);
    expect(status.parties.find(p => p.id === 'leader')?.required).toBe(41.25);
    expect(status.parties.find(p => p.id === 'p1')?.state).toBe('underfunded');
    expect(status.parties.find(p => p.id === 'p2')?.state).toBe('pending_confirm');
    expect(status.aggregateReady).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd frontend && yarn test src/lib/__tests__/collateral.test.ts
```

Expected: FAIL because `frontend/src/lib/collateral.ts` does not exist.

- [ ] **Step 3: Implement utility module**

Create `frontend/src/lib/collateral.ts`:

```ts
export interface PayoutTiersUsdc {
  delay2h: number;
  delay3h: number;
  delay4to5h: number;
  delay6hOrCancelled: number;
}

export type CollateralState = 'ready' | 'underfunded' | 'pending_confirm';

export interface CollateralPartyInput {
  label: string;
  confirmed: boolean;
  balance: number;
}

export interface CollateralParticipantInput extends CollateralPartyInput {
  id: string;
  shareBps: number;
}

export interface BuildCollateralStatusInput {
  payoutTiers: PayoutTiersUsdc;
  collateralClaimCount: number;
  reinsurerEffectiveBps: number;
  leaderShareBps: number;
  leader: CollateralPartyInput;
  participants: CollateralParticipantInput[];
  reinsurer?: CollateralPartyInput | null;
}

export interface CollateralPartyStatus {
  id: string;
  label: string;
  role: 'leader' | 'participant' | 'reinsurer';
  shareBps: number;
  required: number;
  balance: number;
  deficit: number;
  surplus: number;
  fundedPct: number;
  confirmed: boolean;
  state: CollateralState;
}

export interface CollateralStatus {
  totalRequired: number;
  totalFunded: number;
  totalDeficit: number;
  totalSurplus: number;
  totalHealthPct: number;
  aggregateReady: boolean;
  parties: CollateralPartyStatus[];
}

export function maxPayoutTier(tiers: PayoutTiersUsdc): number {
  return Math.max(tiers.delay2h, tiers.delay3h, tiers.delay4to5h, tiers.delay6hOrCancelled);
}

export function collateralDeficit(required: number, balance: number): number {
  return Math.max(0, required - balance);
}

function partyState(required: number, balance: number, confirmed: boolean): CollateralState {
  if (!confirmed) return 'pending_confirm';
  return balance + Number.EPSILON >= required ? 'ready' : 'underfunded';
}

function buildParty(args: {
  id: string;
  label: string;
  role: CollateralPartyStatus['role'];
  shareBps: number;
  required: number;
  balance: number;
  confirmed: boolean;
}): CollateralPartyStatus {
  const deficit = collateralDeficit(args.required, args.balance);
  const surplus = Math.max(0, args.balance - args.required);
  return {
    ...args,
    deficit,
    surplus,
    fundedPct: args.required > 0 ? Math.min(100, (args.balance / args.required) * 100) : 100,
    state: partyState(args.required, args.balance, args.confirmed),
  };
}

export function buildCollateralStatus(input: BuildCollateralStatusInput): CollateralStatus {
  const totalRequired = maxPayoutTier(input.payoutTiers) * input.collateralClaimCount;
  const reinsurerRequired = input.reinsurer
    ? totalRequired * (input.reinsurerEffectiveBps / 10_000)
    : 0;
  const insurerTotalRequired = totalRequired - reinsurerRequired;

  const parties: CollateralPartyStatus[] = [
    buildParty({
      id: 'leader',
      label: input.leader.label,
      role: 'leader',
      shareBps: input.leaderShareBps,
      required: insurerTotalRequired * (input.leaderShareBps / 10_000),
      balance: input.leader.balance,
      confirmed: input.leader.confirmed,
    }),
    ...input.participants.map(p => buildParty({
      id: p.id,
      label: p.label,
      role: 'participant' as const,
      shareBps: p.shareBps,
      required: insurerTotalRequired * (p.shareBps / 10_000),
      balance: p.balance,
      confirmed: p.confirmed,
    })),
  ];

  if (input.reinsurer) {
    parties.push(buildParty({
      id: 'reinsurer',
      label: input.reinsurer.label,
      role: 'reinsurer',
      shareBps: input.reinsurerEffectiveBps,
      required: reinsurerRequired,
      balance: input.reinsurer.balance,
      confirmed: input.reinsurer.confirmed,
    }));
  }

  const totalFunded = parties.reduce((sum, p) => sum + p.balance, 0);
  const totalDeficit = parties.reduce((sum, p) => sum + p.deficit, 0);
  const totalSurplus = Math.max(0, totalFunded - totalRequired);
  const aggregateReady = parties.every(p => p.state === 'ready') && totalDeficit === 0;

  return {
    totalRequired,
    totalFunded,
    totalDeficit,
    totalSurplus,
    totalHealthPct: totalRequired > 0 ? Math.min(100, (totalFunded / totalRequired) * 100) : 100,
    aggregateReady,
    parties,
  };
}
```

- [ ] **Step 4: Run frontend utility tests**

Run:

```bash
cd frontend && yarn test src/lib/__tests__/collateral.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/collateral.ts frontend/src/lib/__tests__/collateral.test.ts
git commit -m "Model collateral health for frontend views" \
  -m "Dashboard and portal views need one shared calculation path for total health, party deficits, and confirmation states." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: cd frontend && yarn test src/lib/__tests__/collateral.test.ts"
```

## Task 6: Frontend Instruction Hooks and Store

**Files:**
- Modify: `frontend/src/store/useProtocolStore.ts`
- Modify: `frontend/src/hooks/useCreateMasterAgreement.ts`
- Modify: `frontend/src/hooks/useConfirmMaster.ts`
- Modify: `frontend/src/hooks/useActivateMaster.ts`
- Create: `frontend/src/hooks/useFundPool.ts`

- [ ] **Step 1: Add store test for collateral claim count**

Add to `frontend/src/store/__tests__/useProtocolStore.test.ts`:

```ts
it('stores collateral claim count in master terms', () => {
  setState({ collateralClaimCount: 10 });
  expect(getState().collateralClaimCount).toBe(10);

  getState().setCollateralClaimCount(25);
  expect(getState().collateralClaimCount).toBe(25);
});
```

- [ ] **Step 2: Implement store field**

In `useProtocolStore.ts`, add state and action:

```ts
collateralClaimCount: number;
setCollateralClaimCount: (count: number) => void;
```

Initial state:

```ts
collateralClaimCount: 10,
```

Action:

```ts
setCollateralClaimCount: (count) => set({ collateralClaimCount: Math.min(100, Math.max(1, count)) }),
```

Include `collateralClaimCount` in persistence partialize with other master terms.

- [ ] **Step 3: Update create master hook input**

In `useCreateMasterAgreement.ts`, add:

```ts
collateralClaimCount: number;
```

Pass it to the Anchor method params:

```ts
collateralClaimCount: input.collateralClaimCount,
```

- [ ] **Step 4: Update confirm and activate hooks**

In `useConfirmMaster.ts`, extend input:

```ts
actorSourceToken: PublicKey;
actorPoolToken: PublicKey;
```

Pass accounts:

```ts
actorSourceToken: input.actorSourceToken,
actorPoolToken: input.actorPoolToken,
tokenProgram: TOKEN_PROGRAM_ID,
```

Import:

```ts
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
```

In `useActivateMaster.ts`, extend input:

```ts
leaderPoolToken: PublicKey;
reinsurerPoolToken: PublicKey;
participantPoolTokens: PublicKey[];
```

Build remaining accounts:

```ts
.remainingAccounts(input.participantPoolTokens.map(pubkey => ({
  pubkey,
  isWritable: false,
  isSigner: false,
})))
```

- [ ] **Step 5: Create supplemental fund hook**

Create `frontend/src/hooks/useFundPool.ts`:

```ts
import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { ConfirmRole } from '@/lib/idl/open_parametric';

export interface FundPoolInput {
  masterAgreement: PublicKey;
  role: ConfirmRole;
  actorSourceToken: PublicKey;
  actorPoolToken: PublicKey;
  amountRaw: BN;
}

export function useFundPool() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const fundPool = useCallback(async (input: FundPoolInput): Promise<TxResult> => {
    if (!program || !provider || !wallet) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      return await sendTx(provider, () =>
        prog.methods
          .fundPool(input.role, input.amountRaw)
          .accounts({
            actor: wallet.publicKey,
            masterAgreement: input.masterAgreement,
            actorSourceToken: input.actorSourceToken,
            actorPoolToken: input.actorPoolToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc(),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { signature: '', success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [program, provider, wallet]);

  return { fundPool, loading };
}
```

- [ ] **Step 6: Run focused tests/typecheck**

Run:

```bash
cd frontend && yarn test src/store/__tests__/useProtocolStore.test.ts && yarn build
```

Expected: Store tests pass. Build may still fail in components not yet migrated; record the failing files and continue to Task 7.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/store/useProtocolStore.ts frontend/src/store/__tests__/useProtocolStore.test.ts frontend/src/hooks/useCreateMasterAgreement.ts frontend/src/hooks/useConfirmMaster.ts frontend/src/hooks/useActivateMaster.ts frontend/src/hooks/useFundPool.ts
git commit -m "Expose collateral funding instructions to frontend" \
  -m "Frontend flows need the stored collateral count and updated instruction accounts before UI components can switch from direct transfers." \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd frontend && yarn test src/store/__tests__/useProtocolStore.test.ts"
```

## Task 7: Master Setup and Remove Fund All Pools

**Files:**
- Modify: `frontend/src/components/tabs/tab-contract/MasterContractSetup.tsx`
- Modify: `frontend/src/components/guide/guideSteps.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/ko.ts`

- [ ] **Step 1: Record the removal target**

Before editing, run:

```bash
cd frontend && rg "Fund All Pools|fundAllPools|전체 풀 충전|handleFundPools|fund-pool-btn" src
```

Expected: matches in `MasterContractSetup.tsx`, guide steps, and locale files. These matches are the removal target for this task.

- [ ] **Step 2: Add collateral count input**

In `MasterContractSetup.tsx`, read store field/action:

```ts
const { collateralClaimCount, setCollateralClaimCount } = store;
const [localCollateralClaimCount, setLocalCollateralClaimCount] = useState(collateralClaimCount);
```

Add input near payout tiers:

```tsx
<FormGroup>
  <FormLabel>{t('master.collateralClaimCount')}</FormLabel>
  <FormInput
    type="number"
    value={locked ? store.collateralClaimCount : localCollateralClaimCount}
    onChange={e => setLocalCollateralClaimCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
    min={1}
    max={100}
    readOnly={locked}
    style={{ fontFamily: "'DM Mono', monospace", opacity: locked ? 0.6 : 1 }}
  />
</FormGroup>
```

Before `setTerms`/create master, persist:

```ts
setCollateralClaimCount(localCollateralClaimCount);
```

Pass to create instruction params:

```ts
collateralClaimCount: localCollateralClaimCount,
```

- [ ] **Step 3: Remove Fund All Pools handler and button**

Delete `fundLoading` state and the entire `handleFundPools` function from `MasterContractSetup.tsx`.

Remove:

```tsx
{mode === 'onchain' && masterActive && (
  <Button variant="warning" fullWidth onClick={handleFundPools} disabled={fundLoading} style={{ marginTop: 6 }} data-guide="fund-pool-btn">
    {fundLoading ? 'Funding...' : t('master.fundAllPools')}
  </Button>
)}
```

Remove unused imports `createTransferInstruction` if no longer used in the file.

- [ ] **Step 4: Update guide and i18n**

Remove guide step targeting `fund-pool-btn` from `frontend/src/components/guide/guideSteps.ts`.

Add labels:

```ts
'master.collateralClaimCount': 'Collateral claim count',
```

and Korean:

```ts
'master.collateralClaimCount': '담보 기준 최대 보상 건수',
```

- [ ] **Step 5: Verify no Fund All Pools UI remains**

Run:

```bash
cd frontend && rg "Fund All Pools|fundAllPools|전체 풀 충전|fund-pool-btn" src
yarn build
```

Expected: `rg` returns no matches for removed labels/buttons, except historical docs if docs are included by mistake. `yarn build` passes after all component call sites are updated, or fails only on portal/dashboard tasks not yet completed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tabs/tab-contract/MasterContractSetup.tsx frontend/src/components/guide/guideSteps.ts frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/ko.ts
git commit -m "Remove leader-wide pool funding from setup" \
  -m "The master setup UI now records collateral coverage and no longer lets the leader fund every party pool as the primary flow." \
  -m "Rejected: Keep Fund All Pools as a fallback button | it preserves the old responsibility model" \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd frontend && rg 'Fund All Pools|fundAllPools|전체 풀 충전|fund-pool-btn' src; yarn build"
```

## Task 8: Pool Health Visual Component

**Files:**
- Create: `frontend/src/components/tabs/shared/PoolHealthVisual.tsx`
- Create or modify frontend component tests if an existing pattern supports it.

- [ ] **Step 1: Create visual component**

Create `frontend/src/components/tabs/shared/PoolHealthVisual.tsx`:

```tsx
import styled from '@emotion/styled';
import { Card, CardBody, CardHeader, CardTitle, Tag } from '@/components/common';
import type { CollateralStatus } from '@/lib/collateral';
import { formatNum } from '@/store/useProtocolStore';

const Summary = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
`;

const Metric = styled.div`
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card2);
`;

const MetricLabel = styled.div`
  color: var(--sub);
  font-size: 10px;
  margin-bottom: 4px;
`;

const MetricValue = styled.div`
  font-family: 'DM Mono', monospace;
  font-size: 14px;
  font-weight: 700;
`;

const PartyList = styled.div`
  display: grid;
  gap: 10px;
`;

const PartyBand = styled.div<{ active?: boolean }>`
  padding: 10px;
  border: 1px solid ${p => p.active ? 'var(--primary)' : 'var(--border)'};
  border-radius: 8px;
  background: ${p => p.active ? 'rgba(153,69,255,.08)' : 'var(--card2)'};
`;

const PartyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
`;

const BarTrack = styled.div`
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(148,163,184,.16);
`;

const BarFill = styled.div<{ pct: number; state: string }>`
  width: ${p => p.pct}%;
  height: 100%;
  background: ${p =>
    p.state === 'ready' ? 'var(--success)' :
    p.state === 'pending_confirm' ? 'var(--warning)' :
    'var(--danger)'};
`;

function stateLabel(state: string) {
  if (state === 'ready') return 'Ready';
  if (state === 'pending_confirm') return 'Pending Confirm';
  return 'Underfunded';
}

export function PoolHealthVisual({
  title,
  status,
  activePartyId,
}: {
  title: string;
  status: CollateralStatus;
  activePartyId?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Tag variant={status.aggregateReady ? 'accent' : 'warning'}>
          {status.aggregateReady ? 'Ready' : 'Action Needed'}
        </Tag>
      </CardHeader>
      <CardBody>
        <Summary>
          <Metric>
            <MetricLabel>Total Health</MetricLabel>
            <MetricValue>{formatNum(status.totalHealthPct, 1)}%</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>Funded</MetricLabel>
            <MetricValue>{formatNum(status.totalFunded, 2)} USDC</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>Required</MetricLabel>
            <MetricValue>{formatNum(status.totalRequired, 2)} USDC</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>Deficit</MetricLabel>
            <MetricValue>{formatNum(status.totalDeficit, 2)} USDC</MetricValue>
          </Metric>
        </Summary>
        <PartyList>
          {status.parties.map(p => (
            <PartyBand key={p.id} active={p.id === activePartyId}>
              <PartyHeader>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{p.label}</div>
                  <div style={{ color: 'var(--sub)', fontSize: 10 }}>{(p.shareBps / 100).toFixed(1)}% exposure</div>
                </div>
                <Tag variant={p.state === 'ready' ? 'accent' : 'warning'}>{stateLabel(p.state)}</Tag>
              </PartyHeader>
              <BarTrack><BarFill pct={p.fundedPct} state={p.state} /></BarTrack>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--sub)' }}>
                <span>{formatNum(p.balance, 2)} / {formatNum(p.required, 2)} USDC</span>
                <span>{p.deficit > 0 ? `${formatNum(p.deficit, 2)} deficit` : `${formatNum(p.surplus, 2)} surplus`}</span>
              </div>
            </PartyBand>
          ))}
        </PartyList>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
cd frontend && yarn build
```

Expected: This component compiles, with any remaining failures coming from not-yet-updated consumers.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tabs/shared/PoolHealthVisual.tsx
git commit -m "Add visual pool health component" \
  -m "The dashboard needs total solvency context plus party-level bars so individual deficits remain visible." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: cd frontend && yarn build"
```

## Task 9: Pool Balance Hook and Dashboard Integration

**Files:**
- Create: `frontend/src/hooks/usePoolCollateralStatus.ts`
- Modify: `frontend/src/components/tabs/tab-contract/PoolStatus.tsx`

- [ ] **Step 1: Create hook that builds status from master account**

Create `frontend/src/hooks/usePoolCollateralStatus.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { useMasterAgreementAccount } from './useMasterAgreementAccount';
import { buildCollateralStatus, type CollateralStatus } from '@/lib/collateral';

const USDC_DECIMALS = 1_000_000;

async function readBalance(connection: ReturnType<typeof useProgram>['connection'], pubkey: PublicKey | null | undefined) {
  if (!connection || !pubkey || pubkey.equals(PublicKey.default)) return 0;
  try {
    const bal = await connection.getTokenAccountBalance(pubkey);
    return Number(bal.value.amount) / USDC_DECIMALS;
  } catch {
    return 0;
  }
}

export function usePoolCollateralStatus(masterPDA: PublicKey | null, activeWallet?: PublicKey | null) {
  const { connection } = useProgram();
  const { account: masterData } = useMasterAgreementAccount(masterPDA);
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!connection || !masterData) return;
    let cancelled = false;

    async function load() {
      const next: Record<string, number> = {};
      next.leader = await readBalance(connection, masterData.leaderPoolWallet);
      if (masterData.reinsurerPoolWallet) {
        next.reinsurer = await readBalance(connection, masterData.reinsurerPoolWallet);
      }
      for (let i = 0; i < masterData.participants.length; i += 1) {
        next[`participant-${i}`] = await readBalance(connection, masterData.participants[i].poolWallet);
      }
      if (!cancelled) setBalances(next);
    }

    void load();
    return () => { cancelled = true; };
  }, [connection, masterData]);

  const status: CollateralStatus | null = useMemo(() => {
    if (!masterData) return null;
    return buildCollateralStatus({
      payoutTiers: {
        delay2h: masterData.payoutDelay2H.toNumber() / USDC_DECIMALS,
        delay3h: masterData.payoutDelay3H.toNumber() / USDC_DECIMALS,
        delay4to5h: masterData.payoutDelay4To5H.toNumber() / USDC_DECIMALS,
        delay6hOrCancelled: masterData.payoutDelay6HOrCancelled.toNumber() / USDC_DECIMALS,
      },
      collateralClaimCount: masterData.collateralClaimCount ?? 10,
      reinsurerEffectiveBps: masterData.reinsurerEffectiveBps,
      leaderShareBps: masterData.leaderShareBps,
      leader: {
        label: 'Leader',
        confirmed: true,
        balance: balances.leader ?? 0,
      },
      participants: masterData.participants.map((p, i) => ({
        id: `participant-${i}`,
        label: `Participant ${i + 1}`,
        shareBps: p.shareBps,
        confirmed: p.confirmed,
        balance: balances[`participant-${i}`] ?? 0,
      })),
      reinsurer: masterData.reinsurer ? {
        label: 'Reinsurer',
        confirmed: masterData.reinsurerConfirmed,
        balance: balances.reinsurer ?? 0,
      } : null,
    });
  }, [balances, masterData]);

  const activePartyId = useMemo(() => {
    if (!activeWallet || !masterData) return undefined;
    if (masterData.leader.equals(activeWallet)) return 'leader';
    if (masterData.reinsurer?.equals(activeWallet)) return 'reinsurer';
    const idx = masterData.participants.findIndex(p => p.insurer.equals(activeWallet));
    return idx >= 0 ? `participant-${idx}` : undefined;
  }, [activeWallet, masterData]);

  return { status, activePartyId, masterData };
}
```

- [ ] **Step 2: Integrate dashboard PoolStatus**

In `PoolStatus.tsx`, import:

```ts
import { PoolHealthVisual } from '@/components/tabs/shared/PoolHealthVisual';
import { usePoolCollateralStatus } from '@/hooks/usePoolCollateralStatus';
```

Build `pdaKey` as already done and call:

```ts
const { status } = usePoolCollateralStatus(pdaKey);
```

Render the visual above or below the existing chart:

```tsx
{status && (
  <div style={{ marginBottom: 10 }}>
    <PoolHealthVisual title={t('pool.healthTitle')} status={status} />
  </div>
)}
```

Keep the existing total chart for historical pool movement.

- [ ] **Step 3: Add i18n label**

Add:

```ts
'pool.healthTitle': 'Pool Health',
```

and Korean:

```ts
'pool.healthTitle': 'Pool 건전성',
```

- [ ] **Step 4: Run frontend checks**

Run:

```bash
cd frontend && yarn build && yarn test src/lib/__tests__/collateral.test.ts
```

Expected: PASS after all old instruction call sites compile.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/usePoolCollateralStatus.ts frontend/src/components/tabs/tab-contract/PoolStatus.tsx frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/ko.ts
git commit -m "Show total and party pool health on dashboard" \
  -m "Leaders need visual total solvency plus per-party funding bars to identify underfunded participants before activation." \
  -m "Rejected: Show only total pool health | surplus from one party can hide another party's deficit" \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd frontend && yarn build && yarn test src/lib/__tests__/collateral.test.ts"
```

## Task 10: Portal Confirm and Supplemental Funding

**Files:**
- Modify: `frontend/src/components/tabs/tab-portal/PortalConfirm.tsx`
- Modify: `frontend/src/components/tabs/tab-portal/PortalOverview.tsx`
- Modify: `frontend/src/pages/PortalPage.tsx`
- Modify: `frontend/src/i18n/locales/en.ts`
- Modify: `frontend/src/i18n/locales/ko.ts`

- [ ] **Step 1: Update PortalConfirm to show funding deficit**

Use `usePoolCollateralStatus(masterPDA, wallet?.publicKey)` and find the active party:

```ts
const { status, activePartyId, masterData } = usePoolCollateralStatus(masterPDA, wallet?.publicKey);
const activeParty = status?.parties.find(p => p.id === activePartyId);
```

Render before the button:

```tsx
{activeParty && (
  <>
    <Divider />
    <KVRow label={t('portal.requiredCollateral')} value={`${formatNum(activeParty.required, 2)} USDC`} />
    <KVRow label={t('portal.currentPoolBalance')} value={`${formatNum(activeParty.balance, 2)} USDC`} />
    <KVRow label={t('portal.collateralDeficit')} value={`${formatNum(activeParty.deficit, 2)} USDC`} />
  </>
)}
```

- [ ] **Step 2: Update confirm transaction accounts**

For participant/leader/reinsurer, derive:

```ts
const sourceToken = await getAssociatedTokenAddress(masterData.currencyMint, wallet.publicKey);
const actorPoolToken = activePartyId === 'leader'
  ? masterData.leaderPoolWallet
  : activePartyId === 'reinsurer'
    ? masterData.reinsurerPoolWallet
    : masterData.participants[participantInfo.participantIndex - 1].poolWallet;
```

Call:

```ts
await prog.methods
  .confirmMaster(isReinsurer ? ConfirmRole.Reinsurer : ConfirmRole.Participant)
  .accounts({
    actor: wallet.publicKey,
    masterAgreement: masterPDA,
    actorSourceToken: sourceToken,
    actorPoolToken,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc({ commitment: 'confirmed' });
```

Keep the existing pool account creation/register flow for participants before confirmation. For reinsurer, use the configured `reinsurerPoolWallet`.

- [ ] **Step 3: Use `fund_pool` in PortalOverview**

Replace direct `createTransferInstruction` transfer with `useFundPool`.

After finding `myPoolWallet`, call:

```ts
const result = await fundPool({
  masterAgreement: masterPDA,
  role: participantInfo.role === 'rein' ? ConfirmRole.Reinsurer : ConfirmRole.Participant,
  actorSourceToken: myATA,
  actorPoolToken: myPoolWallet,
  amountRaw: new BN(amountRaw),
});
```

Handle result:

```ts
if (result.success) {
  toast(`${t('portal.fundSuccess')} TX: ${result.signature.slice(0, 8)}...`, 's');
  setFundAmount('');
} else {
  toast(`${t('portal.fundFailed')}: ${result.error}`, 'd');
}
```

- [ ] **Step 4: Show visual pool context in portal**

In `PortalOverview.tsx`, render:

```tsx
{status && (
  <div style={{ marginTop: 10 }}>
    <PoolHealthVisual title={t('pool.healthTitle')} status={status} activePartyId={activePartyId} />
  </div>
)}
```

- [ ] **Step 5: Add portal labels**

Add English:

```ts
'portal.requiredCollateral': 'Required collateral',
'portal.currentPoolBalance': 'Current pool balance',
'portal.collateralDeficit': 'Collateral deficit',
'portal.confirmBtn': 'Fund Deficit & Confirm',
'portal.fundMyPool': 'Supplemental Collateral Top-up',
```

Add Korean:

```ts
'portal.requiredCollateral': '필요 담보금',
'portal.currentPoolBalance': '현재 Pool 잔액',
'portal.collateralDeficit': '부족 담보금',
'portal.confirmBtn': '부족분 납부 및 확인',
'portal.fundMyPool': '추가 담보금 보충',
```

- [ ] **Step 6: Run frontend checks**

Run:

```bash
cd frontend && yarn build && yarn test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/tabs/tab-portal/PortalConfirm.tsx frontend/src/components/tabs/tab-portal/PortalOverview.tsx frontend/src/pages/PortalPage.tsx frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/ko.ts
git commit -m "Make portal confirmation fund collateral deficits" \
  -m "Participants and reinsurers now see their required collateral, pay only the missing amount during confirmation, and can top up through fund_pool." \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd frontend && yarn build && yarn test"
```

## Task 11: Activation Flow Call Sites

**Files:**
- Modify: `frontend/src/components/tabs/tab-contract/ParticipantConfirm.tsx`
- Modify any component that calls `useActivateMaster`.

- [ ] **Step 1: Update activation call accounts**

Where `activateMaster` is called, fetch master account and pass pool accounts:

```ts
const masterData = await prog.account.masterAgreement.fetch(masterPK);
const participantPoolTokens = masterData.participants.map((p: { poolWallet: PublicKey }) => p.poolWallet);
const result = await activateMaster({
  masterAgreement: masterPK,
  leaderPoolToken: masterData.leaderPoolWallet,
  reinsurerPoolToken: masterData.reinsurerPoolWallet ?? masterData.leaderPoolWallet,
  participantPoolTokens,
});
```

- [ ] **Step 2: Disable activation UI when collateral status is not ready**

Use `usePoolCollateralStatus(masterPK)` and compute:

```ts
const activationBlocked = status ? !status.aggregateReady : true;
```

Apply to button:

```tsx
disabled={loading || activationBlocked}
```

Show concise blocker text:

```tsx
{activationBlocked && status && (
  <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 6 }}>
    {t('confirm.collateralNotReady')}
  </div>
)}
```

- [ ] **Step 3: Add i18n label**

English:

```ts
'confirm.collateralNotReady': 'All party pools must be funded before activation.',
```

Korean:

```ts
'confirm.collateralNotReady': '모든 참여 주체의 Pool 담보금이 충족되어야 활성화할 수 있습니다.',
```

- [ ] **Step 4: Run frontend checks**

Run:

```bash
cd frontend && yarn build && yarn test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/tabs/tab-contract/ParticipantConfirm.tsx frontend/src/i18n/locales/en.ts frontend/src/i18n/locales/ko.ts
git commit -m "Block activation until party pools are funded" \
  -m "The frontend now mirrors the contract activation gate so operators can see collateral blockers before sending the transaction." \
  -m "Confidence: medium" \
  -m "Scope-risk: moderate" \
  -m "Tested: cd frontend && yarn build && yarn test"
```

## Task 12: Final Verification and Docs Sweep

**Files:**
- Modify docs only if implementation details diverged from the approved spec.

- [ ] **Step 1: Run full contract checks**

Run:

```bash
cd contract && cargo fmt -- --check && cargo test && anchor build
```

Expected: PASS.

- [ ] **Step 2: Run full frontend checks**

Run:

```bash
cd frontend && yarn lint && yarn test && yarn build
```

Expected: PASS.

- [ ] **Step 3: Check removed old flow**

Run:

```bash
rg "Fund All Pools|fundAllPools|전체 풀 충전|handleFundPools|fund-pool-btn" frontend/src docs contract/programs/open_parametric/src
```

Expected: no matches except historical discussion in committed design docs if `docs` is intentionally included. If docs matches are noisy, rerun against `frontend/src contract/programs/open_parametric/src` and require no matches there.

- [ ] **Step 4: Check git diff**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Expected: only intended files changed, no whitespace errors.

- [ ] **Step 5: Commit final doc adjustments when implementation changed documented behavior**

When Step 4 shows doc edits because implementation details changed documented behavior, run:

```bash
git add docs/POLICY.md docs/superpowers/specs/2026-04-26-participant-pool-collateral-design.md
git commit -m "Align collateral docs with implementation details" \
  -m "The implementation clarified account names and UI labels, so the policy/spec now match the shipped flow." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Tested: cargo fmt -- --check; cargo test; anchor build; yarn lint; yarn test; yarn build"
```

- [ ] **Step 6: Final report**

Report:

- contract files changed.
- frontend files changed.
- simplifications made, including removal of `Fund All Pools`.
- verification commands and pass/fail results.
- remaining risks, especially any manual devnet transaction paths not exercised locally.
