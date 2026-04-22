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

pub fn handler(ctx: Context<CheckOracleAndResolveFlight>) -> Result<()> {
    let master = &ctx.accounts.master_agreement;
    let flight = &mut ctx.accounts.flight_policy;

    // 마스터 Active 상태 확인.
    require!(
        master.status == MasterAgreementStatus::Active as u8,
        OpenParamError::MasterNotActive
    );
    // oracle_feed 주소가 마스터에 등록된 것과 일치해야 한다.
    require!(
        ctx.accounts.oracle_feed.key() == master.oracle_feed,
        OpenParamError::InvalidInput
    );
    // FlightPolicy가 이 MasterAgreement 소속인지 확인.
    require!(flight.master == master.key(), OpenParamError::InvalidInput);
    // oracle 대기 중인 상태만 처리한다.
    require!(
        flight.status == FlightPolicyStatus::AwaitingOracle as u8
            || flight.status == FlightPolicyStatus::Issued as u8,
        OpenParamError::InvalidState
    );

    // Switchboard QuoteVerifier: Ed25519(ix[0])와 verified_update(ix[1])를 검증한다.
    let oracle_quote = QuoteVerifier::new()
        .queue(ctx.accounts.queue.to_account_info())
        .slothash_sysvar(ctx.accounts.slot_hashes.to_account_info())
        .ix_sysvar(ctx.accounts.instructions.to_account_info())
        .clock_slot(Clock::get()?.slot)
        .max_age(ORACLE_MAX_STALENESS_SLOTS)
        .verify_instruction_at(0)
        .map_err(|_| OpenParamError::OracleStale)?;

    // 슬롯 기준 staleness 이중 확인.
    let current_slot = Clock::get()?.slot;
    let staleness = current_slot.saturating_sub(oracle_quote.slot());
    require!(
        staleness <= ORACLE_MAX_STALENESS_SLOTS,
        OpenParamError::OracleStale
    );

    // 피드 값을 파싱한다.
    let feeds = oracle_quote.feeds();
    require!(!feeds.is_empty(), OpenParamError::OracleFormat);
    let feed = &feeds[0];

    // 오라클 값은 "분 단위 정수"만 허용한다(scale=0, 음수 불가).
    let decimal_value = feed.value();
    require!(decimal_value.scale() == 0, OpenParamError::OracleFormat);
    let mantissa = decimal_value.mantissa();
    require!(mantissa >= 0, OpenParamError::OracleFormat);
    require!(mantissa <= u16::MAX as i128, OpenParamError::OracleFormat);
    let delay_minutes = mantissa as u16;

    // tiered_payout으로 지연 구간별 지급액 계산.
    // cancelled는 false 고정 — Switchboard 피드는 boolean을 직접 표현할 수 없음.
    let payout = tiered_payout(
        delay_minutes,
        false,
        TierPayouts {
            delay_2h: master.payout_delay_2h,
            delay_3h: master.payout_delay_3h,
            delay_4to5h: master.payout_delay_4to5h,
            delay_6h_or_cancelled: master.payout_delay_6h_or_cancelled,
        },
    );

    flight.delay_minutes = delay_minutes;
    flight.cancelled = false;
    flight.payout_amount = payout;
    flight.status = if payout > 0 {
        FlightPolicyStatus::Claimable as u8
    } else {
        FlightPolicyStatus::NoClaim as u8
    };
    flight.updated_at = Clock::get()?.unix_timestamp;

    Ok(())
}
