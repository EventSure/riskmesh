use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct AcceptShare<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
    #[account(mut, seeds = [b"pool", policy.key().as_ref()], bump = risk_pool.bump)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(mut)]
    pub participant_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<AcceptShare>, index: u8, deposit_amount: u64) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let uw = &mut ctx.accounts.underwriting;

    require!(policy.state == PolicyState::Open as u8, OpenParamError::InvalidState);
    require!(policy.underwriting == uw.key(), OpenParamError::InvalidInput);
    require!(policy.pool == ctx.accounts.risk_pool.key(), OpenParamError::InvalidInput);
    require!(ctx.accounts.vault.key() == ctx.accounts.risk_pool.vault, OpenParamError::InvalidInput);
    require!(ctx.accounts.participant_token.mint == policy.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.vault.mint == policy.currency_mint, OpenParamError::InvalidInput);
    require!(
        ctx.accounts.participant_token.owner == ctx.accounts.participant.key(),
        OpenParamError::Unauthorized
    );

    let i = index as usize;
    require!(i < uw.participants.len(), OpenParamError::NotFound);
    let share = &mut uw.participants[i];
    require!(share.insurer == ctx.accounts.participant.key(), OpenParamError::Unauthorized);
    require!(share.status == ParticipantStatus::Pending as u8, OpenParamError::InvalidState);
    // Phase 1 수정: ratio_bps > 0 검증 추가
    require!(share.ratio_bps > 0, OpenParamError::InvalidRatio);
    require!(deposit_amount > 0, OpenParamError::InvalidAmount);

    let required = calc_required_deposit(policy.payout_amount, share.ratio_bps)?;
    require!(deposit_amount >= required, OpenParamError::InsufficientEscrow);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.participant_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.participant.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, deposit_amount)?;

    share.status = ParticipantStatus::Accepted as u8;
    share.escrow = ctx.accounts.participant_token.key();
    share.escrowed_amount = deposit_amount;
    ctx.accounts.risk_pool.total_escrowed = ctx
        .accounts
        .risk_pool
        .total_escrowed
        .checked_add(deposit_amount)
        .unwrap();
    ctx.accounts.risk_pool.available_balance = ctx
        .accounts
        .risk_pool
        .available_balance
        .checked_add(deposit_amount)
        .unwrap();

    let accepted_sum = calc_accepted_ratio_sum(&uw.participants)?;
    require!(accepted_sum <= 10000, OpenParamError::InvalidRatio);
    if accepted_sum == 10000 {
        uw.status = UnderwritingStatus::Finalized as u8;
        policy.state = PolicyState::Funded as u8;
    }

    Ok(())
}

pub(crate) fn calc_required_deposit(
    payout_amount: u64,
    ratio_bps: u16,
) -> std::result::Result<u64, OpenParamError> {
    if ratio_bps == 0 || ratio_bps > 10_000 {
        return Err(OpenParamError::InvalidRatio);
    }
    payout_amount
        .checked_mul(ratio_bps as u64)
        .ok_or(OpenParamError::MathOverflow)
        .map(|v| v / 10_000)
}

pub(crate) fn calc_accepted_ratio_sum(
    participants: &[ParticipantShare],
) -> std::result::Result<u32, OpenParamError> {
    let mut sum: u32 = 0;
    for p in participants {
        if p.status == ParticipantStatus::Accepted as u8 {
            sum = sum
                .checked_add(p.ratio_bps as u32)
                .ok_or(OpenParamError::MathOverflow)?;
        }
    }
    Ok(sum)
}
