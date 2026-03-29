use std::{net::SocketAddr, sync::Arc};

use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query, State},
    http::{Method, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::get,
    Json, Router,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio_stream::wrappers::BroadcastStream;
use tower_http::cors::{Any, CorsLayer};

use crate::{
    cache::CacheState,
    config::Config,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub cache: Arc<CacheState>,
}

// ── Response types ──────────────────────────────────────────────────────────

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

// ── Query params ────────────────────────────────────────────────────────────

#[derive(Deserialize, Default)]
struct MasterPoliciesQuery {
    leader: Option<String>,
}

#[derive(Deserialize, Default)]
struct FlightPoliciesQuery {
    master: Option<String>,
    status: Option<u8>,
}

#[derive(Deserialize, Default)]
struct EventsQuery {
    master: Option<String>,
}

// ── Error type ──────────────────────────────────────────────────────────────

struct ApiError(anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": self.0.to_string() })),
        )
            .into_response()
    }
}

// ── Server entry point ──────────────────────────────────────────────────────

pub async fn start(config: Arc<Config>, cache: Arc<CacheState>) -> Result<()> {
    let addr: SocketAddr = config
        .web_bind_addr
        .parse()
        .with_context(|| format!("WEB_BIND_ADDR 파싱 실패: {}", config.web_bind_addr))?;

    let state = AppState { config, cache };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET])
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/master-policies", get(master_policies))
        .route("/api/master-policies/:pubkey", get(master_policy_by_pubkey))
        .route("/api/flight-policies", get(flight_policies))
        .route("/api/flight-policies/:pubkey", get(flight_policy_by_pubkey))
        .route("/api/events", get(events))
        .layer(cors)
        .with_state(state);

    tracing::info!("[web] listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// ── Handlers ────────────────────────────────────────────────────────────────

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
    Query(params): Query<MasterPoliciesQuery>,
) -> Json<MasterPoliciesResponse> {
    let all = state.cache.master_policies.read().await;
    let filtered: Vec<_> = all
        .iter()
        .filter(|m| {
            params.leader.as_deref().map(|l| m.leader == l).unwrap_or(true)
        })
        .cloned()
        .collect();
    let count = filtered.len();
    Json(MasterPoliciesResponse {
        program_id: state.config.program_id.to_string(),
        count,
        master_policies: filtered,
    })
}

async fn master_policy_by_pubkey(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> Result<Json<crate::oracle::program_accounts::MasterPolicyInfo>, (StatusCode, Json<serde_json::Value>)> {
    let all = state.cache.master_policies.read().await;
    match all.iter().find(|m| m.pubkey == pubkey) {
        Some(m) => Ok(Json(m.clone())),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "account not found" })),
        )),
    }
}

async fn flight_policies(
    State(state): State<AppState>,
    Query(params): Query<FlightPoliciesQuery>,
) -> Json<FlightPoliciesResponse> {
    let all = state.cache.flight_policies.read().await;
    let filtered: Vec<_> = all
        .iter()
        .filter(|f| {
            let master_ok = params.master.as_deref().map(|m| f.master == m).unwrap_or(true);
            let status_ok = params.status.map(|s| f.status == s).unwrap_or(true);
            master_ok && status_ok
        })
        .cloned()
        .collect();
    let count = filtered.len();
    Json(FlightPoliciesResponse {
        program_id: state.config.program_id.to_string(),
        count,
        flight_policies: filtered,
    })
}

async fn flight_policy_by_pubkey(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> Result<Json<crate::oracle::program_accounts::FlightPolicyInfo>, (StatusCode, Json<serde_json::Value>)> {
    let all = state.cache.flight_policies.read().await;
    match all.iter().find(|f| f.pubkey == pubkey) {
        Some(f) => Ok(Json(f.clone())),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "account not found" })),
        )),
    }
}

async fn events(
    State(state): State<AppState>,
    Query(params): Query<EventsQuery>,
) -> Sse<impl futures_util::Stream<Item = Result<Event, std::convert::Infallible>>> {
    let rx = state.cache.event_tx.subscribe();
    let master_filter = params.master.clone();

    let stream = BroadcastStream::new(rx).filter_map(move |msg| {
        let master_filter = master_filter.clone();
        let result = match msg {
            Ok(msg) => {
                // FlightPolicy 이벤트는 master 필터 적용
                if msg.event == "flight_policy_updated" {
                    if let Some(ref filter) = master_filter {
                        if !msg.data.contains(filter.as_str()) {
                            return std::future::ready(None);
                        }
                    }
                }
                let event = Event::default().event(&msg.event).data(&msg.data);
                Some(Ok(event))
            }
            Err(_) => None, // 채널 lagged — 스킵
        };
        std::future::ready(result)
    });

    Sse::new(stream).keep_alive(KeepAlive::default())
}
