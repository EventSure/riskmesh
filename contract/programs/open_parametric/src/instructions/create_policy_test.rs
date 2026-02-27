use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::ParticipantInit;

use super::create_policy::validate_policy_participants;

#[test]
fn policy_participant_ratio_must_sum_to_10000() {
    // 참여사 지분 합계가 10000bps면 유효하다.
    let participants = vec![
        ParticipantInit {
            insurer: Pubkey::new_unique(),
            ratio_bps: 5_000,
        },
        ParticipantInit {
            insurer: Pubkey::new_unique(),
            ratio_bps: 3_000,
        },
        ParticipantInit {
            insurer: Pubkey::new_unique(),
            ratio_bps: 2_000,
        },
    ];
    assert_eq!(validate_policy_participants(&participants).unwrap(), 10_000);
}

#[test]
fn policy_participant_ratio_rejects_invalid_sum() {
    // 합계가 10000bps가 아니면 InvalidRatio를 반환해야 한다.
    let participants = vec![
        ParticipantInit {
            insurer: Pubkey::new_unique(),
            ratio_bps: 6_000,
        },
        ParticipantInit {
            insurer: Pubkey::new_unique(),
            ratio_bps: 3_000,
        },
    ];
    assert!(matches!(
        validate_policy_participants(&participants),
        Err(OpenParamError::InvalidRatio)
    ));
}
