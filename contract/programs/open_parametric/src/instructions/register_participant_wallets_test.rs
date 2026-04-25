use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{MasterAgreementStatus, MasterParticipant};

use super::register_participant_wallets::{find_participant_idx, validate_wallet_registration};

fn pending() -> u8 {
    MasterAgreementStatus::PendingConfirm as u8
}

fn make_mint() -> Pubkey {
    Pubkey::new_unique()
}

#[test]
fn rejects_closed_master_status() {
    let mint = make_mint();
    let master_key = Pubkey::new_unique();
    assert!(matches!(
        validate_wallet_registration(
            MasterAgreementStatus::Closed as u8,
            mint,
            mint,
            mint,
            master_key,
            master_key,
        ),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn rejects_cancelled_master_status() {
    let mint = make_mint();
    let master_key = Pubkey::new_unique();
    assert!(matches!(
        validate_wallet_registration(
            MasterAgreementStatus::Cancelled as u8,
            mint,
            mint,
            mint,
            master_key,
            master_key,
        ),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn rejects_active_master_status() {
    let mint = make_mint();
    let master_key = Pubkey::new_unique();
    assert!(matches!(
        validate_wallet_registration(
            MasterAgreementStatus::Active as u8,
            mint,
            mint,
            mint,
            master_key,
            master_key,
        ),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn rejects_pool_wallet_mint_mismatch() {
    let currency = make_mint();
    let wrong_mint = make_mint();
    let master_key = Pubkey::new_unique();
    assert!(matches!(
        validate_wallet_registration(pending(), wrong_mint, currency, currency, master_key, master_key),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_deposit_wallet_mint_mismatch() {
    let currency = make_mint();
    let wrong_mint = make_mint();
    let master_key = Pubkey::new_unique();
    assert!(matches!(
        validate_wallet_registration(pending(), currency, wrong_mint, currency, master_key, master_key),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_pool_wallet_not_owned_by_master() {
    let currency = make_mint();
    let master_key = Pubkey::new_unique();
    let wrong_owner = Pubkey::new_unique();
    assert!(matches!(
        validate_wallet_registration(pending(), currency, currency, currency, wrong_owner, master_key),
        Err(OpenParamError::InvalidSettlementTarget)
    ));
}

#[test]
fn accepts_valid_wallet_registration() {
    let currency = make_mint();
    let master_key = Pubkey::new_unique();
    assert!(
        validate_wallet_registration(pending(), currency, currency, currency, master_key, master_key)
            .is_ok()
    );
}

#[test]
fn find_participant_idx_returns_correct_index() {
    let p0 = MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 5_000,
        confirmed: false,
        pool_wallet: Pubkey::default(),
        deposit_wallet: Pubkey::default(),
    };
    let p1 = MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 5_000,
        confirmed: false,
        pool_wallet: Pubkey::default(),
        deposit_wallet: Pubkey::default(),
    };
    let participants = vec![p0.clone(), p1.clone()];
    assert_eq!(find_participant_idx(&participants, p0.insurer).unwrap(), 0);
    assert_eq!(find_participant_idx(&participants, p1.insurer).unwrap(), 1);
}

#[test]
fn find_participant_idx_returns_not_found_for_stranger() {
    let participants = vec![MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 10_000,
        confirmed: false,
        pool_wallet: Pubkey::default(),
        deposit_wallet: Pubkey::default(),
    }];
    let stranger = Pubkey::new_unique();
    assert!(matches!(
        find_participant_idx(&participants, stranger),
        Err(OpenParamError::NotFound)
    ));
}
