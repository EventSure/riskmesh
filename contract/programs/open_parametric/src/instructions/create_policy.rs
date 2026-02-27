use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::OpenParamError;
use crate::state::*;

#[derive(Accounts)]
#[instruction(params: CreatePolicyParams)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub leader: Signer<'info>,
    pub currency_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = leader,
        space = POLICY_SPACE,
        seeds = [b"policy", leader.key().as_ref(), &params.policy_id.to_le_bytes()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    #[account(
        init,
        payer = leader,
        space = UNDERWRITING_SPACE,
        seeds = [b"underwriting", policy.key().as_ref()],
        bump
    )]
    pub underwriting: Account<'info, Underwriting>,
    #[account(
        init,
        payer = leader,
        space = RISK_POOL_SPACE,
        seeds = [b"pool", policy.key().as_ref()],
        bump
    )]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(
        init,
        payer = leader,
        space = REGISTRY_SPACE,
        seeds = [b"registry", policy.key().as_ref()],
        bump
    )]
    pub registry: Account<'info, PolicyholderRegistry>,
    #[account(
        init,
        payer = leader,
        associated_token::mint = currency_mint,
        associated_token::authority = risk_pool
    )]
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CreatePolicy>, params: CreatePolicyParams) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let uw = &mut ctx.accounts.underwriting;
    let pool = &mut ctx.accounts.risk_pool;
    let registry = &mut ctx.accounts.registry;
    let CreatePolicyParams {
        policy_id,
        route,
        flight_no,
        departure_date,
        delay_threshold_min,
        payout_amount,
        oracle_feed,
        active_from,
        active_to,
        participants,
    } = params;

    // 정책 생성 입력 검증(기간/금액/지연 임계치/문자열 길이/참여자 지분).
    require!(active_from < active_to, OpenParamError::InvalidTimeWindow);
    require!(payout_amount > 0, OpenParamError::InvalidAmount);
    require!(delay_threshold_min == DELAY_THRESHOLD_MIN, OpenParamError::InvalidDelayThreshold);
    require!(route.len() <= MAX_ROUTE_LEN, OpenParamError::InputTooLong);
    require!(flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);
    let total_ratio = validate_policy_participants(&participants)?;

    // Policy 본문 필드를 초기화한다.
    policy.policy_id = policy_id;
    policy.leader = ctx.accounts.leader.key();
    policy.route = route;
    policy.flight_no = flight_no;
    policy.departure_date = departure_date;
    policy.delay_threshold_min = delay_threshold_min;
    policy.payout_amount = payout_amount;
    policy.currency_mint = ctx.accounts.currency_mint.key();
    policy.oracle_feed = oracle_feed;
    policy.state = PolicyState::Draft as u8;
    policy.underwriting = uw.key();
    policy.pool = pool.key();
    policy.created_at = Clock::get()?.unix_timestamp;
    policy.active_from = active_from;
    policy.active_to = active_to;
    policy.bump = ctx.bumps.policy;

    // Underwriting은 참여자 지분과 초기 상태(Proposed)를 저장한다.
    uw.policy = policy.key();
    uw.leader = policy.leader;
    uw.participants = participants
        .into_iter()
        .map(|p| ParticipantShare {
            insurer: p.insurer,
            ratio_bps: p.ratio_bps,
            status: ParticipantStatus::Pending as u8,
            escrow: Pubkey::default(),
            escrowed_amount: 0,
        })
        .collect();
    uw.total_ratio = total_ratio;
    uw.status = UnderwritingStatus::Proposed as u8;
    uw.created_at = policy.created_at;
    uw.bump = ctx.bumps.underwriting;

    // RiskPool은 금고(vault) 기준으로 잔액 상태를 0에서 시작한다.
    pool.policy = policy.key();
    pool.currency_mint = ctx.accounts.currency_mint.key();
    pool.vault = ctx.accounts.vault.key();
    pool.total_escrowed = 0;
    pool.available_balance = 0;
    pool.status = 0;
    pool.bump = ctx.bumps.risk_pool;

    // Registry는 빈 엔트리로 시작한다.
    registry.policy = policy.key();
    registry.entries = vec![];
    registry.bump = ctx.bumps.registry;

    Ok(())
}

pub(crate) fn validate_policy_participants(
    participants: &[ParticipantInit],
) -> std::result::Result<u16, OpenParamError> {
    // 참여자 지분 총합은 반드시 10000bps여야 한다.
    if participants.len() > MAX_PARTICIPANTS {
        return Err(OpenParamError::InvalidInput);
    }

    let mut total_ratio: u32 = 0;
    for p in participants {
        total_ratio = total_ratio
            .checked_add(p.ratio_bps as u32)
            .ok_or(OpenParamError::MathOverflow)?;
    }
    if total_ratio != 10_000 {
        return Err(OpenParamError::InvalidRatio);
    }
    u16::try_from(total_ratio).map_err(|_| OpenParamError::MathOverflow)
}
