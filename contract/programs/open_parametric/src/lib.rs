use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use switchboard_on_demand::{
    default_queue,
    SwitchboardQuote,
    SwitchboardQuoteExt,
    SlotHashes,
    Instructions,
    QuoteVerifier,
};

// TODO: Replace with actual program id after `anchor keys list`
declare_id!("OpenParametric11111111111111111111111111111111");

pub const DELAY_THRESHOLD_MIN: u16 = 120;
pub const ORACLE_MAX_STALENESS_SLOTS: u64 = 150; // approx 60-90s depending on cluster
pub const MAX_PARTICIPANTS: usize = 16;
pub const MAX_POLICYHOLDERS: usize = 128;

#[program]
pub mod open_parametric {
    use super::*;

    pub fn create_policy(ctx: Context<CreatePolicy>, params: CreatePolicyParams) -> Result<()> {
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
        policy.underwriting = ctx.accounts.underwriting.key();
        policy.pool = ctx.accounts.risk_pool.key();
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

    pub fn open_underwriting(ctx: Context<OpenUnderwriting>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let uw = &mut ctx.accounts.underwriting;
        require!(policy.state == PolicyState::Draft as u8, OpenParamError::InvalidState);
        require!(policy.underwriting == uw.key(), OpenParamError::InvalidInput);
        policy.state = PolicyState::Open as u8;
        uw.status = UnderwritingStatus::Open as u8;
        Ok(())
    }

    pub fn accept_share(ctx: Context<AcceptShare>, index: u8, deposit_amount: u64) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let uw = &mut ctx.accounts.underwriting;
        require!(policy.state == PolicyState::Open as u8, OpenParamError::InvalidState);
        require!(policy.underwriting == uw.key(), OpenParamError::InvalidInput);
        require!(policy.pool == ctx.accounts.risk_pool.key(), OpenParamError::InvalidInput);
        require!(ctx.accounts.vault.key() == ctx.accounts.risk_pool.vault, OpenParamError::InvalidInput);
        require!(ctx.accounts.participant_token.mint == policy.currency_mint, OpenParamError::InvalidInput);
        require!(ctx.accounts.vault.mint == policy.currency_mint, OpenParamError::InvalidInput);
        require!(ctx.accounts.participant_token.owner == ctx.accounts.participant.key(), OpenParamError::Unauthorized);

        let i = index as usize;
        require!(i < uw.participants.len(), OpenParamError::NotFound);
        let share = &mut uw.participants[i];
        require!(share.insurer == ctx.accounts.participant.key(), OpenParamError::Unauthorized);
        require!(share.status == ParticipantStatus::Pending as u8, OpenParamError::InvalidState);
        require!(deposit_amount > 0, OpenParamError::InvalidAmount);

        let required = policy
            .payout_amount
            .checked_mul(share.ratio_bps as u64)
            .unwrap()
            / 10000;
        require!(deposit_amount >= required, OpenParamError::InsufficientEscrow);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.participant_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.participant.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, deposit_amount)?;

        share.status = ParticipantStatus::Accepted as u8;
        share.escrow = ctx.accounts.participant_token.key();
        share.escrowed_amount = deposit_amount;
        ctx.accounts.risk_pool.total_escrowed = ctx.accounts.risk_pool.total_escrowed.checked_add(deposit_amount).unwrap();
        ctx.accounts.risk_pool.available_balance = ctx.accounts.risk_pool.available_balance.checked_add(deposit_amount).unwrap();

        let accepted_sum: u32 = uw
            .participants
            .iter()
            .filter(|p| p.status == ParticipantStatus::Accepted as u8)
            .map(|p| p.ratio_bps as u32)
            .sum();
        require!(accepted_sum <= 10000, OpenParamError::InvalidRatio);
        if accepted_sum == 10000 {
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

    pub fn check_oracle_and_create_claim(ctx: Context<CheckOracle>, oracle_round: u64) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.state == PolicyState::Active as u8, OpenParamError::InvalidState);
        require!(ctx.accounts.oracle_feed.key() == policy.oracle_feed, OpenParamError::InvalidInput);

