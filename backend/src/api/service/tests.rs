use super::*;
use crate::{
    api::repository::{InsuranceRepository, SyncSummary},
    config::{Config, DbBackend},
    oracle::program_accounts::{
        FlightPolicyInfo, MasterAgreementInfo, MasterAgreementParticipantInfo,
    },
};
use anyhow::Result;
use async_trait::async_trait;
use solana_sdk::{pubkey::Pubkey, system_program};
use std::str::FromStr;

struct MockRepository {
    master_agreements: Vec<MasterAgreementInfo>,
    flight_policies: Vec<FlightPolicyInfo>,
}

#[async_trait]
impl InsuranceRepository for MockRepository {
    async fn sync_snapshots(
        &self,
        _config: &Config,
        _master_agreements: &[MasterAgreementInfo],
        _flight_policies: &[FlightPolicyInfo],
    ) -> Result<SyncSummary> {
        unreachable!("sync_snapshots is not used in api::service unit tests")
    }

    async fn list_master_agreements(&self) -> Result<Vec<MasterAgreementInfo>> {
        Ok(self.master_agreements.clone())
    }

    async fn get_master_agreement(&self, pubkey: &str) -> Result<Option<MasterAgreementInfo>> {
        Ok(self
            .master_agreements
            .iter()
            .find(|agreement| agreement.pubkey == pubkey)
            .cloned())
    }

    async fn list_flight_policies(&self) -> Result<Vec<FlightPolicyInfo>> {
        Ok(self.flight_policies.clone())
    }

    async fn get_flight_policy(&self, pubkey: &str) -> Result<Option<FlightPolicyInfo>> {
        Ok(self
            .flight_policies
            .iter()
            .find(|policy| policy.pubkey == pubkey)
            .cloned())
    }
}

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
        database_path: ":memory:".to_string(),
        web_bind_addr: "127.0.0.1:3000".to_string(),
    }
}

