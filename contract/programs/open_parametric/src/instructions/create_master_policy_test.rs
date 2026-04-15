use anchor_lang::prelude::Pubkey;

use crate::constants::MAX_MASTER_PARTICIPANTS;
use crate::errors::OpenParamError;
use crate::state::MasterParticipantInit;

use super::create_master_policy::validate_master_participants;

#[test]
fn master_participants_require_10000_bps_and_include_leader() {
    // 총 지분 100% + 리더 포함 조건을 만족하면 검증 통과.
    let leader = Pubkey::new_unique();
    let participants = vec![
        MasterParticipantInit {
            insurer: leader,
            share_bps: 5_000,
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 3_000,
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 2_000,
        },
    ];
    assert!(validate_master_participants(&participants, leader).is_ok());
}

#[test]
fn master_participants_reject_missing_leader_or_invalid_sum() {
    // 리더 누락 또는 지분 합계 오류는 각각 실패해야 한다.
    let leader = Pubkey::new_unique();
    let missing_leader = vec![
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 5_000,
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 5_000,
        },
    ];
    assert!(matches!(
        validate_master_participants(&missing_leader, leader),
        Err(OpenParamError::InvalidInput)
    ));

    let invalid_sum = vec![
        MasterParticipantInit {
            insurer: leader,
            share_bps: 4_000,
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 4_000,
        },
    ];
    assert!(matches!(
        validate_master_participants(&invalid_sum, leader),
        Err(OpenParamError::InvalidRatio)
    ));
}

#[test]
fn master_participants_reject_empty_list() {
    let leader = Pubkey::new_unique();
    assert!(matches!(
        validate_master_participants(&[], leader),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn master_participants_reject_exceeding_max_count() {
    let leader = Pubkey::new_unique();
    // MAX_MASTER_PARTICIPANTS+1개 생성; 첫 항목은 리더, 나머지는 균등 배분
    let per_bps = 10_000u16 / (MAX_MASTER_PARTICIPANTS as u16 + 1);
    let mut participants: Vec<MasterParticipantInit> = (0..MAX_MASTER_PARTICIPANTS + 1)
        .map(|i| MasterParticipantInit {
            insurer: if i == 0 { leader } else { Pubkey::new_unique() },
            share_bps: per_bps,
        })
        .collect();
    // 합계가 10000이 되도록 첫 항목 조정
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 10_000u16.saturating_sub(total);

    assert!(matches!(
        validate_master_participants(&participants, leader),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn master_participants_single_leader_with_full_share() {
    // 단일 리더가 100%를 보유하는 경우 유효하다.
    let leader = Pubkey::new_unique();
    let participants = vec![MasterParticipantInit {
        insurer: leader,
        share_bps: 10_000,
    }];
    assert!(validate_master_participants(&participants, leader).is_ok());
}

#[test]
fn master_participants_accept_exactly_max_count() {
    // MAX_MASTER_PARTICIPANTS명이 정확히 10000 bps를 나눠 가지면 유효하다.
    let leader = Pubkey::new_unique();
    let per_bps = 10_000u16 / MAX_MASTER_PARTICIPANTS as u16; // 1250 (8명)
    let mut participants: Vec<MasterParticipantInit> = (0..MAX_MASTER_PARTICIPANTS)
        .map(|i| MasterParticipantInit {
            insurer: if i == 0 { leader } else { Pubkey::new_unique() },
            share_bps: per_bps,
        })
        .collect();
    // 나머지 bps를 첫 항목에 보정 (10000 % 8 = 0이므로 변동 없음)
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 10_000u16 - total;
    assert!(validate_master_participants(&participants, leader).is_ok());
}
