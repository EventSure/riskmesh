use super::settle_flight_claim::calc_claim_split;

#[test]
fn claim_split_matches_example_with_commission() {
    let payout = 80_000_000u64; // 80 USDC with 6 decimals
    let (reinsurer, insurers) = calc_claim_split(payout, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 36_000_000);
    assert_eq!(insurers, vec![22_000_000, 13_200_000, 8_800_000]);
}
