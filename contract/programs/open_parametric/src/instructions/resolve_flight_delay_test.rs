use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{FlightPolicyStatus, MasterAgreementStatus};

use super::resolve_flight_delay::validate_resolve_inputs;

fn active() -> u8 {
    MasterAgreementStatus::Active as u8
}
fn awaiting() -> u8 {
    FlightPolicyStatus::AwaitingOracle as u8
}

#[test]
fn rejects_when_master_not_active() {
    let leader = Pubkey::new_unique();
    assert!(matches!(
        validate_resolve_inputs(
            MasterAgreementStatus::PendingConfirm as u8,
            leader,
            leader,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            awaiting(),
        ),
        Err(OpenParamError::MasterNotActive)
    ));
}

#[test]
fn rejects_unauthorized_resolver() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    assert!(matches!(
        validate_resolve_inputs(
            active(),
            stranger,
            leader,
            operator,
            master_key,
            master_key,
            awaiting(),
        ),
        Err(OpenParamError::Unauthorized)
    ));
}

#[test]
fn accepts_leader_and_operator_as_resolver() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();

    assert!(validate_resolve_inputs(active(), leader, leader, operator, master_key, master_key, awaiting()).is_ok());
    assert!(validate_resolve_inputs(active(), operator, leader, operator, master_key, master_key, awaiting()).is_ok());
}

#[test]
fn rejects_flight_belonging_to_different_master() {
    let leader = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    let other_master = Pubkey::new_unique();
    assert!(matches!(
        validate_resolve_inputs(active(), leader, leader, leader, other_master, master_key, awaiting()),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_already_resolved_flight_status() {
    let leader = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    for bad_status in [
        FlightPolicyStatus::Claimable as u8,
        FlightPolicyStatus::NoClaim as u8,
        FlightPolicyStatus::Paid as u8,
        FlightPolicyStatus::Expired as u8,
    ] {
        assert!(
            matches!(
                validate_resolve_inputs(active(), leader, leader, leader, master_key, master_key, bad_status),
                Err(OpenParamError::InvalidState)
            ),
            "status {} should be InvalidState",
            bad_status
        );
    }
}

#[test]
fn accepts_issued_status_as_valid_initial_state() {
    let leader = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    assert!(validate_resolve_inputs(
        active(),
        leader,
        leader,
        leader,
        master_key,
        master_key,
        FlightPolicyStatus::Issued as u8,
    )
    .is_ok());
}
