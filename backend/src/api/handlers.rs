use axum::{
    extract::{Path, State},
    Json,
};

use crate::solana::client::SolanaClient;

use super::{
    error::ApiError,
    service,
    state::AppState,
    types::{
        CreateFlightPolicyRequest, CreateFlightPolicyResponse, FlightPoliciesResponse,
        HealthResponse, MasterPoliciesResponse, MasterPoliciesTreeResponse,
    },
};

pub(super) async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(service::health_response(&state.config))
}

pub(super) async fn get_master_policies(
    State(state): State<AppState>,
) -> Result<Json<MasterPoliciesResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    service::list_master_policies(&client, &state.config)
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_flight_policies(
    State(state): State<AppState>,
) -> Result<Json<FlightPoliciesResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    service::list_flight_policies(&client, &state.config)
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_master_policies_tree(
    State(state): State<AppState>,
) -> Result<Json<MasterPoliciesTreeResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    service::list_master_policies_tree(&client, &state.config)
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn post_flight_policy(
    State(state): State<AppState>,
    Path(master_policy_pubkey): Path<String>,
    Json(req): Json<CreateFlightPolicyRequest>,
) -> Result<Json<CreateFlightPolicyResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    let master_policy_pubkey = master_policy_pubkey
        .parse()
        .map_err(|e| ApiError(anyhow::anyhow!("master_policy_pubkey 주소 파싱 실패: {e}")))?;

    service::create_flight_policy(&client, &state.config, &master_policy_pubkey, req)
        .map(Json)
        .map_err(ApiError)
}
