use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct ActivatePolicy<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
}

pub fn handler(ctx: Context<ActivatePolicy>) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    // 자금 조달(Funded) 완료 + 시작 시각 도달 시점부터만 Active 전환을 허용한다.
    require!(policy.state == PolicyState::Funded as u8, OpenParamError::InvalidState);
    let now = Clock::get()?.unix_timestamp;
    require!(now >= policy.active_from, OpenParamError::InvalidTimeWindow);

    policy.state = PolicyState::Active as u8;

    Ok(())
}
