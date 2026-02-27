use anchor_lang::prelude::*;
use switchboard_on_demand::{default_queue, Instructions, QuoteVerifier, SlotHashes};

use crate::constants::*;
use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(oracle_round: u64)]
pub struct CheckOracle<'info> {
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(
        init,
        payer = payer,
        space = CLAIM_SPACE,
        seeds = [b"claim", policy.key().as_ref(), &oracle_round.to_le_bytes()],
        bump
    )]
    pub claim: Account<'info, Claim>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: oracle feed address is validated against policy.oracle_feed
    pub oracle_feed: UncheckedAccount<'info>,
    /// CHECK: Switchboard oracle queue; key validated against default_queue()
    #[account(address = default_queue())]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: slot hashes sysvar; validated by SlotHashes sysvar trait
    pub slot_hashes: Sysvar<'info, SlotHashes>,
    /// CHECK: instructions sysvar; validated by Instructions sysvar trait
    pub instructions: Sysvar<'info, Instructions>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CheckOracle>, oracle_round: u64) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    // 오라클 체크는 Active 상태의 정책만 처리한다.
    require!(policy.state == PolicyState::Active as u8, OpenParamError::InvalidState);
    require!(ctx.accounts.oracle_feed.key() == policy.oracle_feed, OpenParamError::InvalidInput);

    let oracle_quote = QuoteVerifier::new()
        .queue(&ctx.accounts.queue.to_account_info())
        .slothash_sysvar(&ctx.accounts.slot_hashes.to_account_info())
        .ix_sysvar(&ctx.accounts.instructions.to_account_info())
        .clock_slot(Clock::get()?.slot)
        .max_age(ORACLE_MAX_STALENESS_SLOTS)
        .verify_instruction_at(0)
        .map_err(|_| OpenParamError::OracleStale)?;

    // 스테일 데이터(허용 슬롯 초과)는 즉시 거절한다.
    let current_slot = Clock::get()?.slot;
    let staleness = current_slot.saturating_sub(oracle_quote.slot());
    require!(staleness <= ORACLE_MAX_STALENESS_SLOTS, OpenParamError::OracleStale);

    // 피드 값 형식을 검증한 뒤 지연 분(minutes) 값을 읽는다.
    let feeds = oracle_quote.feeds();
    require!(!feeds.is_empty(), OpenParamError::OracleFormat);
    let feed = &feeds[0];

    // 오라클 값은 "분 단위 정수"만 허용한다(scale=0, 음수 불가, 10분 단위).
    let decimal_value = feed.value();
    require!(decimal_value.scale() == 0, OpenParamError::OracleFormat);
    let mantissa = decimal_value.mantissa();
    require!(mantissa >= 0, OpenParamError::OracleFormat);
    require!(mantissa <= i64::MAX as i128, OpenParamError::OracleFormat);
    let oracle_delay_min = mantissa as i64;
    require!(oracle_delay_min % 10 == 0, OpenParamError::OracleFormat);

    if oracle_delay_min >= policy.delay_threshold_min as i64 {
        // 임계치 이상이면 Claim 계정을 생성/기록하고 정책 상태를 Claimable로 바꾼다.
        let claim = &mut ctx.accounts.claim;
        claim.policy = policy.key();
        claim.oracle_round = oracle_round;
        claim.oracle_value = oracle_delay_min;
        claim.verified_at = Clock::get()?.unix_timestamp;
        claim.approved_by = Pubkey::default();
        claim.status = ClaimStatus::Claimable as u8;
        claim.payout_amount = policy.payout_amount;
        claim.bump = ctx.bumps.claim;
        policy.state = PolicyState::Claimable as u8;
    }

    Ok(())
}
