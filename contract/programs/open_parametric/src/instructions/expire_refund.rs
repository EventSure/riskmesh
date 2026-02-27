use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::state::*;

// ─── Expire ───────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ExpirePolicy<'info> {
    #[account(mut)]
    pub policy: Account<'info, Policy>,
}

pub fn expire_handler(ctx: Context<ExpirePolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    // 만기 시각(active_to) 경과 후에만 Expired 전환을 허용한다.
    require!(policy.state == PolicyState::Active as u8, OpenParamError::InvalidState);
    let now = Clock::get()?.unix_timestamp;
    require!(now > policy.active_to, OpenParamError::InvalidTimeWindow);

    policy.state = PolicyState::Expired as u8;

    Ok(())
}

// ─── Refund ───────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RefundAfterExpiry<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [b"pool", policy.key().as_ref()], bump = risk_pool.bump)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub participant_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
    pub token_program: Program<'info, Token>,
}

pub fn refund_handler(ctx: Context<RefundAfterExpiry>, share_index: u8) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    // Expired 이후 참여사별 에스크로를 원래 지갑으로 환급한다.
    require!(policy.state == PolicyState::Expired as u8, OpenParamError::InvalidState);

    let uw = &mut ctx.accounts.underwriting;
    let index = share_index as usize;
    require!(index < uw.participants.len(), OpenParamError::NotFound);
    let share = &mut uw.participants[index];
    require!(share.insurer == ctx.accounts.participant.key(), OpenParamError::Unauthorized);
    require!(share.status == ParticipantStatus::Accepted as u8, OpenParamError::InvalidState);
    require!(share.escrowed_amount > 0, OpenParamError::InsufficientEscrow);
    require!(ctx.accounts.vault.key() == ctx.accounts.risk_pool.vault, OpenParamError::InvalidInput);
    require!(
        ctx.accounts.participant_token.mint == policy.currency_mint,
        OpenParamError::InvalidInput
    );

    let policy_key = policy.key();
    let seeds = &[
        b"pool".as_ref(),
        policy_key.as_ref(),
        &[ctx.accounts.risk_pool.bump],
    ];
    let signer = &[&seeds[..]];
    // RiskPool PDA 서명으로 vault -> 참여사 토큰계정 환급 이체를 수행한다.
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.participant_token.to_account_info(),
            authority: ctx.accounts.risk_pool.to_account_info(),
        },
        signer,
    );
    token::transfer(cpi_ctx, share.escrowed_amount)?;

    ctx.accounts.risk_pool.available_balance = ctx
        .accounts
        .risk_pool
        .available_balance
        .checked_sub(share.escrowed_amount)
        .unwrap();
    share.escrowed_amount = 0;

    Ok(())
}
