use anchor_lang::prelude::Pubkey;

use crate::state::MasterParticipant;

use super::activate_master::all_participants_confirmed;

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
