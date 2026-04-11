mod client;
mod error;
mod handlers;
pub(crate) mod repository;
mod router;
mod service;
mod state;
mod types;

use std::{net::SocketAddr, sync::Arc};

use anyhow::{Context, Result};
use tower_http::cors::{Any, CorsLayer};

use crate::{config::Config, events::EventBus};
use repository::PolicyRepository;

pub async fn start(
    config: Arc<Config>,
    repository: Arc<dyn PolicyRepository>,
    event_bus: Arc<EventBus>,
) -> Result<()> {
    let addr: SocketAddr = config
        .web_bind_addr
        .parse()
        .with_context(|| format!("WEB_BIND_ADDR 파싱 실패: {}", config.web_bind_addr))?;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = router::build_router(state::AppState {
        config,
        repository,
        event_bus,
    })
    .layer(cors);

    tracing::info!("[api] listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
