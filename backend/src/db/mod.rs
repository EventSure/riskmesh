use anyhow::{Context, Result};
use async_trait::async_trait;
use rusqlite::{params, Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde_json::json;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    api::repository::{InsuranceRepository, SyncSummary},
    config::Config,
    oracle::program_accounts::{FlightPolicyInfo, MasterAgreementInfo},
};

// TODO: persisted collection names are consumed outside backend; rename with frontend/data migration work.
const MASTER_POLICIES: &str = "master_policies";
const FLIGHT_POLICIES: &str = "flight_policies";
const SYNC_METADATA: &str = "sync_metadata";

/// SQLite 기반 InsuranceRepository 구현.
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

    fn upsert(&self, collection: &str, id: &str, payload: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO documents (collection, id, payload, updated_at)
             VALUES (?1, ?2, ?3, strftime('%s','now'))
             ON CONFLICT(collection, id)
             DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
            params![collection, id, payload],
        )
        .with_context(|| format!("문서 upsert 실패: {collection}/{id}"))?;
        Ok(())
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
impl InsuranceRepository for SqliteRepository {
    async fn sync_snapshots(
        &self,
        config: &Config,
        master_agreements: &[MasterAgreementInfo],
        flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary> {
        let synced_at = current_unix_seconds()?;

        let repo = self.clone();
        let master_agreements = master_agreements.to_vec();
        let flight_policies = flight_policies.to_vec();
        let program_id = config.program_id.to_string();
        let rpc_url = config.rpc_url.clone();

        tokio::task::spawn_blocking(move || {
            for agreement in &master_agreements {
                let payload =
                    serde_json::to_string(agreement).context("MasterAgreement JSON 직렬화 실패")?;
                repo.upsert(MASTER_POLICIES, &agreement.pubkey, &payload)
                    .with_context(|| format!("MasterAgreement 저장 실패: {}", agreement.pubkey))?;
            }
            for fp in &flight_policies {
                let payload = serde_json::to_string(fp).context("FlightPolicy JSON 직렬화 실패")?;
                repo.upsert(FLIGHT_POLICIES, &fp.pubkey, &payload)
                    .with_context(|| format!("FlightPolicy 저장 실패: {}", fp.pubkey))?;
            }
            let metadata = json!({
                "kind": "policy_sync_metadata",
                "program_id": program_id,
                "rpc_url": rpc_url,
                "synced_at": synced_at,
                "master_policy_count": master_agreements.len(),
                "flight_policy_count": flight_policies.len(),
            });
            repo.upsert(SYNC_METADATA, "current", &metadata.to_string())
                .context("동기화 메타데이터 저장 실패")?;
            Ok(SyncSummary {
                synced_at,
                master_agreement_count: master_agreements.len(),
                flight_policy_count: flight_policies.len(),
            })
        })
        .await
        .context("spawn_blocking 실패")?
    }

    async fn list_master_agreements(&self) -> Result<Vec<MasterAgreementInfo>> {
        let repo = self.clone();
        tokio::task::spawn_blocking(move || {
            repo.list_parsed(MASTER_POLICIES)
                .context("MasterAgreement 목록 조회 실패")
        })
        .await
        .context("spawn_blocking 실패")?
    }

    async fn get_master_agreement(&self, pubkey: &str) -> Result<Option<MasterAgreementInfo>> {
        let repo = self.clone();
        let pubkey = pubkey.to_string();
        tokio::task::spawn_blocking(move || {
            repo.get_parsed(MASTER_POLICIES, &pubkey)
                .with_context(|| format!("MasterAgreement 조회 실패: {pubkey}"))
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

fn current_unix_seconds() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("시스템 시간이 UNIX_EPOCH보다 이전입니다")?
        .as_secs())
}

#[cfg(test)]
mod tests;
