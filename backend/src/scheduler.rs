use anyhow::{Context, Result};
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::{api::repository::InsuranceRepository, config::Config, events::EventBus};

/// 스케줄러를 시작하고 cron 표현식에 따라 오라클 체크 잡을 등록한다.
pub async fn start(
    config: Arc<Config>,
    repository: Arc<dyn InsuranceRepository>,
    event_bus: Arc<EventBus>,
) -> Result<()> {
    let sched = JobScheduler::new().await?;

    if let Err(e) = run_db_sync(&config, &*repository, &event_bus).await {
        tracing::error!("[scheduler] 초기 DB 동기화 실패: {e:#}");
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
    let sync_events = event_bus.clone();
    let sync_job = Job::new_async(config.db_sync_cron.as_str(), move |_uuid, _lock| {
        let sync_cfg = sync_cfg.clone();
        let sync_repo = sync_repo.clone();
        let sync_events = sync_events.clone();
        Box::pin(async move {
            if let Err(e) = run_db_sync(&sync_cfg, &*sync_repo, &sync_events).await {
                tracing::error!("[scheduler] DB 동기화 실패: {e:#}");
            }
        })
    })?;

    sched.add(job).await?;
    sched.add(sync_job).await?;
    sched.start().await?;
    tracing::info!(
        "[scheduler] 시작. oracle_cron='{}' db_sync_cron='{}'",
        config.oracle_check_cron,
        config.db_sync_cron
    );

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
    }
}

async fn run_db_sync(
    config: &Config,
    repository: &dyn InsuranceRepository,
    event_bus: &EventBus,
) -> Result<()> {
    use crate::{
        oracle::program_accounts::{scan_flight_policies, scan_master_agreements},
        solana::client::SolanaClient,
    };

    // RpcClient는 blocking HTTP를 사용하므로 spawn_blocking으로 tokio thread를 보호한다.
    let rpc_url = config.rpc_url.clone();
    let program_id = config.program_id;
    let (master_agreements, flight_policies) = tokio::task::spawn_blocking(move || {
        let client = SolanaClient::new(&rpc_url);
        let master = scan_master_agreements(&client, &program_id)
            .context("MasterAgreement RPC 스캔 실패")?;
        let flight = scan_flight_policies(&client, &program_id)
            .context("FlightPolicy RPC 스캔 실패")?;
        Ok::<_, anyhow::Error>((master, flight))
    })
    .await
    .context("RPC 스캔 spawn_blocking 실패")??;

    event_bus
        .publish_agreement_updates(&master_agreements, &flight_policies)
        .await;

    let summary = repository
        .sync_snapshots(config, &master_agreements, &flight_policies)
        .await
        .context("정책 스냅샷 저장 실패")?;

    tracing::info!(
        "[scheduler] DB 동기화 완료. master_agreements={} flight_policies={} synced_at={}",
        summary.master_agreement_count,
        summary.flight_policy_count,
        summary.synced_at
    );

    Ok(())
}

/// 단일 오라클 체크 사이클: Track A + Track B 모두 실행
async fn run_oracle_check(config: &Config) -> Result<()> {
    use crate::{
        oracle::track_b,
        solana::client::SolanaClient,
    };
    use solana_sdk::{pubkey::Pubkey, signature::read_keypair_file, signer::Signer};
    use std::str::FromStr;

    let client = SolanaClient::new(&config.rpc_url);

    let keypair_path = shellexpand::tilde(&config.leader_keypair_path).to_string();
    let leader = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("키페어 파일 읽기 실패 ({keypair_path}): {e}"))?;

    tracing::info!("[scheduler] 오라클 체크 시작. leader={}", leader.pubkey());

    // ── Track B ──────────────────────────────────────────────────────────────
    let mut track_b_policies =
        track_b::scan_flight_policies(&client, &config.program_id).await?;

    if let Ok(master_pda) = std::env::var("MASTER_PDA") {
        let master_pda = Pubkey::from_str(&master_pda)
            .with_context(|| format!("MASTER_PDA 주소 파싱 실패: {master_pda}"))?;
        track_b_policies.retain(|fp| fp.master_agreement == master_pda);
        tracing::info!("[track_b] MASTER_PDA 필터 적용: {}", master_pda);
    }

    if let Ok(child_policy_id) = std::env::var("CHILD_POLICY_ID") {
        let child_policy_id = child_policy_id
            .parse::<u64>()
            .with_context(|| format!("CHILD_POLICY_ID 파싱 실패: {child_policy_id}"))?;
        track_b_policies.retain(|fp| fp.child_policy_id == child_policy_id);
        tracing::info!("[track_b] CHILD_POLICY_ID 필터 적용: {}", child_policy_id);
    }

    tracing::info!("[track_b] AwaitingOracle FlightPolicy {}개 발견", track_b_policies.len());

    for fp in &track_b_policies {
        if let Err(e) = track_b::run(config, &client, &leader, fp).await {
            tracing::error!(
                "[track_b] {} 처리 실패: {e:#}",
                fp.flight_no
            );
        }
    }

    // Track A is intentionally manual-only. The daemon owns Track B automation so
    // real runs cannot silently fall back to trusted resolver behavior.
    tracing::info!("[track_a] 자동 실행 비활성화 (manual resolver only)");

    Ok(())
}
