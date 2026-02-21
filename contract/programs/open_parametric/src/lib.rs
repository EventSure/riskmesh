use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

// TODO: Replace with actual program id after `anchor keys list`
declare_id!("OpenParametric11111111111111111111111111111111");

pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_FRESHNESS_WINDOW_SECS: i64 = 30 * 60; // 30 minutes

#[program]
pub mod open_parametric {
    use super::*;

    pub fn create_policy(ctx: Context<CreatePolicy>, params: CreatePolicyParams) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let uw = &mut ctx.accounts.underwriting;
        let pool = &mut ctx.accounts.risk_pool;
        let registry = &mut ctx.accounts.registry;
        require!(params.active_from < params.active_to, OpenParamError::InvalidTimeWindow);
        require!(params.payout_amount > 0, OpenParamError::InvalidAmount);
        require!(params.delay_threshold_min == DELAY_THRESHOLD_MIN, OpenParamError::InvalidDelayThreshold);
        require!(params.route.len() <= MAX_ROUTE_LEN, OpenParamError::InputTooLong);
        require!(params.flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);

        policy.policy_id = params.policy_id;
        policy.leader = ctx.accounts.leader.key();
        policy.route = params.route;
        policy.flight_no = params.flight_no;
        policy.departure_date = params.departure_date;
        policy.delay_threshold_min = params.delay_threshold_min;
        policy.payout_amount = params.payout_amount;
        policy.currency_mint = ctx.accounts.currency_mint.key();
        policy.oracle_feed = params.oracle_feed;
        policy.state = PolicyState::Draft as u8;
        policy.underwriting = ctx.accounts.underwriting.key();
        policy.pool = ctx.accounts.risk_pool.key();
        policy.created_at = Clock::get()?.unix_timestamp;
        policy.active_from = params.active_from;
        policy.active_to = params.active_to;

        uw.policy = policy.key();
        uw.leader = policy.leader;
        uw.participants = vec![];
        uw.total_ratio = 0;
        uw.status = UnderwritingStatus::Proposed as u8;
        uw.created_at = policy.created_at;

        pool.policy = policy.key();
        pool.currency_mint = ctx.accounts.currency_mint.key();
        pool.vault = Pubkey::default();
        pool.total_escrowed = 0;
        pool.available_balance = 0;
        pool.status = 0;

        registry.policy = policy.key();
        registry.entries = vec![];
        Ok(())
    }

    pub fn open_underwriting(ctx: Context<OpenUnderwriting>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let uw = &mut ctx.accounts.underwriting;
        require!(policy.state == PolicyState::Draft as u8, OpenParamError::InvalidState);
        policy.state = PolicyState::Open as u8;
        uw.status = UnderwritingStatus::Open as u8;
        Ok(())
    }

