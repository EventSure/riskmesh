use anchor_lang::prelude::*;

// ─── Enums ───────────────────────────────────────────────────────────────────

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

// ─── Input / Helper Structs ───────────────────────────────────────────────────

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ParticipantShare {
    pub insurer: Pubkey,
    pub ratio_bps: u16,
    pub status: u8,
    pub escrow: Pubkey,
    pub escrowed_amount: u64,
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

// ─── Account Structs ──────────────────────────────────────────────────────────

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
