use anchor_lang::prelude::*;
use switchboard_on_demand::{default_queue, Instructions, QuoteVerifier, SlotHashes};

use crate::constants::ORACLE_MAX_STALENESS_SLOTS;
use crate::errors::OpenParamError;
use crate::math::{tiered_payout, TierPayouts};
use crate::state::*;

/// Track B — Switchboard On-Demand oracle 기반 자동 지연 확정.
///
/// 이 instruction은 반드시 동일 트랜잭션의 3번째 instruction으로 포함되어야 한다:
///   ix[0]: Ed25519 서명 검증 instruction
///   ix[1]: Switchboard verified_update instruction
///   ix[2]: 이 instruction
///
/// Track A의 resolve_flight_delay(trusted resolver 수동 입력)와 달리,
/// 온체인 Switchboard QuoteVerifier로 신뢰 없이 검증한다.
/// cancelled = false 고정: Switchboard 피드는 정수 지연값만 반환함.
/// 실제 결항 건은 Track A resolve_flight_delay(cancelled=true)로 처리한다.
#[derive(Accounts)]
pub struct CheckOracleAndResolveFlight<'info> {
    /// 트랜잭션 수수료 부담자. 누구나 호출 가능.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// oracle_feed 주소와 tiered payout 기준을 제공하는 마스터 계약.
    pub master_agreement: Account<'info, MasterAgreement>,
    /// 지연 결과가 기록될 FlightPolicy.
    #[account(mut)]
    pub flight_policy: Account<'info, FlightPolicy>,
    /// CHECK: master_agreement.oracle_feed와 일치 여부를 handler에서 검증
    pub oracle_feed: UncheckedAccount<'info>,
    /// CHECK: Switchboard 기본 큐 — address constraint으로 검증됨
    #[account(address = default_queue())]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: slot hashes sysvar — SlotHashes sysvar trait으로 검증됨
    pub slot_hashes: Sysvar<'info, SlotHashes>,
    /// CHECK: instructions sysvar — Instructions sysvar trait으로 검증됨
    pub instructions: Sysvar<'info, Instructions>,
}

/// 계정 상태·주소 사전 검증 (QuoteVerifier CPI 이전에 실행).
pub(crate) fn validate_oracle_context(
    master_status: u8,
    oracle_feed_key: Pubkey,
    stored_oracle_feed: Pubkey,
    flight_master: Pubkey,
    master_key: Pubkey,
    flight_status: u8,
) -> std::result::Result<(), OpenParamError> {
    if master_status != MasterAgreementStatus::Active as u8 {
        return Err(OpenParamError::MasterNotActive);
    }
    if oracle_feed_key != stored_oracle_feed {
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

/// QuoteVerifier CPI 이후 오라클 값 파싱 + payout 계산.
/// staleness 이중 확인, scale/mantissa 검증, tiered_payout 계산을 수행한다.
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
        master.oracle_feed,
        flight.master,
        master.key(),
        flight.status,
    )?;

    // Switchboard QuoteVerifier: Ed25519(ix[0])와 verified_update(ix[1])를 검증한다.
    let oracle_quote = QuoteVerifier::new()
        .queue(ctx.accounts.queue.to_account_info())
        .slothash_sysvar(ctx.accounts.slot_hashes.to_account_info())
        .ix_sysvar(ctx.accounts.instructions.to_account_info())
        .clock_slot(Clock::get()?.slot)
        .max_age(ORACLE_MAX_STALENESS_SLOTS)
        .verify_instruction_at(0)
        .map_err(|_| OpenParamError::OracleStale)?;

    let current_slot = Clock::get()?.slot;

    let feeds = oracle_quote.feeds();
    require!(!feeds.is_empty(), OpenParamError::OracleFormat);
    let decimal_value = feeds[0].value();

    let (delay_minutes, payout, status) = apply_oracle_reading(
        decimal_value.mantissa(),
        decimal_value.scale(),
        oracle_quote.slot(),
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
