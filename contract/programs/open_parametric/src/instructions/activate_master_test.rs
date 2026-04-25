use anchor_lang::prelude::Pubkey;

use crate::state::MasterParticipant;

use super::activate_master::{all_participants_confirmed, has_underfunded_pool};

fn participant(confirmed: bool, has_wallets: bool) -> MasterParticipant {
    MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 5_000,
        confirmed,
        pool_wallet: if has_wallets {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        },
        deposit_wallet: if has_wallets {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        },
    }
}

#[test]
fn returns_true_when_every_participant_is_confirmed_with_wallets() {
    // 모든 참여자가 확인 + 정산 지갑 등록 완료면 true.
    let participants = vec![participant(true, true), participant(true, true)];
    assert!(all_participants_confirmed(&participants));
}

#[test]
fn returns_false_when_any_participant_is_unconfirmed_or_missing_wallet() {
    // 하나라도 미확인 또는 지갑 미등록이면 false.
    let unconfirmed = vec![participant(true, true), participant(false, true)];
    assert!(!all_participants_confirmed(&unconfirmed));

    let missing_wallet = vec![participant(true, true), participant(true, false)];
    assert!(!all_participants_confirmed(&missing_wallet));
}

#[test]
fn returns_true_for_empty_participant_list() {
    // 참여사 목록이 비어 있으면 iter().all()이 vacuous true를 반환한다.
    assert!(all_participants_confirmed(&[]));
}

#[test]
fn returns_true_for_max_five_participants_all_confirmed() {
    // 5명 전원 confirmed + 지갑 등록 → true.
    let participants: Vec<_> = (0..5).map(|_| participant(true, true)).collect();
    assert!(all_participants_confirmed(&participants));
}

#[test]
fn returns_false_when_last_participant_missing_deposit_wallet() {
    // 마지막 참여자만 deposit_wallet 미등록이어도 false.
    let mut participants: Vec<_> = (0..4).map(|_| participant(true, true)).collect();
    participants.push(participant(true, false));
    assert!(!all_participants_confirmed(&participants));
}

#[test]
fn collateral_status_requires_each_party_ready() {
    let required = vec![100, 75, 25];
    let balances = vec![100, 74, 1_000];

    assert!(has_underfunded_pool(&required, &balances));
}

#[test]
fn collateral_status_accepts_all_ready() {
    let required = vec![100, 75, 25];
    let balances = vec![100, 75, 30];

    assert!(!has_underfunded_pool(&required, &balances));
}
