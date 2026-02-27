use super::settle_flight_claim::calc_claim_split;

#[test]
fn claim_split_matches_example_with_commission() {
    // payout 80 USDC, 재보험 실효지분 45%, 참여사 50/30/20 분배 시 기대값 검증.
    let payout = 80_000_000u64; // 80 USDC with 6 decimals
    let (reinsurer, insurers) = calc_claim_split(payout, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 36_000_000);
    assert_eq!(insurers, vec![22_000_000, 13_200_000, 8_800_000]);
}
