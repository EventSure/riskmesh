use anyhow::{Context, Result};
use async_trait::async_trait;
use rusqlite::{params, Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde_json::json;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    api::repository::{PolicyRepository, SyncSummary},
    config::Config,
    oracle::program_accounts::{FlightPolicyInfo, MasterPolicyInfo},
};

const MASTER_POLICIES: &str = "master_policies";
const FLIGHT_POLICIES: &str = "flight_policies";
const SYNC_METADATA: &str = "sync_metadata";

/// SQLite 기반 PolicyRepository 구현.
#[derive(Clone)]
pub struct SqliteRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteRepository {
    /// 지정된 경로에 SQLite 데이터베이스를 열고 테이블을 초기화한다.
    pub fn open(path: &str) -> Result<Self> {
        if let Some(parent) = Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("DB 디렉토리 생성 실패: {}", parent.display()))?;
            }
        }

        let conn = Connection::open(path)
            .with_context(|| format!("SQLite 데이터베이스 열기 실패: {path}"))?;

        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA busy_timeout = 5000;",
        )
        .context("SQLite PRAGMA 설정 실패")?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS documents (
                collection TEXT NOT NULL,
                id         TEXT NOT NULL,
                payload    TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                PRIMARY KEY (collection, id)
             );",
        )
        .context("documents 테이블 생성 실패")?;

        tracing::info!("[db] SQLite 열기 완료: {path}");

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn get(&self, collection: &str, id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT payload FROM documents WHERE collection = ?1 AND id = ?2")
            .context("문서 조회 쿼리 준비 실패")?;

        let result = stmt
            .query_row(params![collection, id], |row| row.get::<_, String>(0))
            .optional()
            .with_context(|| format!("문서 조회 실패: {collection}/{id}"))?;

        Ok(result)
    }

    fn list(&self, collection: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT payload FROM documents WHERE collection = ?1 ORDER BY id")
            .context("문서 목록 쿼리 준비 실패")?;

        let rows = stmt
            .query_map(params![collection], |row| row.get::<_, String>(0))
            .context("문서 목록 조회 실패")?;

        let mut documents = Vec::new();
        for row in rows {
            documents.push(row.context("문서 행 읽기 실패")?);
        }
        Ok(documents)
    }

    fn list_parsed<T: DeserializeOwned>(&self, collection: &str) -> Result<Vec<T>> {
        self.list(collection)?
            .into_iter()
            .map(|payload| serde_json::from_str(&payload).context("JSON 역직렬화 실패"))
            .collect()
    }

    fn get_parsed<T: DeserializeOwned>(&self, collection: &str, id: &str) -> Result<Option<T>> {
        match self.get(collection, id)? {
            Some(payload) => {
                let value = serde_json::from_str(&payload).context("JSON 역직렬화 실패")?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }
}

#[async_trait]
impl PolicyRepository for SqliteRepository {
    async fn sync_policy_snapshots(
        &self,
        config: &Config,
        master_policies: &[MasterPolicyInfo],
        flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary> {
        let synced_at = current_unix_seconds()?;

        let repo = self.clone();
        let master_policies = master_policies.to_vec();
        let flight_policies = flight_policies.to_vec();
        let program_id = config.program_id.to_string();
        let rpc_url = config.rpc_url.clone();

        tokio::task::spawn_blocking(move || {
            let mut conn = repo.conn.lock().unwrap();
            let tx = conn
                .transaction()
                .context("정책 스냅샷 트랜잭션 시작 실패")?;

            tx.execute(
                "DELETE FROM documents WHERE collection IN (?1, ?2)",
                params![MASTER_POLICIES, FLIGHT_POLICIES],
            )
            .context("기존 정책 스냅샷 삭제 실패")?;

            for mp in &master_policies {
                let payload = serde_json::to_string(mp).context("MasterPolicy JSON 직렬화 실패")?;
                upsert_document(&tx, MASTER_POLICIES, &mp.pubkey, &payload)
                    .with_context(|| format!("MasterPolicy 저장 실패: {}", mp.pubkey))?;
            }
            for fp in &flight_policies {
                let payload = serde_json::to_string(fp).context("FlightPolicy JSON 직렬화 실패")?;
                upsert_document(&tx, FLIGHT_POLICIES, &fp.pubkey, &payload)
                    .with_context(|| format!("FlightPolicy 저장 실패: {}", fp.pubkey))?;
            }
            let metadata = json!({
                "kind": "policy_sync_metadata",
                "program_id": program_id,
                "rpc_url": rpc_url,
                "synced_at": synced_at,
                "master_policy_count": master_policies.len(),
                "flight_policy_count": flight_policies.len(),
            });
            upsert_document(&tx, SYNC_METADATA, "current", &metadata.to_string())
                .context("동기화 메타데이터 저장 실패")?;
            tx.commit().context("정책 스냅샷 트랜잭션 커밋 실패")?;
            Ok(SyncSummary {
                synced_at,
                master_policy_count: master_policies.len(),
                flight_policy_count: flight_policies.len(),
            })
        })
        .await
        .context("spawn_blocking 실패")?
    }

    async fn list_master_policies(&self) -> Result<Vec<MasterPolicyInfo>> {
        let repo = self.clone();
        tokio::task::spawn_blocking(move || {
            repo.list_parsed(MASTER_POLICIES)
                .context("MasterPolicy 목록 조회 실패")
        })
        .await
        .context("spawn_blocking 실패")?
    }

    async fn get_master_policy(&self, pubkey: &str) -> Result<Option<MasterPolicyInfo>> {
        let repo = self.clone();
        let pubkey = pubkey.to_string();
        tokio::task::spawn_blocking(move || {
            repo.get_parsed(MASTER_POLICIES, &pubkey)
                .with_context(|| format!("MasterPolicy 조회 실패: {pubkey}"))
        })
        .await
        .context("spawn_blocking 실패")?
    }

    async fn list_flight_policies(&self) -> Result<Vec<FlightPolicyInfo>> {
        let repo = self.clone();
        tokio::task::spawn_blocking(move || {
            repo.list_parsed(FLIGHT_POLICIES)
                .context("FlightPolicy 목록 조회 실패")
        })
        .await
        .context("spawn_blocking 실패")?
    }

    async fn get_flight_policy(&self, pubkey: &str) -> Result<Option<FlightPolicyInfo>> {
        let repo = self.clone();
        let pubkey = pubkey.to_string();
        tokio::task::spawn_blocking(move || {
            repo.get_parsed(FLIGHT_POLICIES, &pubkey)
                .with_context(|| format!("FlightPolicy 조회 실패: {pubkey}"))
        })
        .await
        .context("spawn_blocking 실패")?
    }
}

fn upsert_document(
    tx: &rusqlite::Transaction<'_>,
    collection: &str,
    id: &str,
    payload: &str,
) -> Result<()> {
    tx.execute(
        "INSERT INTO documents (collection, id, payload, updated_at)
         VALUES (?1, ?2, ?3, strftime('%s','now'))
         ON CONFLICT(collection, id)
         DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        params![collection, id, payload],
    )
    .with_context(|| format!("문서 upsert 실패: {collection}/{id}"))?;
    Ok(())
}

fn current_unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_secs())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        api::repository::PolicyRepository,
        config::{Config, DbBackend},
        oracle::program_accounts::MasterParticipantInfo,
    };
    use solana_sdk::pubkey::Pubkey;

    #[tokio::test]
    async fn sync_policy_snapshots_replaces_stale_policy_rows() {
        let db_path = temp_db_path();
        let repo = SqliteRepository::open(db_path.to_str().unwrap()).unwrap();
        let config = test_config(db_path.to_string_lossy().into_owned());

        let stale_master = master_policy("stale-master");
        let active_master = master_policy("active-master");
        let stale_flight = flight_policy("stale-flight", "stale-master");
        let active_flight = flight_policy("active-flight", "active-master");

        repo.sync_policy_snapshots(
            &config,
            &[stale_master, active_master.clone()],
            &[stale_flight, active_flight.clone()],
        )
        .await
        .unwrap();

        repo.sync_policy_snapshots(
            &config,
            std::slice::from_ref(&active_master),
            std::slice::from_ref(&active_flight),
        )
        .await
        .unwrap();

        assert_eq!(
            repo.list_master_policies().await.unwrap(),
            vec![active_master]
        );
        assert_eq!(
            repo.list_flight_policies().await.unwrap(),
            vec![active_flight]
        );

        let _ = std::fs::remove_file(db_path);
    }

    fn temp_db_path() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "riskmesh-sqlite-replace-snapshot-{}-{suffix}.db",
            std::process::id()
        ))
    }

    fn test_config(database_path: String) -> Config {
        Config {
            rpc_url: "http://localhost:8899".to_string(),
            program_id: Pubkey::new_unique(),
            leader_keypair_path: "/tmp/id.json".to_string(),
            leader_pubkey: Pubkey::new_unique(),
            aviationstack_api_key: String::new(),
            switchboard_queue: Pubkey::new_unique(),
            oracle_check_cron: "0 */15 * * * *".to_string(),
            db_sync_cron: "0/30 * * * * *".to_string(),
            db_backend: DbBackend::Sqlite,
            database_path,
            web_bind_addr: "127.0.0.1:3000".to_string(),
        }
    }

    fn master_policy(pubkey: &str) -> MasterPolicyInfo {
        MasterPolicyInfo {
            pubkey: pubkey.to_string(),
            master_id: 1,
            leader: "leader".to_string(),
            operator: "operator".to_string(),
            currency_mint: "mint".to_string(),
            coverage_start_ts: 1,
            coverage_end_ts: 2,
            premium_per_policy: 3,
            payout_delay_2h: 4,
            payout_delay_3h: 5,
            payout_delay_4to5h: 6,
            payout_delay_6h_or_cancelled: 7,
            leader_share_bps: 5000,
            ceded_ratio_bps: 5000,
            reins_commission_bps: 1000,
            reinsurer_effective_bps: 4500,
            reinsurer: Some("reinsurer".to_string()),
            reinsurer_confirmed: true,
            reinsurer_pool_wallet: Some("reinsurer-pool".to_string()),
            reinsurer_deposit_wallet: Some("reinsurer-deposit".to_string()),
            leader_pool_wallet: "leader-pool".to_string(),
            leader_deposit_wallet: "leader-deposit".to_string(),
            participants: vec![MasterParticipantInfo {
                insurer: "insurer".to_string(),
                share_bps: 5000,
                confirmed: true,
                pool_wallet: "pool".to_string(),
                deposit_wallet: "deposit".to_string(),
            }],
            oracle_feed: "oracle-feed".to_string(),
            status: 2,
            status_label: "Active".to_string(),
            created_at: 8,
        }
    }

    fn flight_policy(pubkey: &str, master: &str) -> FlightPolicyInfo {
        FlightPolicyInfo {
            pubkey: pubkey.to_string(),
            child_policy_id: 1,
            master: master.to_string(),
            creator: "creator".to_string(),
            subscriber_ref: "subscriber".to_string(),
            flight_no: "KE001".to_string(),
            route: "ICN-LAX".to_string(),
            departure_ts: 1,
            premium_paid: 2,
            delay_minutes: 0,
            cancelled: false,
            payout_amount: 0,
            status: 1,
            status_label: "Issued".to_string(),
            premium_distributed: false,
            created_at: 3,
            updated_at: 4,
        }
    }
}
