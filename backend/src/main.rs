mod config;
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
        "RiskMesh Oracle Daemon 시작\n  RPC: {}\n  Program: {}\n  Leader: {}",
        config.rpc_url,
        config.program_id,
        config.leader_pubkey
    );

    // 스케줄러 실행 (블로킹)
    scheduler::start(config).await
}
