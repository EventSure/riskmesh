use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::errors::OpenParamError;
use crate::math::{collateral_requirements, TierPayouts};
use crate::state::*;

#[derive(Accounts)]
pub struct ActivateMaster<'info> {
    pub operator: Signer<'info>,
    #[account(mut)]
    pub master_agreement: Account<'info, MasterAgreement>,
    pub leader_pool_token: Account<'info, TokenAccount>,
    pub reinsurer_pool_token: Account<'info, TokenAccount>,
}

pub fn handler<'a>(ctx: Context<'_, '_, 'a, 'a, ActivateMaster<'a>>) -> Result<()> {
    let master = &mut ctx.accounts.master_agreement;
    // 마스터 계약 활성화 전 필수 승인(운영자/재보험사/참여사 지갑 등록)을 확인한다.
    require!(
        master.status == MasterAgreementStatus::PendingConfirm as u8,
        OpenParamError::InvalidState
    );
    require!(
        ctx.accounts.operator.key() == master.operator,
        OpenParamError::Unauthorized
    );
    require!(
        master.reinsurer.is_none() || master.reinsurer_confirmed,
        OpenParamError::MasterNotConfirmed
    );
    require!(
        master.leader_pool_wallet != Pubkey::default(),
        OpenParamError::MasterNotConfirmed
    );

    let all_confirmed = all_participants_confirmed(&master.participants);
    require!(all_confirmed, OpenParamError::MasterNotConfirmed);

    let master_key = master.key();
    validate_pool_account(
        &ctx.accounts.leader_pool_token,
        master.leader_pool_wallet,
        master.currency_mint,
        master_key,
    )?;

    let participant_shares: Vec<u16> = master.participants.iter().map(|p| p.share_bps).collect();
    let req = collateral_requirements(
        TierPayouts {
            delay_2h: master.payout_delay_2h,
            delay_3h: master.payout_delay_3h,
            delay_4to5h: master.payout_delay_4to5h,
            delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
        },
        master.collateral_claim_count,
        master.reinsurer_effective_bps,
        master.leader_share_bps,
        &participant_shares,
    )?;

    require!(
        ctx.accounts.leader_pool_token.amount >= req.leader_required,
        OpenParamError::InvalidAmount
    );

    // When no reinsurer is configured, clients still pass a placeholder reinsurer_pool_token
    // account to satisfy the fixed instruction account list; validation is skipped here.
    if let Some(reinsurer_pool_wallet) = master.reinsurer_pool_wallet {
        validate_pool_account(
            &ctx.accounts.reinsurer_pool_token,
            reinsurer_pool_wallet,
            master.currency_mint,
            master_key,
        )?;
        require!(
            ctx.accounts.reinsurer_pool_token.amount >= req.reinsurer_required,
            OpenParamError::InvalidAmount
        );
    }

    require!(
        ctx.remaining_accounts.len() == master.participants.len(),
        OpenParamError::InvalidAccountList
    );

    for (idx, account_info) in ctx.remaining_accounts.iter().enumerate() {
        let pool: Account<TokenAccount> = Account::try_from(account_info)?;
        validate_pool_account(
            &pool,
            master.participants[idx].pool_wallet,
            master.currency_mint,
            master_key,
        )?;
        require!(
            pool.amount >= req.participant_required[idx],
            OpenParamError::InvalidAmount
        );
    }

    master.status = MasterAgreementStatus::Active as u8;
    Ok(())
}

pub(crate) fn all_participants_confirmed(participants: &[MasterParticipant]) -> bool {
    // confirmed 플래그와 정산 지갑 등록 여부를 동시에 확인한다.
    participants.iter().all(|p| {
        p.confirmed && p.pool_wallet != Pubkey::default() && p.deposit_wallet != Pubkey::default()
    })
}

#[cfg(test)]
pub(crate) fn has_underfunded_pool(required: &[u64], balances: &[u64]) -> bool {
    required.len() != balances.len() || required.iter().zip(balances.iter()).any(|(r, b)| b < r)
}

fn validate_pool_account(
    pool: &Account<TokenAccount>,
    expected_key: Pubkey,
    currency_mint: Pubkey,
    master_key: Pubkey,
) -> Result<()> {
    require!(
        pool.key() == expected_key,
        OpenParamError::InvalidSettlementTarget
    );
    require!(pool.mint == currency_mint, OpenParamError::InvalidInput);
    require!(
        pool.owner == master_key,
        OpenParamError::InvalidSettlementTarget
    );
    Ok(())
}
