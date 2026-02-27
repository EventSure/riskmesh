use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::ParticipantInit;

use super::create_policy::validate_policy_participants;

#[test]
fn policy_participant_ratio_must_sum_to_10000() {
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