pub fn accept_share(ctx: Context<AcceptShare>, index: u8) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let uw = &mut ctx.accounts.underwriting;
        require!(policy.state == PolicyState::Open as u8, OpenParamError::InvalidState);

        let i = index as usize;
        require!(i < uw.participants.len(), OpenParamError::NotFound);
        let share = &mut uw.participants[i];
        require!(share.insurer == ctx.accounts.participant.key(), OpenParamError::Unauthorized);
        require!(share.status == ParticipantStatus::Pending as u8, OpenParamError::InvalidState);

        // TODO: transfer SPL tokens into pool vault
        share.status = ParticipantStatus::Accepted as u8;

        let total_ratio: u32 = uw.participants.iter().map(|p| p.ratio_bps as u32).sum();
        require!(total_ratio <= 10000, OpenParamError::InvalidRatio);
        if total_ratio == 10000 {
            uw.status = UnderwritingStatus::Finalized as u8;
            policy.state = PolicyState::Funded as u8;
        }
        Ok(())
    }

    pub fn reject_share(ctx: Context<RejectShare>, index: u8) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let uw = &mut ctx.accounts.underwriting;
        require!(policy.state == PolicyState::Open as u8, OpenParamError::InvalidState);

        let i = index as usize;
        require!(i < uw.participants.len(), OpenParamError::NotFound);
        let share = &mut uw.participants[i];
        require!(share.status == ParticipantStatus::Pending as u8, OpenParamError::InvalidState);
        share.status = ParticipantStatus::Rejected as u8;
        Ok(())
    }

    pub fn activate_policy(ctx: Context<ActivatePolicy>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.state == PolicyState::Funded as u8, OpenParamError::InvalidState);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= policy.active_from, OpenParamError::InvalidTimeWindow);
        policy.state = PolicyState::Active as u8;
        Ok(())
    }

    pub fn check_oracle_and_create_claim(ctx: Context<CheckOracle>, oracle_delay_min: i64, oracle_last_updated: i64, oracle_round: u64) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.state == PolicyState::Active as u8, OpenParamError::InvalidState);
        require!(oracle_delay_min >= 0, OpenParamError::OracleFormat);
        require!(oracle_delay_min % 10 == 0, OpenParamError::OracleFormat);
        let now = Clock::get()?.unix_timestamp;
        require!(now - oracle_last_updated <= ORACLE_FRESHNESS_WINDOW_SECS, OpenParamError::OracleStale);

        if oracle_delay_min >= policy.delay_threshold_min as i64 {
            let claim = &mut ctx.accounts.claim;
            claim.policy = policy.key();
            claim.oracle_round = oracle_round;
            claim.oracle_value = oracle_delay_min;
            claim.verified_at = now;
            claim.approved_by = Pubkey::default();
            claim.status = ClaimStatus::Claimable as u8;
            claim.payout_amount = policy.payout_amount;
            policy.state = PolicyState::Claimable as u8;
        }
        Ok(())
    }

    pub fn approve_claim(ctx: Context<ApproveClaim>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let claim = &mut ctx.accounts.claim;
        require!(policy.state == PolicyState::Claimable as u8, OpenParamError::InvalidState);
        require!(claim.status == ClaimStatus::Claimable as u8, OpenParamError::InvalidState);
        claim.status = ClaimStatus::Approved as u8;
        claim.approved_by = ctx.accounts.leader.key();
        policy.state = PolicyState::Approved as u8;
        Ok(())
    }

    pub fn settle_claim(ctx: Context<SettleClaim>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let claim = &mut ctx.accounts.claim;
        require!(policy.state == PolicyState::Approved as u8, OpenParamError::InvalidState);
        require!(claim.status == ClaimStatus::Approved as u8, OpenParamError::InvalidState);

        // TODO: transfer payout from pool vault to beneficiary escrow
        claim.status = ClaimStatus::Settled as u8;
        policy.state = PolicyState::Settled as u8;
        Ok(())
    }

    pub fn expire_policy(ctx: Context<ExpirePolicy>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.state == PolicyState::Active as u8, OpenParamError::InvalidState);
        let now = Clock::get()?.unix_timestamp;
        require!(now > policy.active_to, OpenParamError::InvalidTimeWindow);
        policy.state = PolicyState::Expired as u8;
        Ok(())
    }

    pub fn refund_after_expiry(ctx: Context<RefundAfterExpiry>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.state == PolicyState::Expired as u8, OpenParamError::InvalidState);
        // TODO: pro-rata refund to participant
        Ok(())
    }

