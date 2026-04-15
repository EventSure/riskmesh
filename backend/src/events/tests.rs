use super::*;
use crate::oracle::program_accounts::{
    FlightPolicyInfo, MasterAgreementInfo, MasterAgreementParticipantInfo,
};
use solana_sdk::pubkey::Pubkey;
use tokio::sync::broadcast::error::TryRecvError;

fn master_agreement(pubkey: &str, status: u8) -> MasterAgreementInfo {
    MasterAgreementInfo {
        pubkey: pubkey.to_string(),
        master_id: 1,
        leader: "leader-1".to_string(),
        operator: "leader-1".to_string(),
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
        reinsurer: Some("reinsurer-1".to_string()),
        reinsurer_confirmed: true,
        reinsurer_pool_wallet: Some(Pubkey::new_unique().to_string()),
        reinsurer_deposit_wallet: Some(Pubkey::new_unique().to_string()),
        leader_pool_wallet: Pubkey::new_unique().to_string(),
        leader_deposit_wallet: Pubkey::new_unique().to_string(),
        participants: vec![MasterAgreementParticipantInfo {
            insurer: "participant-1".to_string(),
            share_bps: 5_000,
            confirmed: true,
            pool_wallet: Pubkey::new_unique().to_string(),
            deposit_wallet: Pubkey::new_unique().to_string(),
        }],
        oracle_feed: Pubkey::new_unique().to_string(),
        status,
        status_label: format!("status-{status}"),
        created_at: 123,
    }
}

fn flight_policy(pubkey: &str, master: &str, status: u8) -> FlightPolicyInfo {
    FlightPolicyInfo {
        pubkey: pubkey.to_string(),
        child_policy_id: 1,
        master: master.to_string(),
        creator: Pubkey::new_unique().to_string(),
        subscriber_ref: "sub-1".to_string(),
        flight_no: "RM001".to_string(),
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

fn assert_no_message(receiver: &mut broadcast::Receiver<SseMessage>) {
    match receiver.try_recv() {
        Err(TryRecvError::Empty) => {}
        other => panic!("expected no message, got {other:?}"),
    }
}

#[tokio::test]
async fn initial_snapshot_does_not_publish_events() {
    let bus = EventBus::new(16);
    let mut rx = bus.subscribe();
    let agreement = master_agreement("agreement-1", 2);
    let flight = flight_policy("flight-1", &agreement.pubkey, 1);

    bus.publish_agreement_updates(&[agreement], &[flight]).await;

    assert_no_message(&mut rx);
}

#[tokio::test]
async fn unchanged_snapshot_does_not_publish_events() {
    let bus = EventBus::new(16);
    let mut rx = bus.subscribe();
    let agreement = master_agreement("agreement-1", 2);
    let flight = flight_policy("flight-1", &agreement.pubkey, 1);

    bus.publish_agreement_updates(std::slice::from_ref(&agreement), std::slice::from_ref(&flight))
        .await;
    bus.publish_agreement_updates(std::slice::from_ref(&agreement), std::slice::from_ref(&flight))
        .await;

    assert_no_message(&mut rx);
}

#[tokio::test]
async fn changed_master_agreement_publishes_legacy_event_name() {
    let bus = EventBus::new(16);
    let mut rx = bus.subscribe();
    let agreement = master_agreement("agreement-1", 2);

    bus.publish_agreement_updates(std::slice::from_ref(&agreement), &[])
        .await;

    let mut changed = agreement.clone();
    changed.status = 3;
    changed.status_label = "status-3".to_string();

    bus.publish_agreement_updates(std::slice::from_ref(&changed), &[])
        .await;

    let message = rx.try_recv().expect("changed agreement should publish an event");
    assert_eq!(message.event, "master_policy_updated");
    assert!(message.data.contains("\"pubkey\":\"agreement-1\""));
    assert!(message.data.contains("\"status\":3"));
    assert_no_message(&mut rx);
}

#[tokio::test]
async fn changed_flight_policy_publishes_update_event() {
    let bus = EventBus::new(16);
    let mut rx = bus.subscribe();
    let agreement = master_agreement("agreement-1", 2);
    let flight = flight_policy("flight-1", &agreement.pubkey, 1);

    bus.publish_agreement_updates(std::slice::from_ref(&agreement), std::slice::from_ref(&flight))
        .await;

    let mut changed = flight.clone();
    changed.status = 2;
    changed.status_label = "status-2".to_string();
    changed.delay_minutes = 135;

    bus.publish_agreement_updates(std::slice::from_ref(&agreement), std::slice::from_ref(&changed))
        .await;

    let message = rx.try_recv().expect("changed flight policy should publish an event");
    assert_eq!(message.event, "flight_policy_updated");
    assert!(message.data.contains("\"pubkey\":\"flight-1\""));
    assert!(message.data.contains("\"status\":2"));
    assert!(message.data.contains("\"delay_minutes\":135"));
    assert_no_message(&mut rx);
}
