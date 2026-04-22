use anchor_lang::prelude::*;

// ─── Enums ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MasterAgreementStatus {
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

// ─── Input / Helper Structs ───────────────────────────────────────────────────

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
pub struct CreateMasterAgreementParams {
    pub master_id: u64,
    pub coverage_start_ts: i64,
    pub coverage_end_ts: i64,
    pub premium_per_policy: u64,
    pub payout_delay_2h: u64,
    pub payout_delay_3h: u64,
    pub payout_delay_4to5h: u64,
    pub payout_delay_6h_or_cancelled: u64,
    pub leader_share_bps: u16,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub participants: Vec<MasterParticipantInit>,
    pub oracle_feed: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateFlightPolicyParams {
    pub child_policy_id: u64,
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
}

// ─── Account Structs ──────────────────────────────────────────────────────────

#[account]
pub struct MasterAgreement {
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
    pub leader_share_bps: u16,
    pub ceded_ratio_bps: u16,
    pub reins_commission_bps: u16,
    pub reinsurer_effective_bps: u16,
    pub reinsurer: Option<Pubkey>,
    pub reinsurer_confirmed: bool,
    pub reinsurer_pool_wallet: Option<Pubkey>,
    pub reinsurer_deposit_wallet: Option<Pubkey>,
    pub leader_pool_wallet: Pubkey,
    pub leader_deposit_wallet: Pubkey,
    pub participants: Vec<MasterParticipant>,
    pub oracle_feed: Pubkey,
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
