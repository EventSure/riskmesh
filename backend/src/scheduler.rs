use anyhow::{Context, Result};
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::{api::repository::FirebaseRepository, config::Config};

/// 스케줄러를 시작하고 cron 표현식에 따라 오라클 체크 잡을 등록한다.
pub async fn start(config: Arc<Config>) -> Result<()> {
    let sched = JobScheduler::new().await?;
    let repository = Arc::new(FirebaseRepository::from_env()?);

    if let Err(e) = run_firebase_sync(&config, &repository).await {
        tracing::error!("[scheduler] 초기 Firebase 동기화 실패: {e:#}");
    }

    let cfg = config.clone();
    let job = Job::new_async(config.oracle_check_cron.as_str(), move |_uuid, _lock| {
        let cfg = cfg.clone();
        Box::pin(async move {
            if let Err(e) = run_oracle_check(&cfg).await {
                tracing::error!("[scheduler] 오라클 체크 실패: {e:#}");
            }
        })
    })?;

    let sync_cfg = config.clone();
    let sync_repo = repository.clone();
    let sync_job = Job::new_async(config.firebase_sync_cron.as_str(), move |_uuid, _lock| {
        let sync_cfg = sync_cfg.clone();
        let sync_repo = sync_repo.clone();
        Box::pin(async move {
            if let Err(e) = run_firebase_sync(&sync_cfg, &sync_repo).await {
                tracing::error!("[scheduler] Firebase 동기화 실패: {e:#}");
            }
        })
    })?;

    sched.add(job).await?;
    sched.add(sync_job).await?;
    sched.start().await?;
    tracing::info!(
        "[scheduler] 시작. oracle_cron='{}' firebase_sync_cron='{}'",
        config.oracle_check_cron,
        config.firebase_sync_cron
    );

    // 스케줄러가 계속 실행되도록 대기
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
    }
}

async fn run_firebase_sync(config: &Config, repository: &FirebaseRepository) -> Result<()> {
    use crate::{
        oracle::program_accounts::{scan_flight_policies, scan_master_policies},
        solana::client::SolanaClient,
    };

    let client = SolanaClient::new(&config.rpc_url);
    let master_policies = scan_master_policies(&client, &config.program_id)
        .context("MasterPolicy RPC 스캔 실패")?;
    let flight_policies = scan_flight_policies(&client, &config.program_id)
        .context("FlightPolicy RPC 스캔 실패")?;

    let summary = repository
        .sync_policy_snapshots(config, &master_policies, &flight_policies)
        .await
        .context("Firebase 정책 스냅샷 저장 실패")?;

    tracing::info!(
        "[scheduler] Firebase 동기화 완료. master_policies={} flight_policies={} synced_at={}",
        summary.master_policy_count,
        summary.flight_policy_count,
        summary.synced_at
    );

    Ok(())
}

/// 단일 오라클 체크 사이클: Track A + Track B 모두 실행
async fn run_oracle_check(config: &Config) -> Result<()> {
    use crate::{
        oracle::{track_a, track_b},
        solana::client::SolanaClient,
    };
    use solana_sdk::{signature::read_keypair_file, signer::Signer};

    let client = SolanaClient::new(&config.rpc_url);

    let keypair_path = shellexpand::tilde(&config.leader_keypair_path).to_string();
    let leader = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("키페어 파일 읽기 실패 ({keypair_path}): {e}"))?;

    tracing::info!("[scheduler] 오라클 체크 시작. leader={}", leader.pubkey());

    // ── Track B ──────────────────────────────────────────────────────────────
    let track_b_policies =
        track_b::scan_flight_policies(&client, &config.program_id).await?;
    tracing::info!("[track_b] AwaitingOracle FlightPolicy {}개 발견", track_b_policies.len());

    for fp in &track_b_policies {
        if let Err(e) = track_b::run(config, &client, &leader, fp).await {
            tracing::error!(
                "[track_b] {} 처리 실패: {e:#}",
                fp.flight_no
            );
        }
    }

    // ── Track A ──────────────────────────────────────────────────────────────
    let flight_policies =
        track_a::scan_active_flight_policies(&client, &config.program_id, &config.leader_pubkey)
            .await?;
    tracing::info!("[track_a] 처리 대상 FlightPolicy {}개 발견", flight_policies.len());

    for fp in &flight_policies {
        if let Err(e) = track_a::run(config, &client, &leader, fp).await {
            tracing::error!(
                "[track_a] {} 처리 실패: {e:#}",
                fp.flight_no
            );
        }
    }

    Ok(())
}