        let quote = &ctx.accounts.quote_account;
        let queue = default_queue();
        let canonical = quote.canonical_key(&queue);
        require!(ctx.accounts.oracle_feed.key() == canonical, OpenParamError::InvalidInput);

        let (slot_hashes, instructions) = ctx.accounts.sysvars.get()?;
        QuoteVerifier::new()
            .queue(&queue)
            .slothash_sysvar(&slot_hashes)
            .ix_sysvar(&instructions)
            .clock_slot(Clock::get()?.slot)
            .max_age(ORACLE_MAX_STALENESS_SLOTS as i64)
            .verify_instruction_at(0)
            .map_err(|_| OpenParamError::OracleStale)?;

        let current_slot = Clock::get()?.slot;
        let quote_slot = quote.slot();
        let staleness = current_slot.saturating_sub(quote_slot);
        require!(staleness <= ORACLE_MAX_STALENESS_SLOTS, OpenParamError::OracleStale);

        require!(!quote.feeds.is_empty(), OpenParamError::OracleFormat);
        let feed = &quote.feeds[0];
        let value_i128 = feed.value();
        require!(value_i128 >= 0, OpenParamError::OracleFormat);
        require!(value_i128 <= i64::MAX as i128, OpenParamError::OracleFormat);
        let oracle_delay_min = value_i128 as i64;
        require!(oracle_delay_min % 10 == 0, OpenParamError::OracleFormat);

        if oracle_delay_min >= policy.delay_threshold_min as i64 {
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
        require!(claim.payout_amount <= ctx.accounts.risk_pool.available_balance, OpenParamError::PoolInsufficient);
        require!(ctx.accounts.vault.key() == ctx.accounts.risk_pool.vault, OpenParamError::InvalidInput);
        require!(ctx.accounts.beneficiary_token.mint == policy.currency_mint, OpenParamError::InvalidInput);

        let seeds = &[
            b"pool".as_ref(),
            policy.key().as_ref(),
            &[ctx.accounts.risk_pool.bump],
        ];
        let signer = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.beneficiary_token.to_account_info(),
                authority: ctx.accounts.risk_pool.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, claim.payout_amount)?;
        ctx.accounts.risk_pool.available_balance = ctx.accounts.risk_pool.available_balance.checked_sub(claim.payout_amount).unwrap();

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

    pub fn refund_after_expiry(ctx: Context<RefundAfterExpiry>, share_index: u8) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.state == PolicyState::Expired as u8, OpenParamError::InvalidState);
        let uw = &mut ctx.accounts.underwriting;
        let index = share_index as usize;
        require!(index < uw.participants.len(), OpenParamError::NotFound);
        let share = &mut uw.participants[index];
        require!(share.insurer == ctx.accounts.participant.key(), OpenParamError::Unauthorized);
        require!(share.status == ParticipantStatus::Accepted as u8, OpenParamError::InvalidState);
        require!(share.escrowed_amount > 0, OpenParamError::InsufficientEscrow);
        require!(ctx.accounts.vault.key() == ctx.accounts.risk_pool.vault, OpenParamError::InvalidInput);
        require!(ctx.accounts.participant_token.mint == policy.currency_mint, OpenParamError::InvalidInput);

        let seeds = &[
            b"pool".as_ref(),
            policy.key().as_ref(),
            &[ctx.accounts.risk_pool.bump],
        ];
        let signer = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.participant_token.to_account_info(),
                authority: ctx.accounts.risk_pool.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, share.escrowed_amount)?;
        ctx.accounts.risk_pool.available_balance = ctx.accounts.risk_pool.available_balance.checked_sub(share.escrowed_amount).unwrap();
        share.escrowed_amount = 0;
        Ok(())
    }

    pub fn register_policyholder(ctx: Context<RegisterPolicyholder>, entry: PolicyholderEntryInput) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        require!(ctx.accounts.policy.leader == ctx.accounts.leader.key(), OpenParamError::Unauthorized);
        require!(registry.policy == ctx.accounts.policy.key(), OpenParamError::InvalidInput);
        require!(entry.external_ref.len() <= MAX_EXTERNAL_REF_LEN, OpenParamError::InputTooLong);
        require!(entry.flight_no.len() <= MAX_FLIGHT_NO_LEN, OpenParamError::InputTooLong);
        require!(registry.entries.len() < MAX_POLICYHOLDERS, OpenParamError::InvalidInput);
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
    pub participants: Vec<ParticipantInit>,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ParticipantInit {
    pub insurer: Pubkey,
    pub ratio_bps: u16,
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
    pub bump: u8,
}

