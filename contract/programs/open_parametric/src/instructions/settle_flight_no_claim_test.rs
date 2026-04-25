use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{FlightPolicyStatus, MasterAgreementStatus};

use super::settle_flight_no_claim::{calc_no_claim_split, validate_settle_no_claim};

#[test]
fn no_claim_split_matches_example_with_commission() {
    // premium 5 USDC를 재보험 45% + 참여사 50/30/20으로 분할한 결과를 검증.
    let premium = 5_000_000u64; // 5 USDC with 6 decimals
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 2_250_000);
    assert_eq!(insurers, vec![1_375_000, 825_000, 550_000]);
}

#[test]
fn no_claim_split_with_zero_ceded_gives_all_to_insurers() {
    // ceded=0 → 재보험사 몫 없음, 전액 참여사에게 배분.
    let premium = 3_000_000u64; // 3 USDC
    let (reinsurer, insurers) = calc_no_claim_split(premium, 0, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 0);
    assert_eq!(insurers, vec![1_500_000, 900_000, 600_000]);
}

#[test]
fn no_claim_split_with_single_participant() {
    // 단일 참여사(100%)는 재보험사 몫을 제외한 전액을 수령.
    let premium = 4_000_000u64; // 4 USDC
    let (reinsurer, insurers) = calc_no_claim_split(premium, 2_500, &[10_000]).unwrap();
    assert_eq!(reinsurer, 1_000_000); // 4 * 25%
    assert_eq!(insurers, vec![3_000_000]); // 4 * 75%
}

#[test]
fn no_claim_split_total_preserved_with_rounding() {
    // 나눗셈 나머지가 첫 참여사에게 귀속되어 총합이 보존되는지 검증.
    let premium = 1u64; // 극소값 (나머지 강제 발생)
    let (reinsurer, insurers) = calc_no_claim_split(premium, 0, &[5_000, 3_000, 2_000]).unwrap();
    let total: u64 = reinsurer + insurers.iter().sum::<u64>();
    assert_eq!(total, premium);
}

#[test]
fn no_claim_split_with_zero_premium_gives_all_zeros() {
    // premium=0 이면 모든 분배액이 0이어야 한다.
    let (reinsurer, insurers) = calc_no_claim_split(0, 4_500, &[5_000, 5_000]).unwrap();
    assert_eq!(reinsurer, 0);
    assert_eq!(insurers, vec![0, 0]);
}

#[test]
fn no_claim_split_with_max_participants_preserves_total() {
    // 참여사 5명(최대)일 때도 총합이 premium과 일치해야 한다.
    let premium = 10_000_000u64;
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 4_500, &[2_000, 2_000, 2_000, 2_000, 2_000]).unwrap();
    let total: u64 = reinsurer + insurers.iter().sum::<u64>();
    assert_eq!(total, premium);
    assert_eq!(insurers.len(), 5);
}

// --- validate_settle_no_claim 테스트 ---

fn valid_no_claim_args() -> (u8, Pubkey, Pubkey, Pubkey, Pubkey, Pubkey, u8, bool, Pubkey, Pubkey, Pubkey, Pubkey, Pubkey, usize, usize) {
    let leader = Pubkey::new_unique();
    let master_key = Pubkey::new_unique();
    let pool_key = Pubkey::new_unique();
    let deposit_key = Pubkey::new_unique();
    (
        MasterAgreementStatus::Active as u8,
        leader, leader, leader,     // executor, leader, operator
        master_key, master_key,     // flight_master, master_key
        FlightPolicyStatus::NoClaim as u8,
        false,                      // premium_distributed
        pool_key, pool_key,         // leader_pool_key, stored_pool
        master_key,                 // pool_owner
        deposit_key, deposit_key,   // leader_deposit_key, stored_deposit
        2, 2,                       // remaining_len, participants_len
    )
}

#[test]
fn validate_no_claim_rejects_inactive_master() {
    let (_, ex, l, op, fm, mk, fs, pd, lpk, sp, po, ldk, sd, rl, pl) = valid_no_claim_args();
    assert!(matches!(
        validate_settle_no_claim(MasterAgreementStatus::PendingConfirm as u8, ex, l, op, fm, mk, fs, pd, lpk, sp, po, ldk, sd, rl, pl),
        Err(OpenParamError::MasterNotActive)
    ));
}

#[test]
fn validate_no_claim_rejects_unauthorized_executor() {
    let (ms, _, l, op, fm, mk, fs, pd, lpk, sp, po, ldk, sd, rl, pl) = valid_no_claim_args();
    let stranger = Pubkey::new_unique();
    assert!(matches!(
        validate_settle_no_claim(ms, stranger, l, op, fm, mk, fs, pd, lpk, sp, po, ldk, sd, rl, pl),
        Err(OpenParamError::Unauthorized)
    ));
}

#[test]
fn validate_no_claim_rejects_wrong_flight_status() {
    let (ms, ex, l, op, fm, mk, _, pd, lpk, sp, po, ldk, sd, rl, pl) = valid_no_claim_args();
    for bad in [FlightPolicyStatus::Claimable as u8, FlightPolicyStatus::Paid as u8] {
        assert!(matches!(
            validate_settle_no_claim(ms, ex, l, op, fm, mk, bad, pd, lpk, sp, po, ldk, sd, rl, pl),
            Err(OpenParamError::InvalidState)
        ));
    }
}

#[test]
fn validate_no_claim_rejects_already_settled() {
    let (ms, ex, l, op, fm, mk, fs, _, lpk, sp, po, ldk, sd, rl, pl) = valid_no_claim_args();
    assert!(matches!(
        validate_settle_no_claim(ms, ex, l, op, fm, mk, fs, true, lpk, sp, po, ldk, sd, rl, pl),
        Err(OpenParamError::AlreadySettled)
    ));
}

#[test]
fn validate_no_claim_rejects_wrong_remaining_accounts_count() {
    let (ms, ex, l, op, fm, mk, fs, pd, lpk, sp, po, ldk, sd, _, _) = valid_no_claim_args();
    assert!(matches!(
        validate_settle_no_claim(ms, ex, l, op, fm, mk, fs, pd, lpk, sp, po, ldk, sd, 1, 2),
        Err(OpenParamError::InvalidAccountList)
    ));
}

#[test]
fn validate_no_claim_accepts_all_valid() {
    let a = valid_no_claim_args();
    assert!(validate_settle_no_claim(a.0, a.1, a.2, a.3, a.4, a.5, a.6, a.7, a.8, a.9, a.10, a.11, a.12, a.13, a.14).is_ok());
}
