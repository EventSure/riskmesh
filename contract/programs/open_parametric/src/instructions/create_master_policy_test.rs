use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::MasterParticipantInit;

use super::create_master_policy::validate_master_participants;

#[test]
fn master_participants_require_10000_bps_and_include_leader() {
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
