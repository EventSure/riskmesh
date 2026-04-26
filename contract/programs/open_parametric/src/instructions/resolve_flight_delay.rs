use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::math::{tiered_payout, TierPayouts};
use crate::state::*;

#[derive(Accounts)]
pub struct ResolveFlightDelay<'info> {
    pub resolver: Signer<'info>,
    pub master_agreement: Account<'info, MasterAgreement>,
    #[account(mut)]
    pub flight_policy: Account<'info, FlightPolicy>,
}

pub(crate) fn validate_resolve_inputs(
    master_status: u8,
    resolver: Pubkey,
    leader: Pubkey,
    operator: Pubkey,
    flight_master: Pubkey,
    master_key: Pubkey,
    flight_status: u8,
) -> std::result::Result<(), OpenParamError> {
    if master_status != MasterAgreementStatus::Active as u8 {
        return Err(OpenParamError::MasterNotActive);
    }
    if resolver != leader && resolver != operator {
        return Err(OpenParamError::Unauthorized);
    }
    if flight_master != master_key {
        return Err(OpenParamError::InvalidInput);
    }
    if flight_status != FlightPolicyStatus::AwaitingOracle as u8
        && flight_status != FlightPolicyStatus::Issued as u8
    {
        return Err(OpenParamError::InvalidState);
    }
    Ok(())
}

pub fn handler(
    ctx: Context<ResolveFlightDelay>,
    delay_minutes: u16,
    cancelled: bool,
) -> Result<()> {
    let master = &ctx.accounts.master_agreement;
    let flight = &mut ctx.accounts.flight_policy;

    validate_resolve_inputs(
        master.status,
        ctx.accounts.resolver.key(),
        master.leader,
        master.operator,
        flight.master,
        master.key(),
        flight.status,
    )?;

    // 지연 구간별 테이블에 따라 payout을 계산한다.
    let payout = tiered_payout(
        delay_minutes,
        cancelled,
        TierPayouts {
            delay_2h: master.payout_delay_2h,
            delay_3h: master.payout_delay_3h,
            delay_4to5h: master.payout_delay_4to5h,
            delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
        },
    );

    // payout 존재 여부에 따라 Claimable/NoClaim 상태를 결정한다.
    flight.delay_minutes = delay_minutes;
    flight.cancelled = cancelled;
    flight.payout_amount = payout;
    flight.status = if payout > 0 {
        FlightPolicyStatus::Claimable as u8
    } else {
        FlightPolicyStatus::NoClaim as u8
    };
    flight.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
