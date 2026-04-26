use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{ConfirmRole, MasterAgreementStatus, MasterParticipant};

use super::fund_pool::{
    resolve_actor_pool, validate_fund_pool_accounts, validate_fund_pool_status,
    FundPoolAccountValidation,
};

fn participant() -> MasterParticipant {
    MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 5_000,
        confirmed: false,
        pool_wallet: Pubkey::new_unique(),
        deposit_wallet: Pubkey::new_unique(),
    }
}

#[test]
fn fund_pool_status_allows_pending_confirm() {
    assert!(validate_fund_pool_status(MasterAgreementStatus::PendingConfirm as u8).is_ok());
}

#[test]
fn fund_pool_status_allows_active() {
    assert!(validate_fund_pool_status(MasterAgreementStatus::Active as u8).is_ok());
}

#[test]
fn fund_pool_status_rejects_closed() {
    assert!(matches!(
        validate_fund_pool_status(MasterAgreementStatus::Closed as u8),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn fund_pool_status_rejects_cancelled() {
    assert!(matches!(
        validate_fund_pool_status(MasterAgreementStatus::Cancelled as u8),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn fund_pool_status_rejects_unexpected_status() {
    assert!(matches!(
        validate_fund_pool_status(99),
        Err(OpenParamError::InvalidState)
    ));
}

#[test]
fn participant_role_returns_leader_pool_for_leader_actor() {
    let leader = Pubkey::new_unique();
    let leader_pool = Pubkey::new_unique();

    let result = resolve_actor_pool(
        ConfirmRole::Participant as u8,
        leader,
        leader,
        leader_pool,
        &[],
        None,
        None,
    );

    assert_eq!(result.unwrap(), leader_pool);
}

#[test]
fn participant_role_returns_matching_participant_pool() {
    let leader = Pubkey::new_unique();
    let participant = participant();
    let actor = participant.insurer;
    let expected_pool = participant.pool_wallet;

    let result = resolve_actor_pool(
        ConfirmRole::Participant as u8,
        actor,
        leader,
        Pubkey::new_unique(),
        &[participant],
        None,
        None,
    );

    assert_eq!(result.unwrap(), expected_pool);
}

#[test]
fn participant_role_rejects_unknown_actor() {
    let leader = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let participant = participant();

    let result = resolve_actor_pool(
        ConfirmRole::Participant as u8,
        stranger,
        leader,
        Pubkey::new_unique(),
        &[participant],
        None,
        None,
    );

    assert!(matches!(result, Err(OpenParamError::Unauthorized)));
}

#[test]
fn reinsurer_role_requires_configured_reinsurer() {
    let result = resolve_actor_pool(
        ConfirmRole::Reinsurer as u8,
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        &[],
        None,
        None,
    );

    assert!(matches!(result, Err(OpenParamError::InvalidRole)));
}

#[test]
fn reinsurer_role_rejects_non_reinsurer_actor() {
    let leader = Pubkey::new_unique();
    let reinsurer = Pubkey::new_unique();
    let impostor = Pubkey::new_unique();

    let result = resolve_actor_pool(
        ConfirmRole::Reinsurer as u8,
        impostor,
        leader,
        Pubkey::new_unique(),
        &[],
        Some(reinsurer),
        Some(Pubkey::new_unique()),
    );

    assert!(matches!(result, Err(OpenParamError::Unauthorized)));
}

#[test]
fn rejects_invalid_role_value() {
    let result = resolve_actor_pool(
        9,
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        &[],
        None,
        None,
    );

    assert!(matches!(result, Err(OpenParamError::InvalidRole)));
}

#[test]
fn validate_fund_pool_accounts_accepts_matching_actor_pool_and_source() {
    let actor = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let pool = Pubkey::new_unique();

    assert!(validate_fund_pool_accounts(FundPoolAccountValidation {
        actor,
        master_key: master,
        currency_mint: mint,
        actor_source_owner: actor,
        actor_source_mint: mint,
        actor_pool_key: pool,
        expected_pool: pool,
        actor_pool_mint: mint,
        actor_pool_owner: master,
    })
    .is_ok());
}

#[test]
fn validate_fund_pool_accounts_rejects_wrong_pool_owner() {
    let actor = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let pool = Pubkey::new_unique();

    let result = validate_fund_pool_accounts(FundPoolAccountValidation {
        actor,
        master_key: master,
        currency_mint: mint,
        actor_source_owner: actor,
        actor_source_mint: mint,
        actor_pool_key: pool,
        expected_pool: pool,
        actor_pool_mint: mint,
        actor_pool_owner: Pubkey::new_unique(),
    });

    assert!(matches!(
        result,
        Err(OpenParamError::InvalidSettlementTarget)
    ));
}
