use anchor_lang::prelude::Pubkey;

use crate::errors::OpenParamError;
use crate::state::MasterAgreement;

use super::update_master_agreement_name::{
    apply_master_agreement_name_update, assert_can_rename_master_agreement,
};

fn master_agreement_with_name(name: &str, leader: Pubkey, operator: Pubkey) -> MasterAgreement {
    MasterAgreement {
        master_id: 1,
        name: name.to_string(),
        leader,
        operator,
        currency_mint: Pubkey::default(),
        coverage_start_ts: 0,
        coverage_end_ts: 0,
        premium_per_policy: 0,
        payout_delay_2h: 0,
        payout_delay_3h: 0,
        payout_delay_4to5h: 0,
        payout_delay_6h_or_cancelled: 0,
        leader_share_bps: 0,
        ceded_ratio_bps: 0,
        reins_commission_bps: 0,
        reinsurer_effective_bps: 0,
        reinsurer: None,
        reinsurer_confirmed: false,
        reinsurer_pool_wallet: None,
        reinsurer_deposit_wallet: None,
        leader_pool_wallet: Pubkey::default(),
        leader_deposit_wallet: Pubkey::default(),
        participants: vec![],
        oracle_feed: Pubkey::default(),
        status: 0,
        created_at: 0,
        bump: 0,
        collateral_claim_count: 0,
    }
}

#[test]
fn leader_can_rename() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();

    let result = assert_can_rename_master_agreement(leader, operator, leader);

    assert!(result.is_ok());
}

#[test]
fn operator_can_rename() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();

    let result = assert_can_rename_master_agreement(leader, operator, operator);

    assert!(result.is_ok());
}

#[test]
fn participant_cannot_rename() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let participant = Pubkey::new_unique();

    let result = assert_can_rename_master_agreement(leader, operator, participant);

    assert!(matches!(result, Err(OpenParamError::Unauthorized)));
}

#[test]
fn normalized_success_writes_trimmed_value() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let mut master = master_agreement_with_name("existing", leader, operator);

    let result =
        apply_master_agreement_name_update(&mut master, leader, "  2026 인천-뉴욕 공동계약  ");

    assert!(result.is_ok());
    assert_eq!(master.name, "2026 인천-뉴욕 공동계약");
}

#[test]
fn blank_rename_is_rejected() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let mut master = master_agreement_with_name("existing", leader, operator);

    let result = apply_master_agreement_name_update(&mut master, leader, "   ");

    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
    assert_eq!(master.name, "existing");
}

#[test]
fn overlong_rename_is_rejected() {
    let leader = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let mut master = master_agreement_with_name("existing", leader, operator);

    let result = apply_master_agreement_name_update(
        &mut master,
        operator,
        "12345678901234567890123456789012345678901",
    );

    assert!(matches!(result, Err(OpenParamError::InvalidInput)));
    assert_eq!(master.name, "existing");
}
