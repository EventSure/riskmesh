use anchor_lang::prelude::Pubkey;

use crate::constants::MAX_MASTER_PARTICIPANTS;
use crate::errors::OpenParamError;
use crate::state::MasterParticipantInit;

use super::create_master_agreement::validate_master_participants;

#[test]
fn master_participants_require_10000_bps_with_separate_leader_share() {
    // 리더 지분 + 참여사 지분 합계가 100%면 검증 통과.
    let leader = Pubkey::new_unique();
    let participants = vec![
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 3_000,
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 2_000,
        },
    ];
    assert!(validate_master_participants(5_000, &participants, leader).is_ok());
}

#[test]
fn master_participants_reject_leader_in_participants_or_invalid_sum() {
    // 리더가 참여사 목록에 들어가거나 지분 합계가 틀리면 실패해야 한다.
    let leader = Pubkey::new_unique();
    let leader_in_participants = vec![
        MasterParticipantInit {
            insurer: leader,
            share_bps: 5_000,
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 5_000,
        },
    ];
    assert!(matches!(
        validate_master_participants(0, &leader_in_participants, leader),
        Err(OpenParamError::InvalidInput)
    ));

    let invalid_sum = vec![
        MasterParticipantInit {
            share_bps: 4_000,
            insurer: Pubkey::new_unique(),
        },
        MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: 4_000,
        },
    ];
    assert!(matches!(
        validate_master_participants(1_000, &invalid_sum, leader),
        Err(OpenParamError::InvalidRatio)
    ));
}

#[test]
fn master_participants_reject_empty_list_even_when_leader_has_full_share() {
    let leader = Pubkey::new_unique();
    assert!(matches!(
        validate_master_participants(10_000, &[], leader),
        Err(OpenParamError::InvalidInput)
    ));
}

#[test]
fn master_participants_reject_exceeding_max_count() {
    let leader = Pubkey::new_unique();
    // MAX_MASTER_PARTICIPANTS+1개 생성; 리더 지분은 별도이고 나머지는 균등 배분
    let per_bps = 10_000u16 / (MAX_MASTER_PARTICIPANTS as u16 + 2);
    let mut participants: Vec<MasterParticipantInit> = (0..MAX_MASTER_PARTICIPANTS + 1)
        .map(|_| MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: per_bps,
        })
        .collect();
    // 합계가 10000이 되도록 첫 항목 조정
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += 7_500u16.saturating_sub(total);

    assert!(matches!(
        validate_master_participants(2_500, &participants, leader),
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
    assert!(validate_master_participants(6_000, &participants, leader).is_ok());
}

#[test]
fn master_participants_accept_exactly_max_count() {
    // 리더 4000 bps + 참여사 합계 6000 bps = 10000이면 유효하다.
    let leader = Pubkey::new_unique();
    let participant_total: u16 = 6_000;
    let per_bps = participant_total / MAX_MASTER_PARTICIPANTS as u16;
    let mut participants: Vec<MasterParticipantInit> = (0..MAX_MASTER_PARTICIPANTS)
        .map(|_| MasterParticipantInit {
            insurer: Pubkey::new_unique(),
            share_bps: per_bps,
        })
        .collect();
    let total: u16 = participants.iter().map(|p| p.share_bps).sum();
    participants[0].share_bps += participant_total - total;
    assert!(validate_master_participants(4_000, &participants, leader).is_ok());
}
