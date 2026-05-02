use super::*;
use crate::oracle::track_a::anchor_account_discriminator;

fn push_pubkey(buf: &mut Vec<u8>, pubkey: &Pubkey) {
    buf.extend_from_slice(pubkey.as_ref());
}

fn push_string(buf: &mut Vec<u8>, value: &str) {
    buf.extend_from_slice(&(value.len() as u32).to_le_bytes());
    buf.extend_from_slice(value.as_bytes());
}

fn build_master_agreement_bytes() -> (Pubkey, Vec<u8>, Vec<Pubkey>) {
    let pubkey = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let currency_mint = Pubkey::new_unique();
    let reinsurer = Pubkey::new_unique();
    let reinsurer_pool_wallet = Pubkey::new_unique();
    let reinsurer_deposit_wallet = Pubkey::new_unique();
    let leader_pool_wallet = Pubkey::new_unique();
    let leader_deposit_wallet = Pubkey::new_unique();
    let participant_insurer = Pubkey::new_unique();
    let participant_pool_wallet = Pubkey::new_unique();
    let participant_deposit_wallet = Pubkey::new_unique();
    let oracle_feed = Pubkey::new_unique();

    let mut data = anchor_account_discriminator("MasterAgreement").to_vec();
    data.extend_from_slice(&7u64.to_le_bytes());
    push_string(&mut data, "대한-뉴욕 2026 리더 공동계약");
    push_pubkey(&mut data, &leader);
    push_pubkey(&mut data, &operator);
    push_pubkey(&mut data, &currency_mint);
    data.extend_from_slice(&100i64.to_le_bytes());
    data.extend_from_slice(&200i64.to_le_bytes());
    data.extend_from_slice(&1_000u64.to_le_bytes());
    data.extend_from_slice(&100u64.to_le_bytes());
    data.extend_from_slice(&200u64.to_le_bytes());
    data.extend_from_slice(&300u64.to_le_bytes());
    data.extend_from_slice(&400u64.to_le_bytes());
    data.extend_from_slice(&5_000u16.to_le_bytes()); // leader_share_bps
    data.extend_from_slice(&1_100u16.to_le_bytes());
    data.extend_from_slice(&220u16.to_le_bytes());
    data.extend_from_slice(&880u16.to_le_bytes());
    data.push(1); // Option<reinsurer> = Some
    push_pubkey(&mut data, &reinsurer);
    data.push(1); // reinsurer_confirmed
    data.push(1); // Option<reinsurer_pool_wallet> = Some
    push_pubkey(&mut data, &reinsurer_pool_wallet);
    data.push(1); // Option<reinsurer_deposit_wallet> = Some
    push_pubkey(&mut data, &reinsurer_deposit_wallet);
    push_pubkey(&mut data, &leader_pool_wallet);
    push_pubkey(&mut data, &leader_deposit_wallet);
    data.extend_from_slice(&1u32.to_le_bytes());
    push_pubkey(&mut data, &participant_insurer);
    data.extend_from_slice(&5_000u16.to_le_bytes());
    data.push(1);
    push_pubkey(&mut data, &participant_pool_wallet);
    push_pubkey(&mut data, &participant_deposit_wallet);
    push_pubkey(&mut data, &oracle_feed);
    data.push(2);
    data.extend_from_slice(&777i64.to_le_bytes());
    data.push(254);

    (
        pubkey,
        data,
        vec![
            leader,
            operator,
            currency_mint,
            reinsurer,
            reinsurer_pool_wallet,
            reinsurer_deposit_wallet,
            leader_pool_wallet,
            leader_deposit_wallet,
            participant_insurer,
            participant_pool_wallet,
            participant_deposit_wallet,
            oracle_feed,
        ],
    )
}

