use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{ConfirmRole, MasterAgreementStatus, MasterParticipant};

use super::confirm_master::{apply_confirm, ConfirmEffect};

fn pending() -> u8 {
    MasterAgreementStatus::PendingConfirm as u8
}

fn participant_role() -> u8 {
    ConfirmRole::Participant as u8
}

fn reinsurer_role() -> u8 {
    ConfirmRole::Reinsurer as u8
}

fn make_participant(confirmed: bool, with_wallets: bool) -> MasterParticipant {
    MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 5_000,
        confirmed,
        pool_wallet: if with_wallets {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        },
        deposit_wallet: if with_wallets {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        },
    }
}

#[test]
fn rejects_when_master_not_pending_confirm() {
    let leader = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(MasterAgreementStatus::Active as u8, participant_role(), leader, leader, &participants, None, Pubkey::new_unique()),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn rejects_leader_confirm_when_pool_wallet_not_registered() {
    let leader = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(pending(), participant_role(), leader, leader, &participants, None, Pubkey::default()),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn accepts_leader_confirm_when_pool_wallet_registered() {
    let leader = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(pending(), participant_role(), leader, leader, &participants, None, Pubkey::new_unique()),
        Ok(ConfirmEffect::LeaderConfirmed)
    ));
}

#[test]
fn accepts_participant_confirm_and_returns_correct_idx() {
    let leader = Pubkey::new_unique();
    let p = make_participant(false, true);
    let actor = p.insurer;
    let participants = vec![p];
    let effect = apply_confirm(pending(), participant_role(), actor, leader, &participants, None, Pubkey::new_unique()).unwrap();
    assert!(matches!(effect, ConfirmEffect::ParticipantConfirmed { idx: 0 }));
}

#[test]
fn rejects_participant_confirm_when_pool_wallet_missing() {
    let leader = Pubkey::new_unique();
    let p = make_participant(false, false);
    let actor = p.insurer;
    let participants = vec![p];
    assert!(matches!(
        apply_confirm(pending(), participant_role(), actor, leader, &participants, None, Pubkey::new_unique()),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_participant_confirm_when_deposit_wallet_missing() {
    let leader = Pubkey::new_unique();
    let mut p = make_participant(false, false);
    let actor = p.insurer;
    p.pool_wallet = Pubkey::new_unique(); // pool은 있지만 deposit 없음
    let participants = vec![p];
    assert!(matches!(
        apply_confirm(pending(), participant_role(), actor, leader, &participants, None, Pubkey::new_unique()),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_actor_not_in_participants_list() {
    let leader = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let participants = vec![make_participant(false, true)];
    assert!(matches!(
        apply_confirm(pending(), participant_role(), stranger, leader, &participants, None, Pubkey::new_unique()),
        Err(OpenParamError::Unauthorized)
    ));
}

#[test]
fn rejects_reinsurer_role_when_no_reinsurer_set() {
    let leader = Pubkey::new_unique();
    let actor = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(pending(), reinsurer_role(), actor, leader, &participants, None, Pubkey::new_unique()),
        Err(OpenParamError::InvalidRole)
    ));
}

#[test]
fn rejects_wrong_actor_for_reinsurer_role() {
    let leader = Pubkey::new_unique();
    let reinsurer = Pubkey::new_unique();
    let impostor = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(pending(), reinsurer_role(), impostor, leader, &participants, Some(reinsurer), Pubkey::new_unique()),
        Err(OpenParamError::Unauthorized)
    ));
}

#[test]
fn accepts_reinsurer_confirm_returns_reinsurer_confirmed() {
    let leader = Pubkey::new_unique();
    let reinsurer = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(pending(), reinsurer_role(), reinsurer, leader, &participants, Some(reinsurer), Pubkey::new_unique()),
        Ok(ConfirmEffect::ReinsurerConfirmed)
    ));
}

#[test]
fn rejects_invalid_role_value() {
    let leader = Pubkey::new_unique();
    let participants = vec![];
    assert!(matches!(
        apply_confirm(pending(), 2u8, leader, leader, &participants, None, Pubkey::new_unique()),
        Err(OpenParamError::InvalidRole)
    ));
}
