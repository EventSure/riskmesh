use borsh::BorshSerialize;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub(super) struct HealthResponse {
    pub status: &'static str,
    pub rpc_url: String,
    pub leader_pubkey: String,
}

#[derive(Serialize)]
pub(super) struct MasterPoliciesResponse {
    pub master_policies: Vec<crate::oracle::program_accounts::MasterPolicyInfo>,
}

#[derive(Serialize)]
pub(super) struct MasterPolicyAccountsResponse {
    pub program_id: String,
    pub count: usize,
    pub master_policy_pubkeys: Vec<String>,
}

#[derive(Serialize)]
pub(super) struct FlightPoliciesResponse {
    pub flight_policies: Vec<crate::oracle::program_accounts::FlightPolicyInfo>,
}

#[derive(Serialize)]
pub(super) struct MasterPoliciesTreeResponse {
    pub program_id: String,
    pub count: usize,
    pub master_policies: Vec<MasterPolicyAccountTree>,
}

#[derive(Serialize)]
pub(super) struct MasterFlightPoliciesResponse {
    pub program_id: String,
    pub master_policy_pubkey: String,
    pub count: usize,
    pub flight_policies: Vec<crate::oracle::program_accounts::FlightPolicyInfo>,
}

#[derive(Serialize)]
pub(super) struct MasterPolicyAccountTree {
    pub master_policy_pubkey: String,
    pub flight_policy_pubkeys: Vec<String>,
}

#[derive(Deserialize)]
pub(super) struct CreateFlightPolicyRequest {
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
}

#[derive(Serialize)]
pub(super) struct CreateFlightPolicyResponse {
    pub program_id: String,
    pub master_policy_pubkey: String,
    pub child_policy_id: u64,
    pub flight_policy_pubkey: String,
    pub tx_signature: String,
}

#[derive(BorshSerialize)]
pub(super) struct CreateFlightPolicyParamsWire {
    pub child_policy_id: u64,
    pub subscriber_ref: String,
    pub flight_no: String,
    pub route: String,
    pub departure_ts: i64,
}

#[derive(Deserialize, Default)]
pub(super) struct MasterPoliciesQuery {
    pub leader: Option<String>,
    /// Filter by any role (leader, participant, or reinsurer)
    pub wallet: Option<String>,
}

#[derive(Deserialize, Default)]
pub(super) struct FlightPoliciesQuery {
    pub master: Option<String>,
    pub status: Option<u8>,
}

#[derive(Deserialize, Default, Clone)]
pub(super) struct EventsQuery {
    pub master: Option<String>,
}
