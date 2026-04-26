use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, Sse},
    Json,
};
use futures_util::Stream;
use std::convert::Infallible;

use crate::solana::client::SolanaClient;
use solana_sdk::pubkey::Pubkey;

use super::{
    error::ApiError,
    service,
    state::AppState,
    types::{
        CreateFlightPolicyRequest, CreateFlightPolicyResponse, EventsQuery, FlightPoliciesQuery,
        FlightPoliciesResponse, HealthResponse, MasterAgreementAccountsResponse,
        MasterAgreementDisplayNamesResponse, MasterAgreementFlightPoliciesResponse,
        MasterAgreementsQuery, MasterAgreementsResponse, MasterAgreementsTreeResponse,
        PutMasterAgreementDisplayNamesRequest,
    },
};

pub(super) async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(service::health_response(&state.config))
}

pub(super) async fn get_master_agreements(
    State(state): State<AppState>,
    Query(query): Query<MasterAgreementsQuery>,
) -> Result<Json<MasterAgreementsResponse>, ApiError> {
    service::list_master_agreements(&*state.repository, &query)
        .await
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_master_agreement_accounts(
    State(state): State<AppState>,
) -> Result<Json<MasterAgreementAccountsResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    service::list_master_agreement_accounts(&client, &state.config)
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_master_agreement(
    State(state): State<AppState>,
    Path(master_agreement_pubkey): Path<String>,
) -> Result<Json<crate::oracle::program_accounts::MasterAgreementInfo>, ApiError> {
    master_agreement_pubkey.parse::<Pubkey>().map_err(|e| {
        ApiError(anyhow::anyhow!(
            "master_agreement_pubkey 주소 파싱 실패: {e}"
        ))
    })?;

    service::get_master_agreement(&*state.repository, &master_agreement_pubkey)
        .await
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_master_agreement_display_names(
    State(state): State<AppState>,
    Path(master_policy_pubkey): Path<String>,
) -> Result<Json<MasterAgreementDisplayNamesResponse>, ApiError> {
    let master_policy_pubkey = master_policy_pubkey
        .parse::<Pubkey>()
        .map_err(|e| ApiError(anyhow::anyhow!("master_policy_pubkey 주소 파싱 실패: {e}")))?;

    service::get_master_agreement_display_names(
        &*state.repository,
        &master_policy_pubkey.to_string(),
    )
    .await
    .map(Json)
    .map_err(ApiError)
}

pub(super) async fn put_master_agreement_display_names(
    State(state): State<AppState>,
    Path(master_policy_pubkey): Path<String>,
    Json(req): Json<PutMasterAgreementDisplayNamesRequest>,
) -> Result<Json<MasterAgreementDisplayNamesResponse>, ApiError> {
    let master_policy_pubkey = master_policy_pubkey
        .parse::<Pubkey>()
        .map_err(|e| ApiError(anyhow::anyhow!("master_policy_pubkey 주소 파싱 실패: {e}")))?;

    service::put_master_agreement_display_names(
        &*state.repository,
        &master_policy_pubkey.to_string(),
        req,
    )
    .await
    .map(Json)
    .map_err(ApiError)
}

pub(super) async fn post_db_test(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    service::create_db_test_document(&*state.repository)
        .await
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_events(
    State(state): State<AppState>,
    Query(query): Query<EventsQuery>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    service::stream_events(state.event_bus, query)
}

pub(super) async fn get_flight_policies(
    State(state): State<AppState>,
    Query(query): Query<FlightPoliciesQuery>,
) -> Result<Json<FlightPoliciesResponse>, ApiError> {
    service::list_flight_policies(&*state.repository, &query)
        .await
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_flight_policy(
    State(state): State<AppState>,
    Path(flight_policy_pubkey): Path<String>,
) -> Result<Json<crate::oracle::program_accounts::FlightPolicyInfo>, ApiError> {
    flight_policy_pubkey
        .parse::<Pubkey>()
        .map_err(|e| ApiError(anyhow::anyhow!("flight_policy_pubkey 주소 파싱 실패: {e}")))?;

    service::get_flight_policy(&*state.repository, &flight_policy_pubkey)
        .await
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_master_agreements_tree(
    State(state): State<AppState>,
) -> Result<Json<MasterAgreementsTreeResponse>, ApiError> {
    service::list_master_agreements_tree(&*state.repository, &state.config)
        .await
        .map(Json)
        .map_err(ApiError)
}

pub(super) async fn get_flight_policies_by_master_agreement(
    State(state): State<AppState>,
    Path(master_agreement_pubkey): Path<String>,
) -> Result<Json<MasterAgreementFlightPoliciesResponse>, ApiError> {
    let master_agreement_pubkey = master_agreement_pubkey.parse().map_err(|e| {
        ApiError(anyhow::anyhow!(
            "master_agreement_pubkey 주소 파싱 실패: {e}"
        ))
    })?;

    service::list_flight_policies_by_master_agreement(
        &*state.repository,
        &state.config,
        &master_agreement_pubkey,
    )
    .await
    .map(Json)
    .map_err(ApiError)
}

pub(super) async fn post_flight_policy(
    State(state): State<AppState>,
    Path(master_agreement_pubkey): Path<String>,
    Json(req): Json<CreateFlightPolicyRequest>,
) -> Result<Json<CreateFlightPolicyResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    let master_agreement_pubkey = master_agreement_pubkey.parse().map_err(|e| {
        ApiError(anyhow::anyhow!(
            "master_agreement_pubkey 주소 파싱 실패: {e}"
        ))
    })?;

    service::create_flight_policy(&client, &state.config, &master_agreement_pubkey, req)
        .map(Json)
        .map_err(ApiError)
}
