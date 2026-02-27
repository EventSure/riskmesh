use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::OpenParamError;
use crate::math::{split_by_bps, BPS_DENOM};
use crate::state::*;

#[derive(Accounts)]
pub struct SettleFlightClaim<'info> {
    pub executor: Signer<'info>,
    pub master_policy: Account<'info, MasterPolicy>,
    #[account(mut)]
    pub flight_policy: Account<'info, FlightPolicy>,
    #[account(mut)]
    pub leader_deposit_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reinsurer_pool_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'a>(ctx: Context<'_, '_, 'a, 'a, SettleFlightClaim<'a>>) -> Result<()> {
    let master = &ctx.accounts.master_policy;
    let flight = &mut ctx.accounts.flight_policy;

    // Claimable 상태의 child 정책만 청구 정산할 수 있다.
    require!(master.status == MasterPolicyStatus::Active as u8, OpenParamError::MasterNotActive);
    require!(ctx.accounts.executor.key() == master.leader || ctx.accounts.executor.key() == master.operator, OpenParamError::Unauthorized);
    require!(flight.master == master.key(), OpenParamError::InvalidInput);
    require!(flight.status == FlightPolicyStatus::Claimable as u8, OpenParamError::InvalidState);
    require!(ctx.accounts.leader_deposit_token.key() == master.leader_deposit_wallet, OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_pool_token.key() == master.reinsurer_pool_wallet, OpenParamError::InvalidInput);
    require!(ctx.accounts.leader_deposit_token.mint == master.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_pool_token.mint == master.currency_mint, OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_pool_token.owner == master.key(), OpenParamError::InvalidSettlementTarget);

    require!(ctx.remaining_accounts.len() == master.participants.len(), OpenParamError::InvalidAccountList);

    let payout = flight.payout_amount;
    require!(payout > 0, OpenParamError::InvalidPayout);

    let insurer_ratios: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
    // 총 payout을 재보험사 몫 + 보험사(leader/A/B...) 몫으로 분리한다.
    let (reinsurer_amount, insurer_amounts) = calc_claim_split(payout, master.reinsurer_effective_bps, &insurer_ratios)?;

    let seed_master_id = master.master_id.to_le_bytes();
    let seeds = &[
        b"master_policy".as_ref(),
        master.leader.as_ref(),
        seed_master_id.as_ref(),
        &[master.bump],
    ];
    let signer = &[&seeds[..]];

    if reinsurer_amount > 0 {
        // 재보험 풀에서 리더 deposit으로 재보험사 부담분을 이동한다.
        let reins_transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.reinsurer_pool_token.to_account_info(),
                to: ctx.accounts.leader_deposit_token.to_account_info(),
                authority: ctx.accounts.master_policy.to_account_info(),
            },
            signer,
        );
        token::transfer(reins_transfer_ctx, reinsurer_amount)?;
    }

    for (i, amount) in insurer_amounts.iter().enumerate() {
        if *amount == 0 {
            continue;
        }
        let pool_info = &ctx.remaining_accounts[i];
        let pool_wallet: Account<TokenAccount> = Account::try_from(pool_info)?;

        require!(pool_wallet.key() == master.participants[i].pool_wallet, OpenParamError::InvalidInput);
        require!(pool_wallet.mint == master.currency_mint, OpenParamError::InvalidInput);
        require!(pool_wallet.owner == master.key(), OpenParamError::InvalidSettlementTarget);

        // 각 참여사 풀 지갑에서 리더 deposit으로 해당 부담분을 이체한다.
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: pool_info.to_account_info(),
                to: ctx.accounts.leader_deposit_token.to_account_info(),
                authority: ctx.accounts.master_policy.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, *amount)?;
    }

    flight.status = FlightPolicyStatus::Paid as u8;
    flight.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

pub(crate) fn calc_claim_split(
    payout: u64,
    reinsurer_effective_bps: u16,
    insurer_share_bps: &[u16],
) -> std::result::Result<(u64, Vec<u64>), OpenParamError> {
    // payout을 재보험사 실효 지분율 기준으로 분할하고, 잔여는 참여사 비율로 재분배한다.
    let reinsurer_amount = payout
        .checked_mul(reinsurer_effective_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?
        / BPS_DENOM;
    let insurer_total = payout
        .checked_sub(reinsurer_amount)
        .ok_or(OpenParamError::MathOverflow)?;
    let insurer_amounts = split_by_bps(insurer_total, insurer_share_bps)?;
    Ok((reinsurer_amount, insurer_amounts))
}