fn build_legacy_master_agreement_bytes() -> (Pubkey, Vec<u8>, Vec<Pubkey>) {
    let pubkey = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let currency_mint = Pubkey::new_unique();
    let reinsurer = Pubkey::new_unique();
    let reinsurer_pool_wallet = Pubkey::new_unique();
    let reinsurer_deposit_wallet = Pubkey::new_unique();
    let leader_pool_wallet = Pubkey::new_unique();
    let leader_deposit_wallet = Pubkey::new_unique();
    let participant_insurer = Pubkey::new_unique();
    let participant_pool_wallet = Pubkey::new_unique();
    let participant_deposit_wallet = Pubkey::new_unique();
    let oracle_feed = Pubkey::new_unique();

    let mut data = anchor_account_discriminator("MasterAgreement").to_vec();
    data.extend_from_slice(&7u64.to_le_bytes());
    push_pubkey(&mut data, &leader);
    push_pubkey(&mut data, &operator);
    push_pubkey(&mut data, &currency_mint);
    data.extend_from_slice(&100i64.to_le_bytes());
    data.extend_from_slice(&200i64.to_le_bytes());
    data.extend_from_slice(&1_000u64.to_le_bytes());
    data.extend_from_slice(&100u64.to_le_bytes());
    data.extend_from_slice(&200u64.to_le_bytes());
    data.extend_from_slice(&300u64.to_le_bytes());
    data.extend_from_slice(&400u64.to_le_bytes());
    data.extend_from_slice(&5_000u16.to_le_bytes());
    data.extend_from_slice(&1_100u16.to_le_bytes());
    data.extend_from_slice(&220u16.to_le_bytes());
    data.extend_from_slice(&880u16.to_le_bytes());
    data.push(1);
    push_pubkey(&mut data, &reinsurer);
    data.push(1);
    data.push(1);
    push_pubkey(&mut data, &reinsurer_pool_wallet);
    data.push(1);
    push_pubkey(&mut data, &reinsurer_deposit_wallet);
    push_pubkey(&mut data, &leader_pool_wallet);
    push_pubkey(&mut data, &leader_deposit_wallet);
    data.extend_from_slice(&1u32.to_le_bytes());
    push_pubkey(&mut data, &participant_insurer);
    data.extend_from_slice(&5_000u16.to_le_bytes());
    data.push(1);
    push_pubkey(&mut data, &participant_pool_wallet);
    push_pubkey(&mut data, &participant_deposit_wallet);
    push_pubkey(&mut data, &oracle_feed);
    data.push(2);
    data.extend_from_slice(&777i64.to_le_bytes());
    data.push(254);

    (
        pubkey,
        data,
        vec![
            leader,
            operator,
            currency_mint,
            reinsurer,
            reinsurer_pool_wallet,
            reinsurer_deposit_wallet,
            leader_pool_wallet,
            leader_deposit_wallet,
            participant_insurer,
            participant_pool_wallet,
            participant_deposit_wallet,
            oracle_feed,
        ],
    )
}

fn build_flight_policy_bytes(status: u8) -> (Pubkey, Vec<u8>, Pubkey, Pubkey) {
    let pubkey = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    let creator = Pubkey::new_unique();

    let mut data = anchor_account_discriminator("FlightPolicy").to_vec();
    data.extend_from_slice(&9u64.to_le_bytes());
    push_pubkey(&mut data, &master);
    push_pubkey(&mut data, &creator);
    push_string(&mut data, "sub-9");
    push_string(&mut data, "RM009");
    push_string(&mut data, "ICN-NRT");
    data.extend_from_slice(&1_700_000_000i64.to_le_bytes());
    data.extend_from_slice(&1_500u64.to_le_bytes());
    data.extend_from_slice(&75u16.to_le_bytes());
    data.push(1);
    data.extend_from_slice(&9_999u64.to_le_bytes());
    data.push(status);
    data.push(1);
    data.extend_from_slice(&333i64.to_le_bytes());
    data.extend_from_slice(&444i64.to_le_bytes());
    data.push(7);

    (pubkey, data, master, creator)
}

