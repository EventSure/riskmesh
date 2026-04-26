use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;

use super::update_master_agreement_name::assert_can_rename_master_agreement;

#[test]
fn leader_can_rename() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();

    let result = assert_can_rename_master_agreement(leader, operator, leader);

    assert!(result.is_ok());
}

#[test]
fn operator_can_rename() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();

    let result = assert_can_rename_master_agreement(leader, operator, operator);

    assert!(result.is_ok());
}

#[test]
fn participant_cannot_rename() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let participant = Pubkey::new_unique();

    let result = assert_can_rename_master_agreement(leader, operator, participant);

    assert!(matches!(result, Err(OpenParamError::Unauthorized)));
}
