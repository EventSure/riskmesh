use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::{ParticipantShare, ParticipantStatus};

use super::accept_share::{calc_accepted_ratio_sum, calc_required_deposit};

#[test]
fn required_deposit_is_calculated_by_ratio() {
    // 80 USDC 보장금액에서 30% 지분이면 24 USDC를 예치해야 한다.
    let required = calc_required_deposit(80_000_000, 3_000).unwrap();
    assert_eq!(required, 24_000_000);
}

#[test]
fn required_deposit_rejects_invalid_ratio() {
    // 0bps, 10000bps 초과는 잘못된 지분율이다.
    assert!(matches!(
        calc_required_deposit(80_000_000, 0),
        Err(OpenParamError::InvalidRatio)
    ));
    assert!(matches!(
        calc_required_deposit(80_000_000, 10_001),
        Err(OpenParamError::InvalidRatio)
    ));
}

#[test]
fn accepted_ratio_sum_counts_only_accepted_participants() {
    // Accepted 상태의 지분만 합산되는지 확인한다.
    let participants = vec![
        ParticipantShare {
            insurer: Pubkey::new_unique(),
            ratio_bps: 5_000,
            status: ParticipantStatus::Accepted as u8,
            escrow: Pubkey::default(),
            escrowed_amount: 0,
        },
        ParticipantShare {
            insurer: Pubkey::new_unique(),
            ratio_bps: 3_000,
            status: ParticipantStatus::Pending as u8,
            escrow: Pubkey::default(),
            escrowed_amount: 0,
        },
        ParticipantShare {
            insurer: Pubkey::new_unique(),
            ratio_bps: 2_000,
            status: ParticipantStatus::Accepted as u8,
            escrow: Pubkey::default(),
            escrowed_amount: 0,
        },
    ];

    assert_eq!(calc_accepted_ratio_sum(&participants).unwrap(), 7_000);
}
