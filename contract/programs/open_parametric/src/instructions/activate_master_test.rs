use anchor_lang::prelude::Pubkey;

use crate::state::MasterParticipant;
use crate::state::MasterPolicy;

use super::activate_master::all_participants_confirmed;
use super::activate_master::calc_min_collateral_by_pool;

fn participant(confirmed: bool, has_wallets: bool) -> MasterParticipant {
    MasterParticipant {
        insurer: Pubkey::new_unique(),
        share_bps: 5_000,
        confirmed,
        pool_wallet: if has_wallets {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        },
        deposit_wallet: if has_wallets {
            Pubkey::new_unique()
        } else {
            Pubkey::default()
        },
    }
}

#[test]
fn returns_true_when_every_participant_is_confirmed_with_wallets() {
    // 모든 참여자가 확인 + 정산 지갑 등록 완료면 true.
    let participants = vec![participant(true, true), participant(true, true)];
    assert!(all_participants_confirmed(&participants));
}

#[test]
fn returns_false_when_any_participant_is_unconfirmed_or_missing_wallet() {
    // 하나라도 미확인 또는 지갑 미등록이면 false.
    let unconfirmed = vec![participant(true, true), participant(false, true)];
    assert!(!all_participants_confirmed(&unconfirmed));

    let missing_wallet = vec![participant(true, true), participant(true, false)];
    assert!(!all_participants_confirmed(&missing_wallet));
}

#[test]
fn collateral_requirement_is_split_by_reinsurer_and_participant_shares() {
    let participants = vec![
        MasterParticipant {
            insurer: Pubkey::new_unique(),
            share_bps: 5_000,
            confirmed: true,
            pool_wallet: Pubkey::new_unique(),
            deposit_wallet: Pubkey::new_unique(),
        },
        MasterParticipant {
            insurer: Pubkey::new_unique(),
            share_bps: 3_000,
            confirmed: true,
            pool_wallet: Pubkey::new_unique(),
            deposit_wallet: Pubkey::new_unique(),
        },
        MasterParticipant {
            insurer: Pubkey::new_unique(),
            share_bps: 2_000,
            confirmed: true,
            pool_wallet: Pubkey::new_unique(),
            deposit_wallet: Pubkey::new_unique(),
        },
    ];

    let master = MasterPolicy {
        master_id: 1,
        leader: Pubkey::new_unique(),
        operator: Pubkey::new_unique(),
        currency_mint: Pubkey::new_unique(),
        coverage_start_ts: 0,
        coverage_end_ts: 0,
        premium_per_policy: 0,
        payout_delay_2h: 0,
        payout_delay_3h: 0,
        payout_delay_4to5h: 0,
        payout_delay_6h_or_cancelled: 100_000_000, // 100 USDC (6 decimals)
        ceded_ratio_bps: 5_000,
        reins_commission_bps: 1_000,
        reinsurer_effective_bps: 4_500,
        reinsurer: Pubkey::new_unique(),
        reinsurer_confirmed: true,
        reinsurer_pool_wallet: Pubkey::new_unique(),
        reinsurer_deposit_wallet: Pubkey::new_unique(),
        leader_deposit_wallet: Pubkey::new_unique(),
        participants,
        oracle_feed: Pubkey::new_unique(),
        status: 1,
        created_at: 0,
        bump: 255,
    };

    let required = calc_min_collateral_by_pool(&master).unwrap();

    // 최소 담보금 총액: 100 USDC × 100건 = 10,000 USDC
    // reinsurer: 45% = 4,500 USDC
    // participant: 5,500 USDC를 50/30/20으로 분배
    assert_eq!(required.reinsurer, 4_500_000_000);
    assert_eq!(
        required.participants,
        vec![2_750_000_000, 1_650_000_000, 1_100_000_000]
    );
}
