use std::{net::SocketAddr, sync::Arc};

use anyhow::{Context, Result};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;

use crate::{
    config::Config,
    oracle::program_accounts::{scan_flight_policies, scan_master_policies},
    solana::client::SolanaClient,
};

#[derive(Clone)]
struct AppState {
    config: Arc<Config>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
    rpc_url: String,
    leader_pubkey: String,
}

#[derive(Serialize)]
struct MasterPoliciesResponse {
    program_id: String,
    count: usize,
    master_policies: Vec<crate::oracle::program_accounts::MasterPolicyInfo>,
}

#[derive(Serialize)]
struct FlightPoliciesResponse {
    program_id: String,
    count: usize,
    flight_policies: Vec<crate::oracle::program_accounts::FlightPolicyInfo>,
}

#[derive(Serialize)]
struct MasterPoliciesTreeResponse {
    program_id: String,
    count: usize,
    master_policies: Vec<MasterPolicyAccountTree>,
}

#[derive(Serialize)]
struct MasterPolicyAccountTree {
    master_policy_pubkey: String,
    flight_policy_pubkeys: Vec<String>,
}

struct ApiError(anyhow::Error);

pub async fn start(config: Arc<Config>) -> Result<()> {
    let addr: SocketAddr = config
        .web_bind_addr
        .parse()
        .with_context(|| format!("WEB_BIND_ADDR 파싱 실패: {}", config.web_bind_addr))?;

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/master-policies", get(master_policies))
        .route("/api/flight-policies", get(flight_policies))
        .route("/api/master-policies/tree", get(master_policies_tree))
        .with_state(AppState { config });

    tracing::info!("[web] listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "riskmesh-backend",
        rpc_url: state.config.rpc_url.clone(),
        leader_pubkey: state.config.leader_pubkey.to_string(),
    })
}

async fn master_policies(
    State(state): State<AppState>,
) -> Result<Json<MasterPoliciesResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    let master_policies = scan_master_policies(&client, &state.config.program_id)
        .context("MasterPolicy 조회 실패")
        .map_err(ApiError)?;

    Ok(Json(MasterPoliciesResponse {
        program_id: state.config.program_id.to_string(),
        count: master_policies.len(),
        master_policies,
    }))
}

async fn flight_policies(
    State(state): State<AppState>,
) -> Result<Json<FlightPoliciesResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    let flight_policies = scan_flight_policies(&client, &state.config.program_id)
        .context("FlightPolicy 조회 실패")
        .map_err(ApiError)?;

    Ok(Json(FlightPoliciesResponse {
        program_id: state.config.program_id.to_string(),
        count: flight_policies.len(),
        flight_policies,
    }))
}

async fn master_policies_tree(
    State(state): State<AppState>,
) -> Result<Json<MasterPoliciesTreeResponse>, ApiError> {
    let client = SolanaClient::new(&state.config.rpc_url);
    let master_policies = scan_master_policies(&client, &state.config.program_id)
        .context("MasterPolicy 조회 실패")
        .map_err(ApiError)?;
    let flight_policies = scan_flight_policies(&client, &state.config.program_id)
        .context("FlightPolicy 조회 실패")
        .map_err(ApiError)?;

    let master_policies = master_policies
        .into_iter()
        .map(|master_policy| {
            let flight_policy_pubkeys = flight_policies
                .iter()
                .filter(|flight_policy| flight_policy.master == master_policy.pubkey)
                .map(|flight_policy| flight_policy.pubkey.clone())
                .collect();

            MasterPolicyAccountTree {
                master_policy_pubkey: master_policy.pubkey,
                flight_policy_pubkeys,
            }
        })
        .collect::<Vec<_>>();

    Ok(Json(MasterPoliciesTreeResponse {
        program_id: state.config.program_id.to_string(),
        count: master_policies.len(),
        master_policies,
    }))
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": self.0.to_string(),
            })),
        )
            .into_response()
    }
}
