mod cache;
mod config;
mod flight_api;
mod oracle;
mod scheduler;
mod solana;
mod switchboard;
mod web;

use anyhow::Result;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Arc::new(config::Config::from_env()?);
    tracing::info!(
        "RiskMesh Backend 시작\n  RPC: {}\n  Program: {}\n  Leader: {}\n  Web: {}",
        config.rpc_url,
        config.program_id,
        config.leader_pubkey,
        config.web_bind_addr
    );

    let cache = Arc::new(cache::CacheState::new());

    let scheduler_task = tokio::spawn(scheduler::start(config.clone()));
    let cache_task = tokio::spawn(cache::start(config.clone(), cache.clone()));
    let web_task = tokio::spawn(web::start(config.clone(), cache.clone()));

    tokio::select! {
        res = scheduler_task => {
            match res {
                Ok(inner) => inner?,
                Err(e) => return Err(e.into()),
            }
        }
        res = cache_task => {
            match res {
                Ok(inner) => inner?,
                Err(e) => return Err(e.into()),
            }
        }
        res = web_task => {
            match res {
                Ok(inner) => inner?,
                Err(e) => return Err(e.into()),
            }
        }
    }

    Ok(())
}