#[account]
pub struct Underwriting {
    pub policy: Pubkey,
    pub leader: Pubkey,
    pub participants: Vec<ParticipantShare>,
    pub total_ratio: u16,
    pub status: u8,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ParticipantShare {
    pub insurer: Pubkey,
    pub ratio_bps: u16,
    pub status: u8,
    pub escrow: Pubkey,
    pub escrowed_amount: u64,
}

#[account]
pub struct RiskPool {
    pub policy: Pubkey,
    pub currency_mint: Pubkey,
    pub vault: Pubkey,
    pub total_escrowed: u64,
    pub available_balance: u64,
    pub status: u8,
    pub bump: u8,
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
    pub bump: u8,
}

#[account]
pub struct PolicyholderRegistry {
    pub policy: Pubkey,
    pub entries: Vec<PolicyholderEntry>,
    pub bump: u8,
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

#[derive(Accounts)]
pub struct OpenUnderwriting<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
}

#[derive(Accounts)]
pub struct AcceptShare<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
    #[account(mut, seeds = [b"pool", policy.key().as_ref()], bump = risk_pool.bump)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(mut)]
    pub participant_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RejectShare<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
}

#[derive(Accounts)]
pub struct ActivatePolicy<'info> {
    #[account(mut, has_one = leader)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
}

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
    /// CHECK: address validated against Switchboard canonical key
    pub oracle_feed: UncheckedAccount<'info>,
    #[account(address = oracle_feed.key())]
    pub quote_account: Box<Account<'info, SwitchboardQuote>>,
    pub sysvars: Sysvars<'info>,
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
    #[account(mut, seeds = [b"pool", policy.key().as_ref()], bump = risk_pool.bump)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub beneficiary_token: Account<'info, TokenAccount>,
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
    #[account(mut, seeds = [b"pool", policy.key().as_ref()], bump = risk_pool.bump)]
    pub risk_pool: Account<'info, RiskPool>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub participant_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"underwriting", policy.key().as_ref()], bump = underwriting.bump)]
    pub underwriting: Account<'info, Underwriting>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RegisterPolicyholder<'info> {
    #[account(mut, seeds = [b"registry", policy.key().as_ref()], bump = registry.bump)]
    pub registry: Account<'info, PolicyholderRegistry>,
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    pub leader: Signer<'info>,
}

#[derive(Accounts)]
pub struct Sysvars<'info> {
    /// CHECK: required by SwitchboardQuote verification
    pub slot_hashes: UncheckedAccount<'info>,
    /// CHECK: required by SwitchboardQuote verification
    pub instructions: UncheckedAccount<'info>,
}

impl<'info> Sysvars<'info> {
    pub fn get(&self) -> Result<(SlotHashes, Instructions)> {
        let slot_hashes = SlotHashes::new(&self.slot_hashes.to_account_info())?;
        let instructions = Instructions::new(&self.instructions.to_account_info())?;
        Ok((slot_hashes, instructions))
    }
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
pub const POLICY_SPACE: usize = 260;
pub const UNDERWRITING_SPACE: usize = 1292;
pub const RISK_POOL_SPACE: usize = 122;
pub const CLAIM_SPACE: usize = 106;
pub const REGISTRY_SPACE: usize = 13000;
