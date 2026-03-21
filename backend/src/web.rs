use std::{net::SocketAddr, sync::Arc};

use anyhow::{Context, Result};
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;

use crate::config::Config;

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

pub async fn start(config: Arc<Config>) -> Result<()> {
    let addr: SocketAddr = config
        .web_bind_addr
        .parse()
        .with_context(|| format!("WEB_BIND_ADDR 파싱 실패: {}", config.web_bind_addr))?;

    let app = Router::new()
        .route("/health", get(health))
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
