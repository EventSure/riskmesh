use anyhow::Result;
use async_trait::async_trait;
use serde::Serialize;

use crate::{
    config::Config,
    oracle::program_accounts::{FlightPolicyInfo, MasterPolicyInfo},
};

/// 정책 데이터 저장소 추상화.
/// Firebase, SQLite 등 백엔드를 갈아끼울 수 있다.
#[async_trait]
pub(crate) trait PolicyRepository: Send + Sync {
    /// 온체인 스냅샷을 저장소에 동기화한다.
    async fn sync_policy_snapshots(
        &self,
        config: &Config,
        master_policies: &[MasterPolicyInfo],
        flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary>;

    /// 모든 MasterPolicy를 조회한다.
    async fn list_master_policies(&self) -> Result<Vec<MasterPolicyInfo>>;

    /// 단일 MasterPolicy를 조회한다.
    async fn get_master_policy(&self, pubkey: &str) -> Result<Option<MasterPolicyInfo>>;

    /// 모든 FlightPolicy를 조회한다.
    async fn list_flight_policies(&self) -> Result<Vec<FlightPolicyInfo>>;

    /// 단일 FlightPolicy를 조회한다.
    async fn get_flight_policy(&self, pubkey: &str) -> Result<Option<FlightPolicyInfo>>;
}

#[derive(Debug, Serialize)]
pub(crate) struct SyncSummary {
    pub synced_at: u64,
    pub master_policy_count: usize,
    pub flight_policy_count: usize,
}
