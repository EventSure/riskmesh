use super::settle_flight_no_claim::calc_no_claim_split;

#[test]
fn no_claim_split_matches_example_with_commission() {
    let premium = 5_000_000u64; // 5 USDC with 6 decimals
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 2_250_000);
    assert_eq!(insurers, vec![1_375_000, 825_000, 550_000]);
}
