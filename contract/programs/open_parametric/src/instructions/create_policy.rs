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

    require!(active_from < active_to, OpenParamError::InvalidTimeWindow);
    require!(payout_amount > 0, OpenParamError::InvalidAmount);
    require!(delay_threshold_min == DELAY_THRESHOLD_MIN, OpenParamError::InvalidDelayThreshold);
    require!(route.len() <= MAX_ROUTE_LEN, OpenParamError::InputTooLong);
    require!(flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);
    require!(participants.len() <= MAX_PARTICIPANTS, OpenParamError::InvalidInput);

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

    uw.policy = policy.key();
    uw.leader = policy.leader;
    let total_ratio: u32 = participants.iter().map(|p| p.ratio_bps as u32).sum();
    require!(total_ratio == 10000, OpenParamError::InvalidRatio);
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
    uw.total_ratio = total_ratio as u16;
    uw.status = UnderwritingStatus::Proposed as u8;
    uw.created_at = policy.created_at;
    uw.bump = ctx.bumps.underwriting;

    pool.policy = policy.key();
    pool.currency_mint = ctx.accounts.currency_mint.key();
    pool.vault = ctx.accounts.vault.key();
    pool.total_escrowed = 0;
    pool.available_balance = 0;
    pool.status = 0;
    pool.bump = ctx.bumps.risk_pool;

    registry.policy = policy.key();
    registry.entries = vec![];
    registry.bump = ctx.bumps.registry;

    Ok(())
}
