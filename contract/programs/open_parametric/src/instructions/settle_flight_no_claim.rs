use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::math::{split_by_bps, BPS_DENOM};
use crate::state::*;

#[derive(Accounts)]
pub struct SettleFlightNoClaim<'info> {
    pub executor: Signer<'info>,
    pub master_policy: Account<'info, MasterPolicy>,
    #[account(mut)]
    pub flight_policy: Account<'info, FlightPolicy>,
    #[account(mut)]
    pub leader_deposit_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reinsurer_deposit_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SettleFlightNoClaim>) -> Result<()> {
    let master = &ctx.accounts.master_policy;
    let flight = &mut ctx.accounts.flight_policy;

    require!(master.status == MasterPolicyStatus::Active as u8, OpenParamError::MasterNotActive);
    require!(ctx.accounts.executor.key() == master.leader || ctx.accounts.executor.key() == master.operator, OpenParamError::Unauthorized);
    require!(flight.master == master.key(), OpenParamError::InvalidInput);
    require!(flight.status == FlightPolicyStatus::NoClaim as u8, OpenParamError::InvalidState);
    require!(!flight.premium_distributed, OpenParamError::AlreadySettled);

    require!(ctx.accounts.leader_deposit_token.key() == master.leader_deposit_wallet, OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_deposit_token.key() == master.reinsurer_deposit_wallet, OpenParamError::InvalidInput);
    require!(ctx.accounts.leader_deposit_token.mint == master.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_deposit_token.mint == master.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.leader_deposit_token.owner == master.key(), OpenParamError::InvalidSettlementTarget);

    require!(ctx.remaining_accounts.len() == master.participants.len(), OpenParamError::InvalidAccountList);

    let premium = flight.premium_paid;
    let reinsurer_amount = premium
        .checked_mul(master.reinsurer_effective_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?
        / BPS_DENOM;
    let insurer_total = premium
        .checked_sub(reinsurer_amount)
        .ok_or(OpenParamError::MathOverflow)?;

    let insurer_ratios: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
    let insurer_amounts = split_by_bps(insurer_total, &insurer_ratios)?;

    let seed_master_id = master.master_id.to_le_bytes();
    let seeds = &[
        b"master_policy".as_ref(),
        master.leader.as_ref(),
        seed_master_id.as_ref(),
        &[master.bump],
    ];
    let signer = &[&seeds[..]];

    if reinsurer_amount > 0 {
        let reins_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.leader_deposit_token.to_account_info(),
                to: ctx.accounts.reinsurer_deposit_token.to_account_info(),
                authority: ctx.accounts.master_policy.to_account_info(),
            },
            signer,
        );
        token::transfer(reins_ctx, reinsurer_amount)?;
    }

    for (i, amount) in insurer_amounts.iter().enumerate() {
        if *amount == 0 {
            continue;
        }
        let deposit_info = &ctx.remaining_accounts[i];
        let deposit_wallet: Account<TokenAccount> = Account::try_from(deposit_info)?;

        require!(deposit_wallet.key() == master.participants[i].deposit_wallet, OpenParamError::InvalidInput);
        require!(deposit_wallet.mint == master.currency_mint, OpenParamError::InvalidInput);

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.leader_deposit_token.to_account_info(),
                to: deposit_info.to_account_info(),
                authority: ctx.accounts.master_policy.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, *amount)?;
    }

    flight.premium_distributed = true;
    flight.status = FlightPolicyStatus::Expired as u8;
    flight.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
