use anchor_lang::prelude::*;
use switchboard_on_demand::PullFeedAccountData;

use crate::constants::ORACLE_MAX_STALENESS_SLOTS;
use crate::errors::OpenParamError;
use crate::math::{tiered_payout, TierPayouts};
use crate::state::*;

/// Track B — Switchboard On-Demand Pull Feed 기반 자동 지연 확정.
///
/// 이 instruction은 반드시 동일 트랜잭션의 2번째 instruction으로 포함되어야 한다:
///   ix[0]: Switchboard pullIx (PullFeed.fetchUpdateIx) — oracle_feed 계정 업데이트
///   ix[1]: 이 instruction — 업데이트된 oracle_feed 계정에서 값 읽기
///
/// FlightPolicy.oracle_feed (per-flight feed)의 값을 검증하고 지연을 확정한다.
/// Switchboard Explorer에서 oracle_feed 주소로 실시간 업데이트를 확인할 수 있다.
#[derive(Accounts)]
pub struct CheckOracleAndResolveFlight<'info> {
    /// 트랜잭션 수수료 부담자. 누구나 호출 가능.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// tiered payout 기준을 제공하는 마스터 계약.
    pub master_agreement: Account<'info, MasterAgreement>,
    /// 지연 결과가 기록될 FlightPolicy.
    #[account(mut)]
    pub flight_policy: Account<'info, FlightPolicy>,
    /// CHECK: flight_policy.oracle_feed와 일치 여부를 handler에서 검증.
    /// 동일 tx의 앞선 pullIx(ix[0])가 이 계정을 업데이트한 후 실행되어야 함.
    pub oracle_feed: UncheckedAccount<'info>,
}

/// 계정 상태·주소 사전 검증.
pub(crate) fn validate_oracle_context(
    master_status: u8,
    oracle_feed_key: Pubkey,
    flight_oracle_feed: Pubkey,
    flight_master: Pubkey,
    master_key: Pubkey,
    flight_status: u8,
) -> std::result::Result<(), OpenParamError> {
    if master_status != MasterAgreementStatus::Active as u8 {
        return Err(OpenParamError::MasterNotActive);
    }
    if oracle_feed_key != flight_oracle_feed {
        return Err(OpenParamError::InvalidInput);
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

/// PullFeed 계정의 result 값 검증 + payout 계산.
/// staleness 확인, PRECISION=18 변환, tiered_payout 계산을 수행한다.
/// 반환: (delay_minutes, payout_amount, new_flight_status)
pub(crate) fn apply_oracle_reading(
    mantissa: i128,
    scale: u32,
    oracle_slot: u64,
    current_slot: u64,
    tiers: TierPayouts,
) -> std::result::Result<(u16, u64, u8), OpenParamError> {
    let staleness = current_slot.saturating_sub(oracle_slot);
    if staleness > ORACLE_MAX_STALENESS_SLOTS {
        return Err(OpenParamError::OracleStale);
    }
    if scale != 0 {
        return Err(OpenParamError::OracleFormat);
    }
    if mantissa < 0 {
        return Err(OpenParamError::OracleFormat);
    }
    if mantissa > u16::MAX as i128 {
        return Err(OpenParamError::OracleFormat);
    }
    let delay_minutes = mantissa as u16;
    let payout = tiered_payout(delay_minutes, false, tiers);
    let status = if payout > 0 {
        FlightPolicyStatus::Claimable as u8
    } else {
        FlightPolicyStatus::NoClaim as u8
    };
    Ok((delay_minutes, payout, status))
}

pub fn handler(ctx: Context<CheckOracleAndResolveFlight>) -> Result<()> {
    let master = &ctx.accounts.master_agreement;
    let flight = &mut ctx.accounts.flight_policy;

    validate_oracle_context(
        master.status,
        ctx.accounts.oracle_feed.key(),
        flight.oracle_feed,
        flight.master,
        master.key(),
        flight.status,
    )?;

    // pullIx(ix[0])가 oracle_feed 계정을 업데이트한 후 이 instruction이 실행됨.
    // PullFeedAccountData는 bytemuck::Pod 타입 — 8-byte discriminator 건너뛰고 zero-copy 캐스트.
    let feed_data = ctx.accounts.oracle_feed.try_borrow_data()?;
    let needed = 8 + std::mem::size_of::<PullFeedAccountData>();
    require!(feed_data.len() >= needed, OpenParamError::OracleFormat);
    let feed: &PullFeedAccountData =
        bytemuck::from_bytes(&feed_data[8..8 + std::mem::size_of::<PullFeedAccountData>()]);

    // oracle_feed가 아직 한 번도 업데이트되지 않은 경우 (slot == 0)
    require!(feed.result.slot > 0, OpenParamError::OracleStale);

    let current_slot = Clock::get()?.slot;

    // Switchboard PRECISION=18: result.value = actual_minutes * 10^18
    const ORACLE_PRECISION: i128 = 1_000_000_000_000_000_000; // 10^18
    let raw_value = feed.result.value;
    let mantissa = if raw_value < 0 || ORACLE_PRECISION == 0 {
        return Err(OpenParamError::OracleFormat.into());
    } else {
        raw_value / ORACLE_PRECISION
    };

    let (delay_minutes, payout, status) = apply_oracle_reading(
        mantissa,
        0, // scale=0 (already converted from PRECISION=18)
        feed.result.slot,
        current_slot,
        TierPayouts {
            delay_2h: master.payout_delay_2h,
            delay_3h: master.payout_delay_3h,
            delay_4to5h: master.payout_delay_4to5h,
            delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
        },
    )?;

    flight.delay_minutes = delay_minutes;
    flight.cancelled = false;
    flight.payout_amount = payout;
    flight.status = status;
    flight.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
