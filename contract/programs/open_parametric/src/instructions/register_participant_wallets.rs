use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct RegisterParticipantWallets<'info> {
    #[account(mut)]
    pub insurer: Signer<'info>,
    #[account(mut)]
    pub master_policy: Account<'info, MasterPolicy>,
    pub pool_wallet: Account<'info, TokenAccount>,
    pub deposit_wallet: Account<'info, TokenAccount>,
}

pub fn handler(ctx: Context<RegisterParticipantWallets>) -> Result<()> {
    let master = &mut ctx.accounts.master_policy;
    // 활성 이후에는 정산 지갑 정보를 바꿀 수 없도록 막는다.
    require!(master.status != MasterPolicyStatus::Closed as u8, OpenParamError::InvalidState);
    require!(master.status != MasterPolicyStatus::Cancelled as u8, OpenParamError::InvalidState);
    require!(master.status != MasterPolicyStatus::Active as u8, OpenParamError::InvalidState);
    require!(ctx.accounts.pool_wallet.mint == master.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.deposit_wallet.mint == master.currency_mint, OpenParamError::InvalidInput);

    // signer와 매칭되는 참여자를 찾아 pool/deposit 정산 지갑을 기록한다.
    let idx = master
        .participants
        .iter()
        .position(|p| p.insurer == ctx.accounts.insurer.key())
        .ok_or(OpenParamError::NotFound)?;

    master.participants[idx].pool_wallet = ctx.accounts.pool_wallet.key();
    master.participants[idx].deposit_wallet = ctx.accounts.deposit_wallet.key();

    Ok(())
}
