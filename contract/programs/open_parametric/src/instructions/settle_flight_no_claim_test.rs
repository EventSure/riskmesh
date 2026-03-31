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

#[test]
fn no_claim_split_with_zero_ceded_gives_all_to_insurers() {
    // ceded=0 → 재보험사 몫 없음, 전액 참여사에게 배분.
    let premium = 3_000_000u64; // 3 USDC
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 0, &[5_000, 3_000, 2_000]).unwrap();
    assert_eq!(reinsurer, 0);
    assert_eq!(insurers, vec![1_500_000, 900_000, 600_000]);
}

#[test]
fn no_claim_split_with_single_participant() {
    // 단일 참여사(100%)는 재보험사 몫을 제외한 전액을 수령.
    let premium = 4_000_000u64; // 4 USDC
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 2_500, &[10_000]).unwrap();
    assert_eq!(reinsurer, 1_000_000); // 4 * 25%
    assert_eq!(insurers, vec![3_000_000]); // 4 * 75%
}

#[test]
fn no_claim_split_total_preserved_with_rounding() {
    // 나눗셈 나머지가 첫 참여사에게 귀속되어 총합이 보존되는지 검증.
    let premium = 1u64; // 극소값 (나머지 강제 발생)
    let (reinsurer, insurers) =
        calc_no_claim_split(premium, 0, &[5_000, 3_000, 2_000]).unwrap();
    let total: u64 = reinsurer + insurers.iter().sum::<u64>();
    assert_eq!(total, premium);
}
