use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct RejectShare<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
}

pub fn handler(ctx: Context<RejectShare>, index: u8) -> Result<()> {
    let policy = &ctx.accounts.policy;
    let uw = &mut ctx.accounts.underwriting;

    // 참여 거절은 Open 상태에서 Pending 참여자만 가능하다.
    require!(
        policy.state == PolicyState::Open as u8,
        OpenParamError::InvalidState
    );

    let i = index as usize;
    require!(i < uw.participants.len(), OpenParamError::NotFound);
    let share = &mut uw.participants[i];
    // Phase 1 수정: insurer 일치 검증 추가
    require!(
        share.insurer == ctx.accounts.participant.key(),
        OpenParamError::Unauthorized
    );
    require!(
        share.status == ParticipantStatus::Pending as u8,
        OpenParamError::InvalidState
    );
    share.status = ParticipantStatus::Rejected as u8;

    Ok(())
}
