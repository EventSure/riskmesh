use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct RegisterParticipantWallets<'info> {
    #[account(mut)]
    pub insurer: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
    pub pool_wallet: Account<'info, TokenAccount>,
    pub deposit_wallet: Account<'info, TokenAccount>,
}

pub(crate) fn validate_wallet_registration(
    master_status: u8,
    pool_mint: Pubkey,
    deposit_mint: Pubkey,
    currency_mint: Pubkey,
    pool_owner: Pubkey,
    master_key: Pubkey,
) -> std::result::Result<(), OpenParamError> {
    if master_status == MasterAgreementStatus::Closed as u8
        || master_status == MasterAgreementStatus::Cancelled as u8
        || master_status == MasterAgreementStatus::Active as u8
    {
        return Err(OpenParamError::InvalidState);
    }
    if pool_mint != currency_mint {
        return Err(OpenParamError::InvalidInput);
    }
    if deposit_mint != currency_mint {
        return Err(OpenParamError::InvalidInput);
    }
    if pool_owner != master_key {
        return Err(OpenParamError::InvalidSettlementTarget);
    }
    Ok(())
}

pub(crate) fn find_participant_idx(
    participants: &[MasterParticipant],
    insurer: Pubkey,
) -> std::result::Result<usize, OpenParamError> {
    participants
        .iter()
        .position(|p| p.insurer == insurer)
        .ok_or(OpenParamError::NotFound)
}

pub fn handler(ctx: Context<RegisterParticipantWallets>) -> Result<()> {
    let master = &mut ctx.accounts.master_agreement;
    validate_wallet_registration(
        master.status,
        ctx.accounts.pool_wallet.mint,
        ctx.accounts.deposit_wallet.mint,
        master.currency_mint,
        ctx.accounts.pool_wallet.owner,
        master.key(),
    )?;

    if ctx.accounts.insurer.key() == master.leader {
        require!(
            ctx.accounts.deposit_wallet.key() == master.leader_deposit_wallet,
            OpenParamError::InvalidInput
        );
        master.leader_pool_wallet = ctx.accounts.pool_wallet.key();
    } else {
        // signer와 매칭되는 참여자를 찾아 pool/deposit 정산 지갑을 기록한다.
        let idx = find_participant_idx(&master.participants, ctx.accounts.insurer.key())?;

        master.participants[idx].pool_wallet = ctx.accounts.pool_wallet.key();
        master.participants[idx].deposit_wallet = ctx.accounts.deposit_wallet.key();
    }

    Ok(())
}
