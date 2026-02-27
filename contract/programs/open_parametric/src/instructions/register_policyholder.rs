use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
pub struct RegisterPolicyholder<'info> {
    #[account(mut, seeds = [b"registry", policy.key().as_ref()], bump = registry.bump)]
    pub registry: Account<'info, PolicyholderRegistry>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
}

pub fn handler(ctx: Context<RegisterPolicyholder>, entry: PolicyholderEntryInput) -> Result<()> {
    let registry = &mut ctx.accounts.registry;

    // 리더 권한과 입력 길이/최대 인원 제한을 확인한 뒤 레지스트리에 추가한다.
    require!(ctx.accounts.policy.leader == ctx.accounts.leader.key(), OpenParamError::Unauthorized);
    require!(registry.policy == ctx.accounts.policy.key(), OpenParamError::InvalidInput);
    require!(entry.external_ref.len() <= MAX_EXTERNAL_REF_LEN, OpenParamError::InputTooLong);
    require!(entry.flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);
    require!(registry.entries.len() < MAX_POLICYHOLDERS, OpenParamError::InvalidInput);

    registry.entries.push(PolicyholderEntry {
        external_ref: entry.external_ref,
        policy_id: entry.policy_id,
        flight_no: entry.flight_no,
        departure_date: entry.departure_date,
        passenger_count: entry.passenger_count,
        premium_paid: entry.premium_paid,
        coverage_amount: entry.coverage_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
