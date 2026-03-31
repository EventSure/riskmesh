use std::{collections::HashMap, sync::Arc};

use anyhow::Result;
use tokio::{
    sync::{broadcast, RwLock},
    time::{sleep, Duration},
};

use crate::{
    config::Config,
    oracle::program_accounts::{scan_flight_policies, scan_master_policies},
    solana::client::SolanaClient,
};

/// 단일 SSE 메시지 (event 타입 + JSON data)
#[derive(Clone, Debug)]
pub struct SseMessage {
    pub event: String,
    pub data: String,
}

/// 앱 전체에서 공유하는 캐시 + 브로드캐스트 채널
pub struct CacheState {
    pub master_policies: RwLock<Vec<crate::oracle::program_accounts::MasterPolicyInfo>>,
    pub flight_policies: RwLock<Vec<crate::oracle::program_accounts::FlightPolicyInfo>>,
    pub event_tx: broadcast::Sender<SseMessage>,
}

impl CacheState {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(256);
        Self {
            master_policies: RwLock::new(Vec::new()),
            flight_policies: RwLock::new(Vec::new()),
            event_tx,
        }
    }
}

/// 백그라운드 캐시 갱신 루프.
/// CACHE_POLL_INTERVAL_SEC (기본 5초)마다 Solana RPC 스캔 후
/// 상태 변경 감지 시 SSE 브로드캐스트.
pub async fn start(config: Arc<Config>, cache: Arc<CacheState>) -> Result<()> {
    let poll_secs: u64 = std::env::var("CACHE_POLL_INTERVAL_SEC")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5);
    let heartbeat_secs: u64 = std::env::var("SSE_HEARTBEAT_INTERVAL_SEC")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30);

    let mut last_heartbeat = std::time::Instant::now();

    loop {
        let client = SolanaClient::new(&config.rpc_url);

        // ── MasterPolicy 스캔 ──────────────────────────────────────────
        match scan_master_policies(&client, &config.program_id) {
            Ok(new_masters) => {
                let mut guard = cache.master_policies.write().await;
                // 이전 상태 맵: pubkey → status
                let prev: HashMap<String, u8> =
                    guard.iter().map(|m| (m.pubkey.clone(), m.status)).collect();

                for m in &new_masters {
                    let changed = prev.get(&m.pubkey).map(|&s| s != m.status).unwrap_or(true);
                    if changed {
                        if let Ok(data) = serde_json::to_string(m) {
                            let _ = cache.event_tx.send(SseMessage {
                                event: "master_policy_updated".to_string(),
                                data,
                            });
                        }
                    }
                }
                *guard = new_masters;
            }
            Err(e) => tracing::warn!("[cache] MasterPolicy 스캔 실패: {e}"),
        }

        // ── FlightPolicy 스캔 ─────────────────────────────────────────
        match scan_flight_policies(&client, &config.program_id) {
            Ok(new_flights) => {
                let mut guard = cache.flight_policies.write().await;
                let prev: HashMap<String, u8> =
                    guard.iter().map(|f| (f.pubkey.clone(), f.status)).collect();

                for f in &new_flights {
                    let changed = prev.get(&f.pubkey).map(|&s| s != f.status).unwrap_or(true);
                    if changed {
                        if let Ok(data) = serde_json::to_string(f) {
                            let _ = cache.event_tx.send(SseMessage {
                                event: "flight_policy_updated".to_string(),
                                data,
                            });
                        }
                    }
                }
                *guard = new_flights;
            }
            Err(e) => tracing::warn!("[cache] FlightPolicy 스캔 실패: {e}"),
        }

        // ── Heartbeat ─────────────────────────────────────────────────
        if last_heartbeat.elapsed().as_secs() >= heartbeat_secs {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let _ = cache.event_tx.send(SseMessage {
                event: "heartbeat".to_string(),
                data: format!(r#"{{"ts":{ts}}}"#),
            });
            last_heartbeat = std::time::Instant::now();
        }

        sleep(Duration::from_secs(poll_secs)).await;
    }
}