pub fn register_policyholder(ctx: Context<RegisterPolicyholder>, entry: PolicyholderEntryInput) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        require!(ctx.accounts.policy.leader == ctx.accounts.leader.key(), OpenParamError::Unauthorized);
        require!(registry.policy == ctx.accounts.policy.key(), OpenParamError::InvalidInput);
        require!(entry.external_ref.len() <= MAX_EXTERNAL_REF_LEN, OpenParamError::InputTooLong);
        require!(entry.flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);
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
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreatePolicyParams {
    pub policy_id: u64,
    pub route: String,
    pub flight_no: String,
    pub departure_date: i64,
    pub delay_threshold_min: u16,
    pub payout_amount: u64,
    pub oracle_feed: Pubkey,
    pub active_from: i64,
    pub active_to: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PolicyholderEntryInput {
    pub external_ref: String,
    pub policy_id: u64,
    pub flight_no: String,
    pub departure_date: i64,
    pub passenger_count: u16,
    pub premium_paid: u64,
    pub coverage_amount: u64,
}

#[account]
pub struct Policy {
    pub policy_id: u64,
    pub leader: Pubkey,
    pub route: String,
    pub flight_no: String,
    pub departure_date: i64,
    pub delay_threshold_min: u16,
    pub payout_amount: u64,
    pub currency_mint: Pubkey,
    pub oracle_feed: Pubkey,
    pub state: u8,
    pub underwriting: Pubkey,
    pub pool: Pubkey,
    pub created_at: i64,
    pub active_from: i64,
    pub active_to: i64,
}

#[account]
pub struct Underwriting {
    pub policy: Pubkey,
    pub leader: Pubkey,
    pub participants: Vec<ParticipantShare>,
    pub total_ratio: u16,
    pub status: u8,
    pub created_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ParticipantShare {
    pub insurer: Pubkey,
    pub ratio_bps: u16,
    pub status: u8,
    pub escrow: Pubkey,
}

#[account]
pub struct RiskPool {
    pub policy: Pubkey,
    pub currency_mint: Pubkey,
    pub vault: Pubkey,
    pub total_escrowed: u64,
    pub available_balance: u64,
    pub status: u8,
}

#[account]
pub struct Claim {
    pub policy: Pubkey,
    pub oracle_round: u64,
    pub oracle_value: i64,
    pub verified_at: i64,
    pub approved_by: Pubkey,
    pub status: u8,
    pub payout_amount: u64,
}

#[account]
pub struct PolicyholderRegistry {
    pub policy: Pubkey,
    pub entries: Vec<PolicyholderEntry>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PolicyholderEntry {
    pub external_ref: String,
    pub policy_id: u64,
    pub flight_no: String,
    pub departure_date: i64,
    pub passenger_count: u16,
    pub premium_paid: u64,
    pub coverage_amount: u64,
    pub timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PolicyState {
    Draft = 0,
    Open = 1,
    Funded = 2,
    Active = 3,
    Claimable = 4,
    Approved = 5,
    Settled = 6,
    Expired = 7,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum UnderwritingStatus {
    Proposed = 0,
    Open = 1,
    Finalized = 2,
    Failed = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ClaimStatus {
    None = 0,
    PendingOracle = 1,
    Claimable = 2,
    Approved = 3,
    Settled = 4,
    Rejected = 5,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ParticipantStatus {
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
}

#[derive(Accounts)]
pub struct CreatePolicy<'info> {
    #[account(mut)]
    pub leader: Signer<'info>,
    pub currency_mint: Account<'info, Mint>,
    #[account(init, payer = leader, space = POLICY_SPACE)]
    pub policy: Account<'info, Policy>,
    #[account(init, payer = leader, space = UNDERWRITING_SPACE)]
    pub underwriting: Account<'info, Underwriting>,
    #[account(init, payer = leader, space = RISK_POOL_SPACE)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(init, payer = leader, space = REGISTRY_SPACE)]
    pub registry: Account<'info, PolicyholderRegistry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenUnderwriting<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut)]
    pub underwriting: Account<'info, Underwriting>,
}

#[derive(Accounts)]
pub struct AcceptShare<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut)]
    pub underwriting: Account<'info, Underwriting>,
    #[account(mut)]
    pub risk_pool: Account<'info, RiskPool>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RejectShare<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut)]
    pub underwriting: Account<'info, Underwriting>,
}

#[derive(Accounts)]
pub struct ActivatePolicy<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckOracle<'info> {
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(init, payer = payer, space = CLAIM_SPACE)]
    pub claim: Account<'info, Claim>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveClaim<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut)]
    pub claim: Account<'info, Claim>,
}

#[derive(Accounts)]
pub struct SettleClaim<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut)]
    pub claim: Account<'info, Claim>,
    #[account(mut)]
    pub risk_pool: Account<'info, RiskPool>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExpirePolicy<'info> {
    #[account(mut)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct RefundAfterExpiry<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut)]
    pub risk_pool: Account<'info, RiskPool>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RegisterPolicyholder<'info> {
    #[account(mut)]
    pub registry: Account<'info, PolicyholderRegistry>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
}

#[error_code]
pub enum OpenParamError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid state for this instruction")]
    InvalidState,
    #[msg("Invalid ratio sum")]
    InvalidRatio,
    #[msg("Already exists")]
    AlreadyExists,
    #[msg("Not found")]
    NotFound,
    #[msg("Insufficient escrow")]
    InsufficientEscrow,
    #[msg("Pool has insufficient balance")]
    PoolInsufficient,
    #[msg("Oracle value is stale")]
    OracleStale,
    #[msg("Oracle value format is invalid")]
    OracleFormat,
    #[msg("Invalid time window")]
    InvalidTimeWindow,
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid delay threshold")]
    InvalidDelayThreshold,
    #[msg("Input too long")]
    InputTooLong,
}

pub const MAX_ROUTE_LEN: usize = 16;
pub const MAX_FLIGHT_NO_LEN: usize = 16;
pub const MAX_EXTERNAL_REF_LEN: usize = 32;
pub const POLICY_SPACE: usize = 267;
pub const UNDERWRITING_SPACE: usize = 1159;
pub const RISK_POOL_SPACE: usize = 121;
pub const CLAIM_SPACE: usize = 105;
pub const REGISTRY_SPACE: usize = 13616;
