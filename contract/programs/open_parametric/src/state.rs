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

// ─── Master/Child Redesign ───────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MasterPolicyStatus {
    Draft = 0,
    PendingConfirm = 1,
    Active = 2,
    Closed = 3,
    Cancelled = 4,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum FlightPolicyStatus {
    Issued = 0,
    AwaitingOracle = 1,
    Claimable = 2,
    Paid = 3,
    NoClaim = 4,
    Expired = 5,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmRole {
    Participant = 0,
    Reinsurer = 1,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MasterParticipantInit {
    pub insurer: Pubkey,
    pub share_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MasterParticipant {
    pub insurer: Pubkey,
    pub share_bps: u16,
    pub confirmed: bool,
    pub pool_wallet: Pubkey,
    pub deposit_wallet: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateMasterPolicyParams {
    pub master_id: u64,
    pub coverage_start_ts: i64,
    pub coverage_end_ts: i64,
    pub premium_per_policy: u64,
    pub payout_delay_2h: u64,
    pub payout_delay_3h: u64,
    pub payout_delay_4to5h: u64,
    pub payout_delay_6h_or_cancelled: u64,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub participants: Vec<MasterParticipantInit>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterWalletParams {
    pub insurer: Pubkey,
    pub pool_wallet: Pubkey,
    pub deposit_wallet: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateFlightPolicyParams {
    pub child_policy_id: u64,
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
}

#[account]
pub struct MasterPolicy {
    pub master_id: u64,
    pub leader: Pubkey,
    pub operator: Pubkey,
    pub currency_mint: Pubkey,
    pub coverage_start_ts: i64,
    pub coverage_end_ts: i64,
    pub premium_per_policy: u64,
    pub payout_delay_2h: u64,
    pub payout_delay_3h: u64,
    pub payout_delay_4to5h: u64,
    pub payout_delay_6h_or_cancelled: u64,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub reinsurer_effective_bps: u16,
    pub reinsurer: Pubkey,
    pub reinsurer_confirmed: bool,
    pub reinsurer_pool_wallet: Pubkey,
    pub reinsurer_deposit_wallet: Pubkey,
    pub leader_deposit_wallet: Pubkey,
    pub participants: Vec<MasterParticipant>,
    pub status: u8,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct FlightPolicy {
    pub child_policy_id: u64,
    pub master: Pubkey,
    pub creator: Pubkey,
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
    pub premium_paid: u64,
    pub delay_minutes: u16,
    pub cancelled: bool,
    pub payout_amount: u64,
    pub status: u8,
    pub premium_distributed: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}
