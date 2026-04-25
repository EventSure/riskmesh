use anchor_lang::prelude::Pubkey;

use crate::constants::ORACLE_MAX_STALENESS_SLOTS;
use crate::errors::OpenParamError;
use crate::math::TierPayouts;
use crate::state::{FlightPolicyStatus, MasterAgreementStatus};

use super::check_oracle_and_resolve_flight::{apply_oracle_reading, validate_oracle_context};

fn active() -> u8 {
    MasterAgreementStatus::Active as u8
}
fn awaiting() -> u8 {
    FlightPolicyStatus::AwaitingOracle as u8
}
fn default_tiers() -> TierPayouts {
    TierPayouts {
        delay_2h: 40,
        delay_3h: 60,
        delay_4to5h: 80,
        delay_6h_or_cancelled: 100,
    }
}

// ── validate_oracle_context ──────────────────────────────────────────────────

#[test]
fn rejects_master_not_active() {
    let feed = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    assert!(matches!(
        validate_oracle_context(
            MasterAgreementStatus::PendingConfirm as u8,
            feed,
            feed,
            master,
            master,
            awaiting(),
        ),
        Err(OpenParamError::MasterNotActive)
    ));
}

#[test]
fn rejects_oracle_feed_mismatch() {
    let master = Pubkey::new_unique();
    assert!(matches!(
        validate_oracle_context(
            active(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            master,
            master,
            awaiting(),
        ),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_flight_not_in_master() {
    let feed = Pubkey::new_unique();
    assert!(matches!(
        validate_oracle_context(
            active(),
            feed,
            feed,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            awaiting(),
        ),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn rejects_bad_flight_status() {
    let feed = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    for bad in [
        FlightPolicyStatus::Claimable as u8,
        FlightPolicyStatus::NoClaim as u8,
        FlightPolicyStatus::Paid as u8,
        FlightPolicyStatus::Expired as u8,
    ] {
        assert!(
            matches!(
                validate_oracle_context(active(), feed, feed, master, master, bad),
                Err(OpenParamError::InvalidState)
            ),
            "status {} should be InvalidState",
            bad
        );
    }
}

#[test]
fn accepts_awaiting_oracle_status() {
    let feed = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    assert!(validate_oracle_context(active(), feed, feed, master, master, awaiting()).is_ok());
}

#[test]
fn accepts_issued_status() {
    let feed = Pubkey::new_unique();
    let master = Pubkey::new_unique();
    assert!(validate_oracle_context(
        active(),
        feed,
        feed,
        master,
        master,
        FlightPolicyStatus::Issued as u8,
    )
    .is_ok());
}

// ── apply_oracle_reading ─────────────────────────────────────────────────────

#[test]
fn rejects_stale_oracle() {
    assert!(matches!(
        apply_oracle_reading(120, 0, 0, ORACLE_MAX_STALENESS_SLOTS + 1, default_tiers()),
        Err(OpenParamError::OracleStale)
    ));
}

#[test]
fn accepts_fresh_oracle_slot() {
    assert!(apply_oracle_reading(120, 0, 100, 100, default_tiers()).is_ok());
}

#[test]
fn rejects_nonzero_scale() {
    assert!(matches!(
        apply_oracle_reading(120, 1, 100, 100, default_tiers()),
        Err(OpenParamError::OracleFormat)
    ));
}

#[test]
fn rejects_negative_mantissa() {
    assert!(matches!(
        apply_oracle_reading(-1, 0, 100, 100, default_tiers()),
        Err(OpenParamError::OracleFormat)
    ));
}

#[test]
fn rejects_mantissa_overflow() {
    assert!(matches!(
        apply_oracle_reading(u16::MAX as i128 + 1, 0, 100, 100, default_tiers()),
        Err(OpenParamError::OracleFormat)
    ));
}

#[test]
fn returns_no_claim_below_threshold() {
    let (delay, payout, status) = apply_oracle_reading(119, 0, 100, 100, default_tiers()).unwrap();
    assert_eq!(delay, 119);
    assert_eq!(payout, 0);
    assert_eq!(status, FlightPolicyStatus::NoClaim as u8);
}

#[test]
fn returns_claimable_at_threshold() {
    let (delay, payout, status) = apply_oracle_reading(120, 0, 100, 100, default_tiers()).unwrap();
    assert_eq!(delay, 120);
    assert_eq!(payout, 40);
    assert_eq!(status, FlightPolicyStatus::Claimable as u8);
}

#[test]
fn returns_correct_payout_tier() {
    let tiers = default_tiers();
    let cases = [
        (120, tiers.delay_2h),
        (180, tiers.delay_3h),
        (240, tiers.delay_4to5h),
        (360, tiers.delay_6h_or_cancelled),
    ];
    for (minutes, expected_payout) in cases {
        let (_, payout, _) = apply_oracle_reading(minutes, 0, 0, 0, tiers).unwrap();
        assert_eq!(payout, expected_payout, "minutes={}", minutes);
    }
}
