use anchor_lang::prelude::*;

use crate::errors::OpenParamError;
use crate::math::{tiered_payout, TierPayouts};
use crate::state::*;

#[derive(Accounts)]
pub struct ResolveFlightDelay<'info> {
    pub resolver: Signer<'info>,
    pub master_policy: Account<'info, MasterPolicy>,
    #[account(mut)]
    pub flight_policy: Account<'info, FlightPolicy>,
}

pub fn handler(ctx: Context<ResolveFlightDelay>, delay_minutes: u16, cancelled: bool) -> Result<()> {
    let master = &ctx.accounts.master_policy;
    let flight = &mut ctx.accounts.flight_policy;

    require!(master.status == MasterPolicyStatus::Active as u8, OpenParamError::MasterNotActive);
    require!(ctx.accounts.resolver.key() == master.leader || ctx.accounts.resolver.key() == master.operator, OpenParamError::Unauthorized);
    require!(flight.master == master.key(), OpenParamError::InvalidInput);
    require!(
        flight.status == FlightPolicyStatus::AwaitingOracle as u8 || flight.status == FlightPolicyStatus::Issued as u8,
        OpenParamError::InvalidState
    );

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
