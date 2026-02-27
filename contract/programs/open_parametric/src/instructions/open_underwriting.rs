use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct OpenUnderwriting<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
}

pub fn handler(ctx: Context<OpenUnderwriting>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let uw = &mut ctx.accounts.underwriting;

    // Draft/Proposed 조합에서만 Open 상태로 전환한다.
    require!(policy.state == PolicyState::Draft as u8, OpenParamError::InvalidState);
    // Phase 1 수정: Underwriting 상태 검증 추가
    require!(uw.status == UnderwritingStatus::Proposed as u8, OpenParamError::InvalidState);
    require!(policy.underwriting == uw.key(), OpenParamError::InvalidInput);

    policy.state = PolicyState::Open as u8;
    uw.status = UnderwritingStatus::Open as u8;

    Ok(())
}
