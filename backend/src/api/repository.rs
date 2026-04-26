use anyhow::Result;
use async_trait::async_trait;
use serde::Serialize;

use crate::{
    config::Config,
    oracle::program_accounts::{FlightPolicyInfo, MasterAgreementInfo},
};

#[path = "display_names.rs"]
pub(crate) mod display_names;

pub(crate) use display_names::MasterAgreementDisplayNames;

/// 정책 데이터 저장소 추상화.
/// Firebase, SQLite 등 백엔드를 갈아끼울 수 있다.
#[async_trait]
pub(crate) trait InsuranceRepository: Send + Sync {
    /// 온체인 스냅샷을 저장소에 동기화한다.
    async fn sync_snapshots(
        &self,
        config: &Config,
        master_agreements: &[MasterAgreementInfo],
        flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary>;

    /// 모든 Master Agreement를 조회한다.
    async fn list_master_agreements(&self) -> Result<Vec<MasterAgreementInfo>>;

    /// 단일 Master Agreement를 조회한다.
    async fn get_master_agreement(&self, pubkey: &str) -> Result<Option<MasterAgreementInfo>>;

    /// 모든 FlightPolicy를 조회한다.
    async fn list_flight_policies(&self) -> Result<Vec<FlightPolicyInfo>>;

    /// 단일 FlightPolicy를 조회한다.
    async fn get_flight_policy(&self, pubkey: &str) -> Result<Option<FlightPolicyInfo>>;

    /// Master Agreement 표시 이름 메타데이터를 조회한다.
    async fn get_master_agreement_display_names(
        &self,
        master_policy_pubkey: &str,
    ) -> Result<Option<MasterAgreementDisplayNames>> {
        let _ = master_policy_pubkey;
        anyhow::bail!("display name persistence is not implemented for this repository")
    }

    /// Master Agreement 표시 이름 메타데이터를 저장한다.
    async fn put_master_agreement_display_names(
        &self,
        payload: &MasterAgreementDisplayNames,
    ) -> Result<()> {
        let _ = payload;
        anyhow::bail!("display name persistence is not implemented for this repository")
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct SyncSummary {
    pub synced_at: u64,
    pub master_agreement_count: usize,
    pub flight_policy_count: usize,
}
