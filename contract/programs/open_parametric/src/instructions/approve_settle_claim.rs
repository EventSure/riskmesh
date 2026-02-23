use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::state::*;

// ─── Approve ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ApproveClaim<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut)]
    pub claim: Account<'info, Claim>,
}

pub fn approve_handler(ctx: Context<ApproveClaim>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let claim = &mut ctx.accounts.claim;

    require!(policy.state == PolicyState::Claimable as u8, OpenParamError::InvalidState);
    require!(claim.status == ClaimStatus::Claimable as u8, OpenParamError::InvalidState);

    claim.status = ClaimStatus::Approved as u8;
    claim.approved_by = ctx.accounts.leader.key();
    policy.state = PolicyState::Approved as u8;

    Ok(())
}

// ─── Settle ───────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct SettleClaim<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut)]
    pub claim: Account<'info, Claim>,
    #[account(mut, seeds = [b"pool", policy.key().as_ref()], bump = risk_pool.bump)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub beneficiary_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn settle_handler(ctx: Context<SettleClaim>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let claim = &mut ctx.accounts.claim;

    require!(policy.state == PolicyState::Approved as u8, OpenParamError::InvalidState);
    require!(claim.status == ClaimStatus::Approved as u8, OpenParamError::InvalidState);
    require!(
        claim.payout_amount <= ctx.accounts.risk_pool.available_balance,
        OpenParamError::PoolInsufficient
    );
    require!(ctx.accounts.vault.key() == ctx.accounts.risk_pool.vault, OpenParamError::InvalidInput);
    require!(
        ctx.accounts.beneficiary_token.mint == policy.currency_mint,
        OpenParamError::InvalidInput
    );

    let policy_key = policy.key();
    let seeds = &[
        b"pool".as_ref(),
        policy_key.as_ref(),
        &[ctx.accounts.risk_pool.bump],
    ];
    let signer = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.beneficiary_token.to_account_info(),
            authority: ctx.accounts.risk_pool.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi_ctx, claim.payout_amount)?;

    ctx.accounts.risk_pool.available_balance = ctx
        .accounts
        .risk_pool
        .available_balance
        .checked_sub(claim.payout_amount)
        .unwrap();
    claim.status = ClaimStatus::Settled as u8;
    policy.state = PolicyState::Settled as u8;

    Ok(())
}
