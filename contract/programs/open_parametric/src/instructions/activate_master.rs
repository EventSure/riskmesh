use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constants::MIN_COLLATERAL_CASE_COUNT;
use crate::errors::OpenParamError;
use crate::math::{split_by_bps, BPS_DENOM};
use crate::state::*;

#[derive(Accounts)]
pub struct ActivateMaster<'info> {
    pub operator: Signer<'info>,
    #[account(mut)]
    pub master_policy: Account<'info, MasterPolicy>,
    pub reinsurer_pool_token: Account<'info, TokenAccount>,
}

pub fn handler(ctx: Context<ActivateMaster>) -> Result<()> {
    let master = &mut ctx.accounts.master_policy;
    // 마스터 계약 활성화 전 필수 승인(운영자/재보험사/참여사 지갑 등록)을 확인한다.
    require!(
        master.status == MasterPolicyStatus::PendingConfirm as u8,
        OpenParamError::InvalidState
    );
    require!(
        ctx.accounts.operator.key() == master.operator,
        OpenParamError::Unauthorized
    );
    require!(
        master.reinsurer_confirmed,
        OpenParamError::MasterNotConfirmed
    );

    let all_confirmed = all_participants_confirmed(&master.participants);
    require!(all_confirmed, OpenParamError::MasterNotConfirmed);

    // 남아있는 계정은 master.participants 순서의 pool 토큰 계정이어야 한다.
    require!(
        ctx.remaining_accounts.len() == master.participants.len(),
        OpenParamError::InvalidAccountList
    );

    validate_reinsurer_pool(&ctx.accounts.reinsurer_pool_token, master)?;

    let required = calc_min_collateral_by_pool(master)?;
    require!(
        ctx.accounts.reinsurer_pool_token.amount >= required.reinsurer,
        OpenParamError::PoolInsufficient
    );

    for (idx, pool_info) in ctx.remaining_accounts.iter().enumerate() {
        let pool_wallet: Account<TokenAccount> = Account::try_from(pool_info)?;
        let participant = &master.participants[idx];

        require!(
            pool_wallet.key() == participant.pool_wallet,
            OpenParamError::InvalidAccountList
        );
        require!(
            pool_wallet.mint == master.currency_mint,
            OpenParamError::InvalidInput
        );
        require!(
            pool_wallet.owner == master.key(),
            OpenParamError::Unauthorized
        );
        require!(
            pool_wallet.amount >= required.participants[idx],
            OpenParamError::PoolInsufficient
        );
    }

    master.status = MasterPolicyStatus::Active as u8;
    Ok(())
}

pub(crate) fn all_participants_confirmed(participants: &[MasterParticipant]) -> bool {
    // confirmed 플래그와 정산 지갑 등록 여부를 동시에 확인한다.
    participants.iter().all(|p| {
        p.confirmed && p.pool_wallet != Pubkey::default() && p.deposit_wallet != Pubkey::default()
    })
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct MinCollateral {
    pub reinsurer: u64,
    pub participants: Vec<u64>,
}

pub(crate) fn calc_min_collateral_by_pool(
    master: &MasterPolicy,
) -> std::result::Result<MinCollateral, OpenParamError> {
    let max_payout = master.payout_delay_6h_or_cancelled;
    let required_total = max_payout
        .checked_mul(MIN_COLLATERAL_CASE_COUNT)
        .ok_or(OpenParamError::MathOverflow)?;

    let reinsurer = required_total
        .checked_mul(master.reinsurer_effective_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?
        / BPS_DENOM;

    let insurer_total = required_total
        .checked_sub(reinsurer)
        .ok_or(OpenParamError::MathOverflow)?;

    let participant_bps: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
    let participants = split_by_bps(insurer_total, &participant_bps)?;

    Ok(MinCollateral {
        reinsurer,
        participants,
    })
}

fn validate_reinsurer_pool(pool: &Account<TokenAccount>, master: &MasterPolicy) -> Result<()> {
    require!(
        pool.key() == master.reinsurer_pool_wallet,
        OpenParamError::InvalidAccountList
    );
    require!(
        pool.mint == master.currency_mint,
        OpenParamError::InvalidInput
    );
    require!(pool.owner == master.key(), OpenParamError::Unauthorized);
    Ok(())
}
