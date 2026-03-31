mod api;
mod config;
mod events;
mod firebase;
mod flight_api;
mod oracle;
mod scheduler;
mod solana;
mod switchboard;

use anyhow::Result;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    // 로깅 초기화 (RUST_LOG 환경변수로 레벨 제어, 기본 info)
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // 설정 로드
    let config = Arc::new(config::Config::from_env()?);
    tracing::info!(
        "RiskMesh Backend 시작\n  RPC: {}\n  Program: {}\n  Leader: {}\n  Web: {}",
        config.rpc_url,
        config.program_id,
        config.leader_pubkey,
        config.web_bind_addr
    );

    let event_bus = Arc::new(events::EventBus::new(256));

    // 스케줄러와 API 서버를 함께 실행한다.
    let _scheduler_task = tokio::spawn(scheduler::start(config.clone(), event_bus.clone()));
    api::start(config.clone(), event_bus).await?;

    Ok(())
}
