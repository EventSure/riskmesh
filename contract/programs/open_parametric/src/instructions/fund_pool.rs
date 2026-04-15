use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct FundPool<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    pub master_policy: Account<'info, MasterPolicy>,
    #[account(mut)]
    pub funder_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FundPool>, amount: u64) -> Result<()> {
    let master = &ctx.accounts.master_policy;

    require!(amount > 0, OpenParamError::InvalidAmount);
    require!(
        master.status != MasterPolicyStatus::Closed as u8,
        OpenParamError::InvalidState
    );
    require!(
        master.status != MasterPolicyStatus::Cancelled as u8,
        OpenParamError::InvalidState
    );

    require!(
        ctx.accounts.funder_token_account.owner == ctx.accounts.funder.key(),
        OpenParamError::Unauthorized
    );
    require!(
        ctx.accounts.funder_token_account.mint == master.currency_mint,
        OpenParamError::InvalidInput
    );
    require!(
        ctx.accounts.pool_token.mint == master.currency_mint,
        OpenParamError::InvalidInput
    );

    let expected_pool = if ctx.accounts.funder.key() == master.reinsurer {
        master.reinsurer_pool_wallet
    } else {
        let participant = master
            .participants
            .iter()
            .find(|p| p.insurer == ctx.accounts.funder.key())
            .ok_or(OpenParamError::Unauthorized)?;
        participant.pool_wallet
    };

    require!(
        expected_pool != Pubkey::default(),
        OpenParamError::InvalidInput
    );
    require!(
        ctx.accounts.pool_token.key() == expected_pool,
        OpenParamError::InvalidInput
    );

    let cpi_accounts = Transfer {
        from: ctx.accounts.funder_token_account.to_account_info(),
        to: ctx.accounts.pool_token.to_account_info(),
        authority: ctx.accounts.funder.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}