#[test]
fn parse_master_agreement_parses_full_account_data() {
    let (pubkey, data, keys) = build_master_agreement_bytes();

    let agreement = parse_master_agreement(&pubkey, &data).unwrap();

    assert_eq!(agreement.pubkey, pubkey.to_string());
    assert_eq!(agreement.master_id, 7);
    assert_eq!(agreement.name, "대한-뉴욕 2026 리더 공동계약");
    assert_eq!(agreement.leader, keys[0].to_string());
    assert_eq!(agreement.operator, keys[1].to_string());
    assert_eq!(agreement.currency_mint, keys[2].to_string());
    assert_eq!(agreement.coverage_start_ts, 100);
    assert_eq!(agreement.coverage_end_ts, 200);
    assert_eq!(agreement.premium_per_policy, 1_000);
    assert_eq!(agreement.payout_delay_2h, 100);
    assert_eq!(agreement.payout_delay_3h, 200);
    assert_eq!(agreement.payout_delay_4to5h, 300);
    assert_eq!(agreement.payout_delay_6h_or_cancelled, 400);
    assert_eq!(agreement.ceded_ratio_bps, 1_100);
    assert_eq!(agreement.reins_commission_bps, 220);
    assert_eq!(agreement.reinsurer_effective_bps, 880);
    assert_eq!(agreement.reinsurer, Some(keys[3].to_string()));
    assert!(agreement.reinsurer_confirmed);
    assert_eq!(agreement.reinsurer_pool_wallet, Some(keys[4].to_string()));
    assert_eq!(agreement.reinsurer_deposit_wallet, Some(keys[5].to_string()));
    assert_eq!(agreement.leader_pool_wallet, keys[6].to_string());
    assert_eq!(agreement.leader_deposit_wallet, keys[7].to_string());
    assert_eq!(agreement.participants.len(), 1);
    assert_eq!(agreement.participants[0].insurer, keys[8].to_string());
    assert_eq!(agreement.participants[0].share_bps, 5_000);
    assert!(agreement.participants[0].confirmed);
    assert_eq!(agreement.participants[0].pool_wallet, keys[9].to_string());
    assert_eq!(agreement.participants[0].deposit_wallet, keys[10].to_string());
    assert_eq!(agreement.oracle_feed, keys[11].to_string());
    assert_eq!(agreement.status, 2);
    assert_eq!(agreement.status_label, "Active");
    assert_eq!(agreement.created_at, 777);
}

#[test]
fn parse_master_agreement_parses_legacy_account_data_without_name() {
    let (pubkey, data, keys) = build_legacy_master_agreement_bytes();

    let agreement = parse_master_agreement(&pubkey, &data).unwrap();

    assert_eq!(agreement.pubkey, pubkey.to_string());
    assert_eq!(agreement.master_id, 7);
    assert_eq!(agreement.name, "");
    assert_eq!(agreement.leader, keys[0].to_string());
    assert_eq!(agreement.operator, keys[1].to_string());
    assert_eq!(agreement.currency_mint, keys[2].to_string());
    assert_eq!(agreement.participants.len(), 1);
    assert_eq!(agreement.oracle_feed, keys[11].to_string());
    assert_eq!(agreement.status, 2);
}

#[test]
fn parse_flight_policy_parses_full_account_data() {
    let (pubkey, data, master, creator) = build_flight_policy_bytes(4);

    let policy = parse_flight_policy(&pubkey, &data).unwrap();

    assert_eq!(policy.pubkey, pubkey.to_string());
    assert_eq!(policy.child_policy_id, 9);
    assert_eq!(policy.master, master.to_string());
    assert_eq!(policy.creator, creator.to_string());
    assert_eq!(policy.subscriber_ref, "sub-9");
    assert_eq!(policy.flight_no, "RM009");
    assert_eq!(policy.route, "ICN-NRT");
    assert_eq!(policy.departure_ts, 1_700_000_000);
    assert_eq!(policy.premium_paid, 1_500);
    assert_eq!(policy.delay_minutes, 75);
    assert!(policy.cancelled);
    assert_eq!(policy.payout_amount, 9_999);
    assert_eq!(policy.status, 4);
    assert_eq!(policy.status_label, "NoClaim");
    assert!(policy.premium_distributed);
    assert_eq!(policy.created_at, 333);
    assert_eq!(policy.updated_at, 444);
}

#[test]
fn parse_flight_policy_maps_unknown_status_to_unknown_label() {
    let (pubkey, data, _, _) = build_flight_policy_bytes(99);

    let policy = parse_flight_policy(&pubkey, &data).unwrap();

    assert_eq!(policy.status, 99);
    assert_eq!(policy.status_label, "Unknown");
}

#[test]
fn parse_master_agreement_fails_on_truncated_data() {
    let (pubkey, mut data, _) = build_master_agreement_bytes();
    data.truncate(data.len() - 5);

    let error = parse_master_agreement(&pubkey, &data).unwrap_err();

    let message = error.to_string();
    assert!(
        message.contains("읽기 실패")
            || message.contains("범위 초과")
            || message.contains("legacy 레이아웃 파싱도 실패"),
        "unexpected error: {message}"
    );
}
