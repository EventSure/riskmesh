use anchor_lang::prelude::Pubkey;

use crate::constants::MAX_MASTER_PARTICIPANTS;
use crate::errors::OpenParamError;
use crate::state::MasterParticipantInit;

use super::create_master_agreement::validate_master_participants;

fn make_participants(n: usize, per_bps: u16) -> Vec<MasterParticipantInit> {
    (0..n)
        .map(|_| MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: per_bps,
        })
        .collect()
}

#[test]
fn master_participants_require_10000_bps_with_separate_leader_share() {
    // 리더 지분 + 참여사 지분 합계가 100%면 검증 통과.
    let leader = Pubkey::new_unique();
    let participants = vec![
        MasterParticipantInit { insurer: Pubkey::new_unique(), share_bps: 3_000 },
        MasterParticipantInit { insurer: Pubkey::new_unique(), share_bps: 2_000 },
    ];
    assert!(validate_master_participants(5_000, &participants, leader, false).is_ok());
}

#[test]
fn master_participants_reject_leader_in_participants_or_invalid_sum() {
    // 리더가 참여사 목록에 들어가거나 지분 합계가 틀리면 실패해야 한다.
    let leader = Pubkey::new_unique();
    let leader_in_participants = vec![
        MasterParticipantInit { insurer: leader, share_bps: 5_000 },
        MasterParticipantInit { insurer: Pubkey::new_unique(), share_bps: 5_000 },
    ];
    assert!(matches!(
        validate_master_participants(0, &leader_in_participants, leader, false),
        Err(OpenParamError::InvalidInput)
    ));

    let invalid_sum = vec![
        MasterParticipantInit { insurer: Pubkey::new_unique(), share_bps: 4_000 },
        MasterParticipantInit { insurer: Pubkey::new_unique(), share_bps: 4_000 },
    ];
    assert!(matches!(
        validate_master_participants(1_000, &invalid_sum, leader, false),
        Err(OpenParamError::InvalidRatio)
    ));
}

#[test]
fn master_participants_reject_empty_list_even_when_leader_has_full_share() {
    // 리더사만으로는 구성 불가.
    let leader = Pubkey::new_unique();
    assert!(matches!(
        validate_master_participants(10_000, &[], leader, false),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn master_participants_single_participant_plus_leader_is_valid() {
    let leader = Pubkey::new_unique();
    let participants = vec![MasterParticipantInit {
        insurer: Pubkey::new_unique(),
        share_bps: 4_000,
    }];
    assert!(validate_master_participants(6_000, &participants, leader, false).is_ok());
}

#[test]
fn master_participants_accept_exactly_max_count_without_reinsurer() {
    // 재보험사 없을 때 참여사 MAX_MASTER_PARTICIPANTS명은 유효하다.
    let leader = Pubkey::new_unique();
    // leader 2000bps + 참여사 MAX명 균등 배분
    let per_bps = 8_000u16 / MAX_MASTER_PARTICIPANTS as u16;
    let mut participants = make_participants(MAX_MASTER_PARTICIPANTS, per_bps);
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 8_000u16 - total;
    assert!(validate_master_participants(2_000, &participants, leader, false).is_ok());
}

#[test]
fn master_participants_reject_exceeding_max_count_without_reinsurer() {
    // 재보험사 없을 때 참여사가 MAX_MASTER_PARTICIPANTS+1명이면 거부.
    let leader = Pubkey::new_unique();
    let n = MAX_MASTER_PARTICIPANTS + 1;
    let per_bps = 9_000u16 / n as u16;
    let mut participants = make_participants(n, per_bps);
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 9_000u16.saturating_sub(total);
    assert!(matches!(
        validate_master_participants(1_000, &participants, leader, false),
        Err(OpenParamError::TooManyParticipants)
    ));
}

#[test]
fn master_participants_accept_max_minus_one_with_reinsurer() {
    // 재보험사 있을 때 참여사 MAX-1명은 유효하다 (합산 = MAX).
    let leader = Pubkey::new_unique();
    let n = MAX_MASTER_PARTICIPANTS - 1;
    let per_bps = 8_000u16 / n as u16;
    let mut participants = make_participants(n, per_bps);
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 8_000u16 - total;
    assert!(validate_master_participants(2_000, &participants, leader, true).is_ok());
}

#[test]
fn master_participants_reject_max_participants_with_reinsurer() {
    // 재보험사 있을 때 참여사 MAX명이면 합산이 MAX+1이 되어 거부.
    let leader = Pubkey::new_unique();
    let per_bps = 8_000u16 / MAX_MASTER_PARTICIPANTS as u16;
    let mut participants = make_participants(MAX_MASTER_PARTICIPANTS, per_bps);
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 8_000u16 - total;
    assert!(matches!(
        validate_master_participants(2_000, &participants, leader, true),
        Err(OpenParamError::TooManyParticipants)
    ));
}
