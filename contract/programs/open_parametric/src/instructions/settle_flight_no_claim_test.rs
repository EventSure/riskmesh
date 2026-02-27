use super::settle_flight_no_claim::calc_no_claim_split;

#[test]
fn no_claim_split_matches_example_with_commission() {
    // premium 5 USDC를 재보험 45% + 참여사 50/30/20으로 분할한 결과를 검증.
    let premium = 5_000_000u64; // 5 USDC with 6 decimals
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 4_500, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 2_250_000);
    assert_eq!(insurers, vec![1_375_000, 825_000, 550_000]);
}
