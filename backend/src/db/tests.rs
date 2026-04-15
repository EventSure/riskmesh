use super::*;
use crate::{
    config::{Config, DbBackend},
    oracle::program_accounts::{
        FlightPolicyInfo, MasterAgreementInfo, MasterAgreementParticipantInfo,
    },
};
use serde_json::Value;
use solana_sdk::{pubkey::Pubkey, system_program};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

fn test_config() -> Config {
    Config {
        rpc_url: "http://localhost:8899".to_string(),
        program_id: system_program::id(),
        leader_keypair_path: "/tmp/test-keypair.json".to_string(),
        leader_pubkey: Pubkey::new_unique(),
        aviationstack_api_key: String::new(),
        switchboard_queue: Pubkey::new_unique(),
        oracle_check_cron: "0 */15 * * * *".to_string(),
        db_sync_cron: "0/30 * * * * *".to_string(),
        db_backend: DbBackend::Sqlite,
        database_path: String::new(),
        web_bind_addr: "127.0.0.1:3000".to_string(),
    }
}

fn temp_db_path(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("riskmesh-{name}-{unique}.sqlite3"))
}

fn master_agreement(pubkey: &str, premium_per_policy: u64) -> MasterAgreementInfo {
    MasterAgreementInfo {
        pubkey: pubkey.to_string(),
        master_id: 1,
        leader: "leader-1".to_string(),
        operator: "leader-1".to_string(),
        currency_mint: Pubkey::new_unique().to_string(),
        coverage_start_ts: 100,
        coverage_end_ts: 200,
        premium_per_policy,
        payout_delay_2h: 100,
        payout_delay_3h: 200,
        payout_delay_4to5h: 300,
        payout_delay_6h_or_cancelled: 400,
        ceded_ratio_bps: 1_000,
        reins_commission_bps: 200,
        reinsurer_effective_bps: 800,
        reinsurer: "reinsurer-1".to_string(),
        reinsurer_confirmed: true,
        reinsurer_pool_wallet: Pubkey::new_unique().to_string(),
        reinsurer_deposit_wallet: Pubkey::new_unique().to_string(),
        leader_deposit_wallet: Pubkey::new_unique().to_string(),
        participants: vec![MasterAgreementParticipantInfo {
            insurer: "participant-1".to_string(),
            share_bps: 5_000,
            confirmed: true,
            pool_wallet: Pubkey::new_unique().to_string(),
            deposit_wallet: Pubkey::new_unique().to_string(),
        }],
        oracle_feed: Pubkey::new_unique().to_string(),
        status: 2,
        status_label: "Active".to_string(),
        created_at: 123,
    }
}

fn flight_policy(pubkey: &str, master: &str, status: u8, child_policy_id: u64) -> FlightPolicyInfo {
    FlightPolicyInfo {
        pubkey: pubkey.to_string(),
        child_policy_id,
        master: master.to_string(),
        creator: Pubkey::new_unique().to_string(),
        subscriber_ref: format!("sub-{child_policy_id}"),
        flight_no: format!("RM{child_policy_id:03}"),
        route: "ICN-NRT".to_string(),
        departure_ts: 1_700_000_000,
        premium_paid: 1_500,
        delay_minutes: 10,
        cancelled: false,
        payout_amount: 0,
        status,
        status_label: format!("status-{status}"),
        premium_distributed: false,
        created_at: 123,
        updated_at: 124,
    }
}

#[tokio::test]
async fn sync_snapshots_persists_and_reads_back_documents() {
    let path = temp_db_path("sync-and-read");
    let repository = SqliteRepository::open(path.to_str().unwrap()).unwrap();
    let config = test_config();
    let agreements = vec![
        master_agreement("agreement-b", 2_000),
        master_agreement("agreement-a", 1_000),
    ];
    let flights = vec![
        flight_policy("flight-b", "agreement-b", 2, 2),
        flight_policy("flight-a", "agreement-a", 1, 1),
    ];

    let summary = repository
        .sync_snapshots(&config, &agreements, &flights)
        .await
        .unwrap();

    assert_eq!(summary.master_agreement_count, 2);
    assert_eq!(summary.flight_policy_count, 2);

    let stored_agreements = repository.list_master_agreements().await.unwrap();
    let stored_flights = repository.list_flight_policies().await.unwrap();

    assert_eq!(stored_agreements.len(), 2);
    assert_eq!(stored_flights.len(), 2);
    assert_eq!(stored_agreements[0].pubkey, "agreement-a");
    assert_eq!(stored_agreements[1].pubkey, "agreement-b");
    assert_eq!(stored_flights[0].pubkey, "flight-a");
    assert_eq!(stored_flights[1].pubkey, "flight-b");

    fs::remove_file(path).ok();
}

#[tokio::test]
async fn sync_snapshots_updates_existing_document_in_place() {
    let path = temp_db_path("upsert");
    let repository = SqliteRepository::open(path.to_str().unwrap()).unwrap();
    let config = test_config();
    let original = master_agreement("agreement-1", 1_000);
    let updated = master_agreement("agreement-1", 9_999);

    repository
        .sync_snapshots(&config, std::slice::from_ref(&original), &[])
        .await
        .unwrap();
    repository
        .sync_snapshots(&config, std::slice::from_ref(&updated), &[])
        .await
        .unwrap();

    let stored = repository
        .get_master_agreement("agreement-1")
        .await
        .unwrap()
        .unwrap();
    let agreements = repository.list_master_agreements().await.unwrap();

    assert_eq!(stored.premium_per_policy, 9_999);
    assert_eq!(agreements.len(), 1);

    fs::remove_file(path).ok();
}

#[tokio::test]
async fn sync_snapshots_writes_legacy_metadata_fields() {
    let path = temp_db_path("metadata");
    let repository = SqliteRepository::open(path.to_str().unwrap()).unwrap();
    let config = test_config();
    let agreements = vec![master_agreement("agreement-1", 1_000)];
    let flights = vec![flight_policy("flight-1", "agreement-1", 1, 1)];

    repository
        .sync_snapshots(&config, &agreements, &flights)
        .await
        .unwrap();

    let raw = repository.get(SYNC_METADATA, "current").unwrap().unwrap();
    let metadata: Value = serde_json::from_str(&raw).unwrap();

    assert_eq!(metadata["kind"], "policy_sync_metadata");
    assert_eq!(metadata["program_id"], config.program_id.to_string());
    assert_eq!(metadata["rpc_url"], config.rpc_url);
    assert_eq!(metadata["master_policy_count"], 1);
    assert_eq!(metadata["flight_policy_count"], 1);
    assert!(metadata["synced_at"].as_u64().unwrap() > 0);

    fs::remove_file(path).ok();
}

#[tokio::test]
async fn get_methods_return_none_for_missing_documents() {
    let path = temp_db_path("missing");
    let repository = SqliteRepository::open(path.to_str().unwrap()).unwrap();

    assert!(repository.get_master_agreement("missing").await.unwrap().is_none());
    assert!(repository.get_flight_policy("missing").await.unwrap().is_none());

    fs::remove_file(path).ok();
}
