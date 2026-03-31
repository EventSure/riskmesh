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

use crate::config::Config;

pub async fn start(config: Arc<Config>) -> Result<()> {
    let addr: SocketAddr = config
        .web_bind_addr
        .parse()
        .with_context(|| format!("WEB_BIND_ADDR 파싱 실패: {}", config.web_bind_addr))?;

    let firebase_repository = Arc::new(repository::FirebaseRepository::from_env()?);
    let app = router::build_router(state::AppState {
        config,
        firebase_repository,
    });

    tracing::info!("[api] listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
