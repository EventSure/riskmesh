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

pub(crate) fn validate_fund_pool_status(
    master_status: u8,
) -> std::result::Result<(), OpenParamError> {
    if master_status == MasterAgreementStatus::PendingConfirm as u8
        || master_status == MasterAgreementStatus::Active as u8
    {
        Ok(())
    } else {
        Err(OpenParamError::InvalidState)
    }
}

pub(crate) fn resolve_actor_pool(
    role: u8,
    actor: Pubkey,
    leader: Pubkey,
    leader_pool_wallet: Pubkey,
    participants: &[MasterParticipant],
    reinsurer: Option<Pubkey>,
    reinsurer_pool_wallet: Option<Pubkey>,
) -> std::result::Result<Pubkey, OpenParamError> {
    if role == ConfirmRole::Participant as u8 {
        if actor == leader {
            Ok(leader_pool_wallet)
        } else {
            let idx = participants
                .iter()
                .position(|p| p.insurer == actor)
                .ok_or(OpenParamError::Unauthorized)?;
            Ok(participants[idx].pool_wallet)
        }
    } else if role == ConfirmRole::Reinsurer as u8 {
        let expected = reinsurer.ok_or(OpenParamError::InvalidRole)?;
        if actor != expected {
            return Err(OpenParamError::Unauthorized);
        }
        reinsurer_pool_wallet.ok_or(OpenParamError::InvalidRole)
    } else {
        Err(OpenParamError::InvalidRole)
    }
}

pub(crate) struct FundPoolAccountValidation {
    pub actor: Pubkey,
    pub master_key: Pubkey,
    pub currency_mint: Pubkey,
    pub actor_source_owner: Pubkey,
    pub actor_source_mint: Pubkey,
    pub actor_pool_key: Pubkey,
    pub expected_pool: Pubkey,
    pub actor_pool_mint: Pubkey,
    pub actor_pool_owner: Pubkey,
}

pub(crate) fn validate_fund_pool_accounts(
    accounts: FundPoolAccountValidation,
) -> std::result::Result<(), OpenParamError> {
    if accounts.actor_pool_key != accounts.expected_pool {
        return Err(OpenParamError::InvalidSettlementTarget);
    }
    if accounts.actor_pool_mint != accounts.currency_mint {
        return Err(OpenParamError::InvalidInput);
    }
    if accounts.actor_pool_owner != accounts.master_key {
        return Err(OpenParamError::InvalidSettlementTarget);
    }
    if accounts.actor_source_mint != accounts.currency_mint {
        return Err(OpenParamError::InvalidInput);
    }
    if accounts.actor_source_owner != accounts.actor {
        return Err(OpenParamError::Unauthorized);
    }
    Ok(())
}

pub fn handler(ctx: Context<FundPool>, role: u8, amount: u64) -> Result<()> {
    require!(amount > 0, OpenParamError::InvalidAmount);

    let master = &ctx.accounts.master_agreement;
    validate_fund_pool_status(master.status)?;
    let expected_pool = resolve_actor_pool(
        role,
        ctx.accounts.actor.key(),
        master.leader,
        master.leader_pool_wallet,
        &master.participants,
        master.reinsurer,
        master.reinsurer_pool_wallet,
    )?;

    validate_fund_pool_accounts(FundPoolAccountValidation {
        actor: ctx.accounts.actor.key(),
        master_key: master.key(),
        currency_mint: master.currency_mint,
        actor_source_owner: ctx.accounts.actor_source_token.owner,
        actor_source_mint: ctx.accounts.actor_source_token.mint,
        actor_pool_key: ctx.accounts.actor_pool_token.key(),
        expected_pool,
        actor_pool_mint: ctx.accounts.actor_pool_token.mint,
        actor_pool_owner: ctx.accounts.actor_pool_token.owner,
    })?;

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
