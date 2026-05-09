use anchor_lang::prelude::*;
use switchboard_on_demand::{PullFeedAccountData, QuoteVerifier};

use crate::constants::ORACLE_MAX_STALENESS_SLOTS;
use crate::errors::OpenParamError;
use crate::math::{tiered_payout, TierPayouts};
use crate::state::*;

/// Track B — Switchboard On-Demand quote 기반 자동 지연 확정.
///
/// 이 instruction은 반드시 동일 트랜잭션에서 Switchboard quote 검증 instruction 뒤에
/// 포함되어야 한다:
///   ix[0]: Switchboard quote ed25519 ix — feed hash와 oracle 값을 서명 검증
///   ix[1]: 이 instruction — 검증된 quote에서 값 읽기
///
/// oracle_feed 계정은 Explorer 조회용 v2 feed hash를 보관하는 기준 계정으로 사용한다.
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
    /// feed_hash를 읽어 quote feed_id와 일치하는지 검증.
    pub oracle_feed: UncheckedAccount<'info>,
    /// CHECK: Switchboard queue account for quote verification.
    pub switchboard_queue: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar, validated by Switchboard verifier.
    pub slothash_sysvar: UncheckedAccount<'info>,
    /// CHECK: Instructions sysvar, validated by Switchboard verifier.
    pub instructions_sysvar: UncheckedAccount<'info>,
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

    // oracle_feed 계정은 Explorer 호환 v2 feed hash를 저장하는 기준 계정이다.
    let feed_data = ctx.accounts.oracle_feed.try_borrow_data()?;
    let needed = 8 + std::mem::size_of::<PullFeedAccountData>();
    require!(feed_data.len() >= needed, OpenParamError::OracleFormat);
    let feed: &PullFeedAccountData =
        bytemuck::from_bytes(&feed_data[8..8 + std::mem::size_of::<PullFeedAccountData>()]);

    let current_slot = Clock::get()?.slot;
    let quote = QuoteVerifier::new()
        .queue(&*ctx.accounts.switchboard_queue)
        .slothash_sysvar(&*ctx.accounts.slothash_sysvar)
        .ix_sysvar(&*ctx.accounts.instructions_sysvar)
        .clock_slot(current_slot)
        .max_age(ORACLE_MAX_STALENESS_SLOTS)
        .verify_instruction_at(0)
        .map_err(|_| OpenParamError::OracleFormat)?;

    let quote_feed = quote
        .feeds()
        .iter()
        .find(|quote_feed| quote_feed.feed_id() == &feed.feed_hash)
        .ok_or(OpenParamError::OracleFormat)?;

    // Switchboard PRECISION=18: result.value = actual_minutes * 10^18
    const ORACLE_PRECISION: i128 = 1_000_000_000_000_000_000; // 10^18
    let raw_value = quote_feed.feed_value();
    let mantissa = if raw_value < 0 || ORACLE_PRECISION == 0 {
        return Err(OpenParamError::OracleFormat.into());
    } else {
        raw_value / ORACLE_PRECISION
    };

    let (delay_minutes, payout, status) = apply_oracle_reading(
        mantissa,
        0, // scale=0 (already converted from PRECISION=18)
        current_slot,
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
