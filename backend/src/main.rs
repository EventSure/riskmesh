mod api;
mod config;
mod db;
mod events;
mod firebase;
mod flight_api;
mod oracle;
mod scheduler;
mod solana;

use anyhow::Result;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

use crate::api::repository::InsuranceRepository;
use crate::config::DbBackend;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Arc::new(config::Config::from_env()?);
    tracing::info!(
        "RiskMesh Backend 시작\n  RPC: {}\n  Program: {}\n  Leader: {}\n  Web: {}\n  DB backend: {:?}\n  Contract dir: {}",
        config.rpc_url,
        config.program_id,
        config.leader_pubkey,
        config.web_bind_addr,
        config.db_backend,
        config.contract_dir,
    );

    let repository: Arc<dyn InsuranceRepository> = match config.db_backend {
        DbBackend::Sqlite => {
            tracing::info!("[db] SQLite 경로: {}", config.database_path);
            Arc::new(db::SqliteRepository::open(&config.database_path)?)
        }
        DbBackend::Firebase => {
            tracing::info!("[db] Firebase Firestore 사용");
            Arc::new(firebase::FirebaseRepository::from_env()?)
        }
    };

    let event_bus = Arc::new(events::EventBus::new(256));

    let _scheduler_task = tokio::spawn(scheduler::start(
        config.clone(),
        repository.clone(),
        event_bus.clone(),
    ));
    api::start(config.clone(), repository, event_bus).await?;

    Ok(())
}