fn master_agreement(
    pubkey: &str,
    leader: &str,
    reinsurer: &str,
    participant: &str,
) -> MasterAgreementInfo {
    MasterAgreementInfo {
        pubkey: pubkey.to_string(),
        master_id: 1,
        leader: leader.to_string(),
        operator: leader.to_string(),
        currency_mint: Pubkey::new_unique().to_string(),
        coverage_start_ts: 100,
        coverage_end_ts: 200,
        premium_per_policy: 1_000,
        payout_delay_2h: 100,
        payout_delay_3h: 200,
        payout_delay_4to5h: 300,
        payout_delay_6h_or_cancelled: 400,
        leader_share_bps: 5_000,
        ceded_ratio_bps: 1_000,
        reins_commission_bps: 200,
        reinsurer_effective_bps: 800,
        reinsurer: Some(reinsurer.to_string()),
        reinsurer_confirmed: true,
        reinsurer_pool_wallet: Some(Pubkey::new_unique().to_string()),
        reinsurer_deposit_wallet: Some(Pubkey::new_unique().to_string()),
        leader_pool_wallet: Pubkey::new_unique().to_string(),
        leader_deposit_wallet: Pubkey::new_unique().to_string(),
        participants: vec![MasterAgreementParticipantInfo {
            insurer: participant.to_string(),
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

fn flight_policy(
    pubkey: &str,
    master: &str,
    status: u8,
    child_policy_id: u64,
) -> FlightPolicyInfo {
    FlightPolicyInfo {
        pubkey: pubkey.to_string(),
        child_policy_id,
        master: master.to_string(),
        creator: Pubkey::new_unique().to_string(),
        subscriber_ref: format!("sub-{child_policy_id}"),
        flight_no: format!("RM{child_policy_id}"),
        route: "ICN-NRT".to_string(),
        departure_ts: 1_700_000_000,
        premium_paid: 1_000,
        delay_minutes: 0,
        cancelled: false,
        payout_amount: 0,
        status,
        status_label: format!("status-{status}"),
        premium_distributed: false,
        created_at: 123,
        updated_at: 124,
    }
}

fn mock_repository() -> MockRepository {
    let agreement_a = master_agreement(
        "A1111111111111111111111111111111111111111111",
        "leader-a",
        "reinsurer-a",
        "participant-a",
    );
    let agreement_b = master_agreement(
        "B2222222222222222222222222222222222222222222",
        "leader-b",
        "reinsurer-b",
        "participant-b",
    );

    MockRepository {
        master_agreements: vec![agreement_a.clone(), agreement_b.clone()],
        flight_policies: vec![
            flight_policy("flight-a1", &agreement_a.pubkey, 1, 1),
            flight_policy("flight-a2", &agreement_a.pubkey, 2, 2),
            flight_policy("flight-b1", &agreement_b.pubkey, 2, 1),
        ],
    }
}

#[tokio::test]
async fn list_master_agreements_filters_by_leader() {
    let repository = mock_repository();
    let response = list_master_agreements(
        &repository,
        &MasterAgreementsQuery {
            leader: Some("leader-a".to_string()),
            wallet: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(response.master_agreements.len(), 1);
    assert_eq!(response.master_agreements[0].leader, "leader-a");
}

#[tokio::test]
async fn list_master_agreements_filters_by_wallet_across_roles() {
    let repository = mock_repository();

    let by_reinsurer = list_master_agreements(
        &repository,
        &MasterAgreementsQuery {
            leader: None,
            wallet: Some("reinsurer-b".to_string()),
        },
    )
    .await
    .unwrap();
    assert_eq!(by_reinsurer.master_agreements.len(), 1);
    assert_eq!(by_reinsurer.master_agreements[0].leader, "leader-b");

    let by_participant = list_master_agreements(
        &repository,
        &MasterAgreementsQuery {
            leader: None,
            wallet: Some("participant-a".to_string()),
        },
    )
    .await
    .unwrap();
    assert_eq!(by_participant.master_agreements.len(), 1);
    assert_eq!(by_participant.master_agreements[0].leader, "leader-a");
}

#[tokio::test]
async fn create_db_test_document_uses_legacy_field_name_with_agreement_count() {
    let repository = mock_repository();

    let response = create_db_test_document(&repository).await.unwrap();

    assert_eq!(response["status"], "ok");
    assert_eq!(response["master_agreement_count"], 2);
}

#[tokio::test]
async fn list_flight_policies_filters_by_master_and_status() {
    let repository = mock_repository();
    let response = list_flight_policies(
        &repository,
        &FlightPoliciesQuery {
            master: Some("A1111111111111111111111111111111111111111111".to_string()),
            status: Some(2),
        },
    )
    .await
    .unwrap();

    assert_eq!(response.flight_policies.len(), 1);
    assert_eq!(response.flight_policies[0].pubkey, "flight-a2");
}

#[tokio::test]
async fn get_master_agreement_returns_not_found_error_when_missing() {
    let repository = mock_repository();

    let error = get_master_agreement(&repository, "missing").await.unwrap_err();

    assert!(error.to_string().contains("account not found"));
}

#[tokio::test]
async fn list_flight_policies_by_master_agreement_filters_children_only() {
    let repository = mock_repository();
    let config = test_config();
    let master_pubkey = Pubkey::from_str("A1111111111111111111111111111111111111111111").unwrap();

    let response =
        list_flight_policies_by_master_agreement(&repository, &config, &master_pubkey)
            .await
            .unwrap();

    assert_eq!(response.program_id, config.program_id.to_string());
    assert_eq!(response.master_agreement_pubkey, master_pubkey.to_string());
    assert_eq!(response.count, 2);
    assert_eq!(response.flight_policies[0].pubkey, "flight-a1");
    assert_eq!(response.flight_policies[1].pubkey, "flight-a2");
}

#[tokio::test]
async fn list_master_agreements_tree_groups_flight_policies_under_each_agreement() {
    let repository = mock_repository();
    let config = test_config();

    let response = list_master_agreements_tree(&repository, &config)
        .await
        .unwrap();

    assert_eq!(response.count, 2);
    assert_eq!(response.master_agreements[0].flight_policy_pubkeys.len(), 2);
    assert_eq!(response.master_agreements[1].flight_policy_pubkeys.len(), 1);
    assert_eq!(
        response.master_agreements[0].flight_policy_pubkeys,
        vec!["flight-a1".to_string(), "flight-a2".to_string()]
    );
}

#[test]
fn message_matches_filter_handles_master_and_flight_events() {
    let flight_message = SseMessage {
        event: "flight_policy_updated".to_string(),
        data: r#"{"master":"master-1","pubkey":"flight-1"}"#.to_string(),
    };
    assert!(message_matches_filter(&flight_message, Some("master-1")));
    assert!(!message_matches_filter(&flight_message, Some("master-2")));

    let agreement_message = SseMessage {
        event: "master_agreement_updated".to_string(),
        data: r#"{"pubkey":"master-1"}"#.to_string(),
    };
    assert!(message_matches_filter(&agreement_message, Some("master-1")));
    assert!(!message_matches_filter(&agreement_message, Some("master-2")));
}

#[test]
fn message_matches_filter_rejects_invalid_json_for_filtered_events() {
    let message = SseMessage {
        event: "flight_policy_updated".to_string(),
        data: "not-json".to_string(),
    };

    assert!(!message_matches_filter(&message, Some("master-1")));
    assert!(message_matches_filter(&message, None));
}
