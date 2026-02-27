use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::constants::*;
use crate::errors::OpenParamError;
use crate::math::effective_reinsurer_bps;
use crate::state::*;

#[derive(Accounts)]
#[instruction(params: CreateMasterPolicyParams)]
pub struct CreateMasterPolicy<'info> {
    #[account(mut)]
    pub leader: Signer<'info>,
    /// CHECK: operator can be leader or protocol operator account
    pub operator: UncheckedAccount<'info>,
    /// CHECK: reinsurer identity account
    pub reinsurer: UncheckedAccount<'info>,
    pub currency_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = leader,
        space = MASTER_POLICY_SPACE,
        seeds = [b"master_policy", leader.key().as_ref(), &params.master_id.to_le_bytes()],
        bump
    )]
    pub master_policy: Account<'info, MasterPolicy>,
    #[account(mut)]
    pub leader_deposit_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reinsurer_pool_wallet: Account<'info, TokenAccount>,
    #[account(mut)]
    pub reinsurer_deposit_wallet: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMasterPolicy>, params: CreateMasterPolicyParams) -> Result<()> {
    let master = &mut ctx.accounts.master_policy;

    // 마스터 계약 생성 시점 기본 유효성 검증.
    require!(params.coverage_start_ts < params.coverage_end_ts, OpenParamError::InvalidTimeWindow);
    require!(params.premium_per_policy > 0, OpenParamError::InvalidAmount);
    validate_master_participants(&params.participants, ctx.accounts.leader.key())?;

    require!(ctx.accounts.leader_deposit_wallet.mint == ctx.accounts.currency_mint.key(), OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_pool_wallet.mint == ctx.accounts.currency_mint.key(), OpenParamError::InvalidInput);
    require!(ctx.accounts.reinsurer_deposit_wallet.mint == ctx.accounts.currency_mint.key(), OpenParamError::InvalidInput);

    // 재보험 실효 지분율(출재율 - 수수료 반영)을 사전에 계산해 저장한다.
    let eff_reinsurer_bps = effective_reinsurer_bps(params.ceded_ratio_bps, params.reins_commission_bps)?;

    master.master_id = params.master_id;
    master.leader = ctx.accounts.leader.key();
    master.operator = ctx.accounts.operator.key();
    master.currency_mint = ctx.accounts.currency_mint.key();
    master.coverage_start_ts = params.coverage_start_ts;
    master.coverage_end_ts = params.coverage_end_ts;
    master.premium_per_policy = params.premium_per_policy;
    master.payout_delay_2h = params.payout_delay_2h;
    master.payout_delay_3h = params.payout_delay_3h;
    master.payout_delay_4to5h = params.payout_delay_4to5h;
    master.payout_delay_6h_or_cancelled = params.payout_delay_6h_or_cancelled;
    master.ceded_ratio_bps = params.ceded_ratio_bps;
    master.reins_commission_bps = params.reins_commission_bps;
    master.reinsurer_effective_bps = eff_reinsurer_bps;
    master.reinsurer = ctx.accounts.reinsurer.key();
    master.reinsurer_confirmed = false;
    master.reinsurer_pool_wallet = ctx.accounts.reinsurer_pool_wallet.key();
    master.reinsurer_deposit_wallet = ctx.accounts.reinsurer_deposit_wallet.key();
    master.leader_deposit_wallet = ctx.accounts.leader_deposit_wallet.key();
    master.status = MasterPolicyStatus::PendingConfirm as u8;
    master.created_at = Clock::get()?.unix_timestamp;
    master.bump = ctx.bumps.master_policy;
    // 참여사 목록은 지분/확인여부/정산지갑 정보를 포함한 내부 구조로 변환한다.
    master.participants = params
        .participants
        .into_iter()
        .map(|p| MasterParticipant {
            insurer: p.insurer,
            share_bps: p.share_bps,
            confirmed: p.insurer == master.leader,
            pool_wallet: Pubkey::default(),
            deposit_wallet: Pubkey::default(),
        })
        .collect();

    Ok(())
}

pub(crate) fn validate_master_participants(
    participants: &[MasterParticipantInit],
    leader: Pubkey,
) -> std::result::Result<(), OpenParamError> {
    // 참여자 수, 총 지분 10000bps, 리더 포함 여부를 검증한다.
    if participants.is_empty() || participants.len() > MAX_MASTER_PARTICIPANTS {
        return Err(OpenParamError::InvalidInput);
    }

    let mut total_share: u32 = 0;
    let mut has_leader = false;
    for p in participants {
        total_share = total_share
            .checked_add(p.share_bps as u32)
            .ok_or(OpenParamError::MathOverflow)?;
        if p.insurer == leader {
            has_leader = true;
        }
    }

    if total_share != 10_000 {
        return Err(OpenParamError::InvalidRatio);
    }
    if !has_leader {
        return Err(OpenParamError::InvalidInput);
    }
    Ok(())
}
