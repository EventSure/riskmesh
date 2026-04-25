use anchor_lang::prelude::Pubkey;

use crate::constants::{MAX_FLIGHT_NO_LEN, MAX_ROUTE_LEN, MAX_SUBSCRIBER_REF_LEN};
use crate::errors::OpenParamError;
use crate::state::MasterAgreementStatus;

use super::create_flight_policy_from_master::validate_flight_policy_params;

fn active() -> u8 {
    MasterAgreementStatus::Active as u8
}

fn ok_params(
    master_status: u8,
    creator: Pubkey,
    leader: Pubkey,
    operator: Pubkey,
) -> std::result::Result<(), OpenParamError> {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    validate_flight_policy_params(
        master_status,
        creator,
        leader,
        operator,
        0,
        0,
        0,
        pool_key,
        pool_key,
        leader, // pool_owner == master_key (reused as shortcut)
        leader, // master_key
        creator,
        currency,
        currency,
        currency,
    )
}

#[test]
fn rejects_when_master_not_active() {
    let leader = Pubkey::new_unique();
    assert!(matches!(
        ok_params(
            MasterAgreementStatus::PendingConfirm as u8,
            leader,
            leader,
            leader
        ),
        Err(OpenParamError::MasterNotActive)
    ));
}

#[test]
fn rejects_unauthorized_creator() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    assert!(matches!(
        ok_params(active(), stranger, leader, operator),
        Err(OpenParamError::Unauthorized)
    ));
}

#[test]
fn accepts_leader_and_operator_as_creator() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    assert!(ok_params(active(), leader, leader, operator).is_ok());
    assert!(ok_params(active(), operator, leader, operator).is_ok());
}

#[test]
fn rejects_subscriber_ref_too_long() {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        MAX_SUBSCRIBER_REF_LEN + 1,
        0,
        0,
        pool_key,
        pool_key,
        leader,
        leader,
        leader,
        currency,
        currency,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::InputTooLong)));
}

#[test]
fn rejects_flight_no_too_long() {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        MAX_FLIGHT_NO_LEN + 1,
        0,
        pool_key,
        pool_key,
        leader,
        leader,
        leader,
        currency,
        currency,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::InputTooLong)));
}

#[test]
fn rejects_route_too_long() {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        0,
        MAX_ROUTE_LEN + 1,
        pool_key,
        pool_key,
        leader,
        leader,
        leader,
        currency,
        currency,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::InputTooLong)));
}

#[test]
fn rejects_leader_pool_key_mismatch() {
    let currency = Pubkey::new_unique();
    let stored_pool = Pubkey::new_unique();
    let wrong_pool = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        0,
        0,
        wrong_pool,
        stored_pool,
        leader,
        leader,
        leader,
        currency,
        currency,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
}

#[test]
fn rejects_pool_wallet_not_owned_by_master() {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let wrong_owner = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        0,
        0,
        pool_key,
        pool_key,
        wrong_owner,
        master_key,
        leader,
        currency,
        currency,
        currency,
    );
    assert!(matches!(
        result,
        Err(OpenParamError::InvalidSettlementTarget)
    ));
}

#[test]
fn rejects_payer_token_not_owned_by_creator() {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let wrong_payer_owner = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        0,
        0,
        pool_key,
        pool_key,
        leader,
        leader,
        wrong_payer_owner,
        currency,
        currency,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::Unauthorized)));
}

#[test]
fn rejects_payer_mint_mismatch() {
    let currency = Pubkey::new_unique();
    let wrong_mint = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        0,
        0,
        pool_key,
        pool_key,
        leader,
        leader,
        leader,
        wrong_mint,
        currency,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
}

#[test]
fn rejects_pool_mint_mismatch() {
    let currency = Pubkey::new_unique();
    let wrong_mint = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        0,
        0,
        0,
        pool_key,
        pool_key,
        leader,
        leader,
        leader,
        currency,
        wrong_mint,
        currency,
    );
    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
}

#[test]
fn accepts_all_valid_inputs() {
    let currency = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let leader = Pubkey::new_unique();
    let result = validate_flight_policy_params(
        active(),
        leader,
        leader,
        leader,
        MAX_SUBSCRIBER_REF_LEN,
        MAX_FLIGHT_NO_LEN,
        MAX_ROUTE_LEN,
        pool_key,
        pool_key,
        leader,
        leader,
        leader,
        currency,
        currency,
        currency,
    );
    assert!(result.is_ok());
}
