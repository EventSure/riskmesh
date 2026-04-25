use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{FlightPolicyStatus, MasterAgreementStatus};

use super::settle_flight_claim::{calc_claim_split, validate_settle_claim};

#[test]
fn claim_split_matches_example_with_commission() {
    // payout 80 USDC, 재보험 실효지분 45%, 참여사 50/30/20 분배 시 기대값 검증.
    let payout = 80_000_000u64; // 80 USDC with 6 decimals
    let (reinsurer, insurers) = calc_claim_split(payout, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 36_000_000);
    assert_eq!(insurers, vec![22_000_000, 13_200_000, 8_800_000]);
}

#[test]
fn claim_split_with_zero_ceded_all_from_insurers() {
    // ceded=0 → 재보험사 부담 없음, 전액 참여사 pool에서 지급.
    let payout = 6_000_000u64; // 6 USDC
    let (reinsurer, insurers) = calc_claim_split(payout, 0, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 0);
    assert_eq!(insurers, vec![3_000_000, 1_800_000, 1_200_000]);
}

#[test]
fn claim_split_with_full_cession_all_from_reinsurer() {
    // ceded=100%, commission=0 → effective=100% → 재보험사가 전액 부담.
    let payout = 10_000_000u64; // 10 USDC
    let (reinsurer, insurers) = calc_claim_split(payout, 10_000, &[5_000, 5_000]).unwrap();
    assert_eq!(reinsurer, 10_000_000);
    assert_eq!(insurers, vec![0, 0]);
}

#[test]
fn claim_split_total_preserved_with_rounding() {
    // 나눗셈 나머지가 첫 참여사에게 귀속되어 총합이 보존되는지 검증.
    let payout = 7u64; // 나머지 강제 발생
    let (reinsurer, insurers) = calc_claim_split(payout, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    let total: u64 = reinsurer + insurers.iter().sum::<u64>();
    assert_eq!(total, payout);
}

#[test]
fn claim_split_with_zero_payout_gives_all_zeros() {
    // payout=0 이면 모든 분배액이 0이어야 한다.
    let (reinsurer, insurers) = calc_claim_split(0, 4_500, &[5_000, 5_000]).unwrap();
    assert_eq!(reinsurer, 0);
    assert_eq!(insurers, vec![0, 0]);
}

#[test]
fn claim_split_with_max_participants_preserves_total() {
    // 참여사 5명(최대)일 때도 총합이 payout과 일치해야 한다.
    let payout = 10_000_000u64;
    let (reinsurer, insurers) =
        calc_claim_split(payout, 4_500, &[2_000, 2_000, 2_000, 2_000, 2_000]).unwrap();
    let total: u64 = reinsurer + insurers.iter().sum::<u64>();
    assert_eq!(total, payout);
    assert_eq!(insurers.len(), 5);
}

// --- validate_settle_claim 테스트 ---

#[allow(clippy::type_complexity)]
fn valid_settle_claim_args() -> (
    u8,
    Pubkey,
    Pubkey,
    Pubkey,
    Pubkey,
    Pubkey,
    u8,
    u64,
    usize,
    usize,
    Pubkey,
    Pubkey,
    Pubkey,
    Pubkey,
    Pubkey,
) {
    let leader = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    let deposit_key = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    (
        MasterAgreementStatus::Active as u8,
        leader,
        leader,
        leader, // executor, leader, operator
        master_key,
        master_key, // flight_master, master_key
        FlightPolicyStatus::Claimable as u8,
        1_000_000, // payout
        2,
        2, // remaining_len, participants_len
        deposit_key,
        deposit_key, // leader_deposit_key, stored_deposit
        pool_key,
        pool_key,   // leader_pool_key, stored_pool
        master_key, // pool_owner
    )
}

#[test]
fn validate_settle_claim_rejects_inactive_master() {
    let (_, executor, leader, operator, fm, mk, fs, p, rl, pl, ldk, sd, lpk, sp, po) =
        valid_settle_claim_args();
    assert!(matches!(
        validate_settle_claim(
            MasterAgreementStatus::PendingConfirm as u8,
            executor,
            leader,
            operator,
            fm,
            mk,
            fs,
            p,
            rl,
            pl,
            ldk,
            sd,
            lpk,
            sp,
            po
        ),
        Err(OpenParamError::MasterNotActive)
    ));
}

#[test]
fn validate_settle_claim_rejects_unauthorized_executor() {
    let (ms, _, leader, operator, fm, mk, fs, p, rl, pl, ldk, sd, lpk, sp, po) =
        valid_settle_claim_args();
    let stranger = Pubkey::new_unique();
    assert!(matches!(
        validate_settle_claim(
            ms, stranger, leader, operator, fm, mk, fs, p, rl, pl, ldk, sd, lpk, sp, po
        ),
        Err(OpenParamError::Unauthorized)
    ));
}

#[test]
fn validate_settle_claim_rejects_wrong_flight_status() {
    let (ms, executor, leader, operator, fm, mk, _, p, rl, pl, ldk, sd, lpk, sp, po) =
        valid_settle_claim_args();
    for bad in [
        FlightPolicyStatus::NoClaim as u8,
        FlightPolicyStatus::Paid as u8,
        FlightPolicyStatus::Expired as u8,
    ] {
        assert!(matches!(
            validate_settle_claim(
                ms, executor, leader, operator, fm, mk, bad, p, rl, pl, ldk, sd, lpk, sp, po
            ),
            Err(OpenParamError::InvalidState)
        ));
    }
}

#[test]
fn validate_settle_claim_rejects_zero_payout() {
    let (ms, executor, leader, operator, fm, mk, fs, _, rl, pl, ldk, sd, lpk, sp, po) =
        valid_settle_claim_args();
    assert!(matches!(
        validate_settle_claim(
            ms, executor, leader, operator, fm, mk, fs, 0, rl, pl, ldk, sd, lpk, sp, po
        ),
        Err(OpenParamError::InvalidPayout)
    ));
}

#[test]
fn validate_settle_claim_rejects_wrong_remaining_accounts_count() {
    let (ms, executor, leader, operator, fm, mk, fs, p, _, _, ldk, sd, lpk, sp, po) =
        valid_settle_claim_args();
    assert!(matches!(
        validate_settle_claim(
            ms, executor, leader, operator, fm, mk, fs, p, 1, 2, ldk, sd, lpk, sp, po
        ),
        Err(OpenParamError::InvalidAccountList)
    ));
}

#[test]
fn validate_settle_claim_rejects_wrong_leader_deposit_key() {
    let (ms, executor, leader, operator, fm, mk, fs, p, rl, pl, _, _, lpk, sp, po) =
        valid_settle_claim_args();
    let wrong = Pubkey::new_unique();
    let stored = Pubkey::new_unique();
    assert!(matches!(
        validate_settle_claim(
            ms, executor, leader, operator, fm, mk, fs, p, rl, pl, wrong, stored, lpk, sp, po
        ),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn validate_settle_claim_accepts_all_valid() {
    let args = valid_settle_claim_args();
    assert!(validate_settle_claim(
        args.0, args.1, args.2, args.3, args.4, args.5, args.6, args.7, args.8, args.9, args.10,
        args.11, args.12, args.13, args.14
    )
    .is_ok());
}
