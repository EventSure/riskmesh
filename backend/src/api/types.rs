use borsh::BorshSerialize;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub(super) struct HealthResponse {
    pub status: &'static str,
    pub rpc_url: String,
    pub leader_pubkey: String,
}

#[derive(Serialize)]
pub(super) struct MasterAgreementsResponse {
    #[serde(rename = "master_agreements")]
    pub master_agreements: Vec<crate::oracle::program_accounts::MasterAgreementInfo>,
}

#[derive(Serialize)]
pub(super) struct MasterAgreementAccountsResponse {
    pub program_id: String,
    pub count: usize,
    // TODO: response field is consumed outside backend; rename with frontend contract update.
    #[serde(rename = "master_agreement_pubkeys")]
    pub master_agreement_pubkeys: Vec<String>,
}

#[derive(Serialize)]
pub(super) struct FlightPoliciesResponse {
    pub flight_policies: Vec<crate::oracle::program_accounts::FlightPolicyInfo>,
}

#[derive(Serialize)]
pub(super) struct MasterAgreementsTreeResponse {
    pub program_id: String,
    pub count: usize,
    #[serde(rename = "master_agreements")]
    pub master_agreements: Vec<MasterAgreementAccountTree>,
}

#[derive(Serialize)]
pub(super) struct MasterAgreementFlightPoliciesResponse {
    pub program_id: String,
    // TODO: response field is consumed outside backend; rename with frontend contract update.
    #[serde(rename = "master_agreement_pubkey")]
    pub master_agreement_pubkey: String,
    pub count: usize,
    pub flight_policies: Vec<crate::oracle::program_accounts::FlightPolicyInfo>,
}

#[derive(Serialize)]
pub(super) struct MasterAgreementAccountTree {
    // TODO: response field is consumed outside backend; rename with frontend contract update.
    #[serde(rename = "master_agreement_pubkey")]
    pub master_agreement_pubkey: String,
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
    // TODO: response field is consumed outside backend; rename with frontend contract update.
    #[serde(rename = "master_agreement_pubkey")]
    pub master_agreement_pubkey: String,
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
pub(super) struct MasterAgreementsQuery {
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
