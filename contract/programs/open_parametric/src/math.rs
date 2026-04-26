use crate::constants::DELAY_THRESHOLD_MIN;
use crate::errors::OpenParamError;

pub const BPS_DENOM: u64 = 10_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TierPayouts {
    pub delay_2h: u64,
    pub delay_3h: u64,
    pub delay_4to5h: u64,
    pub delay_6h_or_cancelled: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CollateralRequirements {
    pub total_required: u64,
    pub reinsurer_required: u64,
    pub insurer_total_required: u64,
    pub leader_required: u64,
    pub participant_required: Vec<u64>,
}

pub fn effective_reinsurer_bps(
    ceded_ratio_bps: u16,
    commission_bps: u16,
) -> Result<u16, OpenParamError> {
    if ceded_ratio_bps as u64 > BPS_DENOM || commission_bps as u64 > BPS_DENOM {
        return Err(OpenParamError::InvalidRatio);
    }
    let ceded = ceded_ratio_bps as u64;
    let keep = BPS_DENOM
        .checked_sub(commission_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?;
    let eff = ceded
        .checked_mul(keep)
        .ok_or(OpenParamError::MathOverflow)?
        / BPS_DENOM;
    u16::try_from(eff).map_err(|_| OpenParamError::MathOverflow)
}

pub fn tiered_payout(delay_minutes: u16, cancelled: bool, tiers: TierPayouts) -> u64 {
    if cancelled || delay_minutes >= 360 {
        return tiers.delay_6h_or_cancelled;
    }
    if (240..360).contains(&delay_minutes) {
        return tiers.delay_4to5h;
    }
    if (180..240).contains(&delay_minutes) {
        return tiers.delay_3h;
    }
    if (DELAY_THRESHOLD_MIN..180).contains(&delay_minutes) {
        return tiers.delay_2h;
    }
    0
}

pub fn max_payout_tier(tiers: TierPayouts) -> u64 {
    tiers
        .delay_2h
        .max(tiers.delay_3h)
        .max(tiers.delay_4to5h)
        .max(tiers.delay_6h_or_cancelled)
}

pub fn collateral_deficit(required: u64, current_balance: u64) -> u64 {
    required.saturating_sub(current_balance)
}

pub fn collateral_requirements(
    tiers: TierPayouts,
    collateral_claim_count: u16,
    reinsurer_effective_bps: u16,
    leader_share_bps: u16,
    participant_share_bps: &[u16],
) -> Result<CollateralRequirements, OpenParamError> {
    let total_required = max_payout_tier(tiers)
        .checked_mul(collateral_claim_count as u64)
        .ok_or(OpenParamError::MathOverflow)?;
    let reinsurer_required = total_required
        .checked_mul(reinsurer_effective_bps as u64)
        .ok_or(OpenParamError::MathOverflow)?
        / BPS_DENOM;
    let insurer_total_required = total_required
        .checked_sub(reinsurer_required)
        .ok_or(OpenParamError::MathOverflow)?;
    let mut insurer_shares = Vec::with_capacity(participant_share_bps.len() + 1);
    insurer_shares.push(leader_share_bps);
    insurer_shares.extend_from_slice(participant_share_bps);
    let mut insurer_split = split_by_bps(insurer_total_required, &insurer_shares)?;
    let leader_required = insurer_split.remove(0);
    let participant_required = insurer_split;

    Ok(CollateralRequirements {
        total_required,
        reinsurer_required,
        insurer_total_required,
        leader_required,
        participant_required,
    })
}

pub fn split_by_bps(total: u64, ratios_bps: &[u16]) -> Result<Vec<u64>, OpenParamError> {
    let mut out = Vec::with_capacity(ratios_bps.len());
    let mut sum: u64 = 0;
    for ratio in ratios_bps {
        sum = sum
            .checked_add(*ratio as u64)
            .ok_or(OpenParamError::MathOverflow)?;
    }
    if sum != BPS_DENOM {
        return Err(OpenParamError::InvalidRatio);
    }

    let mut allocated: u64 = 0;
    for ratio in ratios_bps {
        let part = total
            .checked_mul(*ratio as u64)
            .ok_or(OpenParamError::MathOverflow)?
            / BPS_DENOM;
        out.push(part);
        allocated = allocated
            .checked_add(part)
            .ok_or(OpenParamError::MathOverflow)?;
    }

    let rem = total
        .checked_sub(allocated)
        .ok_or(OpenParamError::MathOverflow)?;
    if rem > 0 {
        let remainder_idx = ratios_bps
            .iter()
            .position(|ratio| *ratio > 0)
            .ok_or(OpenParamError::InvalidRatio)?;
        out[remainder_idx] = out[remainder_idx]
            .checked_add(rem)
            .ok_or(OpenParamError::MathOverflow)?;
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiers() -> TierPayouts {
        TierPayouts {
            delay_2h: 40,
            delay_3h: 60,
            delay_4to5h: 80,
            delay_6h_or_cancelled: 100,
        }
    }

    #[test]
    fn effective_reinsurer_ratio_is_45pct_for_50pct_ceded_with_10pct_commission() {
        let eff = effective_reinsurer_bps(5_000, 1_000).unwrap();
        assert_eq!(eff, 4_500);
    }

    #[test]
    fn payout_tiers_work() {
        assert_eq!(tiered_payout(119, false, tiers()), 0);
        assert_eq!(tiered_payout(120, false, tiers()), 40);
        assert_eq!(tiered_payout(180, false, tiers()), 60);
        assert_eq!(tiered_payout(240, false, tiers()), 80);
        assert_eq!(tiered_payout(360, false, tiers()), 100);
        assert_eq!(tiered_payout(10, true, tiers()), 100);
    }

    #[test]
    fn split_keeps_total_with_rounding_remainder() {
        let parts = split_by_bps(1_000_000, &[5_000, 3_000, 2_000]).unwrap();
        assert_eq!(parts, vec![500_000, 300_000, 200_000]);

        let parts2 = split_by_bps(1, &[5_000, 3_000, 2_000]).unwrap();
        assert_eq!(parts2.iter().sum::<u64>(), 1);
    }

    #[test]
    fn effective_reinsurer_bps_rejects_out_of_bounds() {
        assert!(matches!(
            effective_reinsurer_bps(10_001, 0),
            Err(OpenParamError::InvalidRatio)
        ));
        assert!(matches!(
            effective_reinsurer_bps(0, 10_001),
            Err(OpenParamError::InvalidRatio)
        ));
    }

    #[test]
    fn effective_reinsurer_bps_edge_cases() {
        // ceded=0 → eff=0 (재보험 없음)
        assert_eq!(effective_reinsurer_bps(0, 0).unwrap(), 0);
        // commission=0 → eff=ceded (수수료 없음)
        assert_eq!(effective_reinsurer_bps(5_000, 0).unwrap(), 5_000);
        // ceded=10000, commission=10000 → eff=0 (수수료 100%)
        assert_eq!(effective_reinsurer_bps(10_000, 10_000).unwrap(), 0);
    }

    #[test]
    fn split_by_bps_rejects_invalid_sum() {
        assert!(matches!(
            split_by_bps(100, &[5_000, 5_001]),
            Err(OpenParamError::InvalidRatio)
        ));
        assert!(matches!(
            split_by_bps(100, &[5_000, 4_999]),
            Err(OpenParamError::InvalidRatio)
        ));
    }

    #[test]
    fn tiered_payout_boundary_values() {
        // 2H 구간 상한: 179 → 2H tier
        assert_eq!(tiered_payout(179, false, tiers()), 40);
        // 3H 구간 하한: 180, 상한: 239
        assert_eq!(tiered_payout(239, false, tiers()), 60);
        // 4-5H 구간 상한: 359
        assert_eq!(tiered_payout(359, false, tiers()), 80);
        // 6H 이상: 361
        assert_eq!(tiered_payout(361, false, tiers()), 100);
    }

    #[test]
    fn cancelled_overrides_any_delay_including_below_threshold() {
        // cancelled=true 는 delay가 임계값 미만이어도 최대 payout
        assert_eq!(tiered_payout(0, true, tiers()), 100);
        assert_eq!(tiered_payout(119, true, tiers()), 100);
        assert_eq!(tiered_payout(130, true, tiers()), 100);
        assert_eq!(tiered_payout(180, true, tiers()), 100);
    }

    #[test]
    fn calculates_required_collateral_with_reinsurer() {
        let tiers = TierPayouts {
            delay_2h: 5_000_000,
            delay_3h: 8_000_000,
            delay_4to5h: 12_000_000,
            delay_6h_or_cancelled: 15_000_000,
        };

        let req = collateral_requirements(tiers, 10, 4_500, 5_000, &[3_000, 2_000]).unwrap();

        assert_eq!(req.total_required, 150_000_000);
        assert_eq!(req.reinsurer_required, 67_500_000);
        assert_eq!(req.leader_required, 41_250_000);
        assert_eq!(req.participant_required, vec![24_750_000, 16_500_000]);
    }

    #[test]
    fn deficit_saturates_at_zero_when_overfunded() {
        assert_eq!(collateral_deficit(100, 120), 0);
        assert_eq!(collateral_deficit(100, 40), 60);
    }

    #[test]
    fn collateral_split_preserves_remainder_on_non_divisible_insurer_total() {
        let tiers = TierPayouts {
            delay_2h: 1,
            delay_3h: 1,
            delay_4to5h: 1,
            delay_6h_or_cancelled: 1,
        };

        let req = collateral_requirements(tiers, 1, 0, 5_000, &[5_000]).unwrap();

        assert_eq!(req.insurer_total_required, 1);
        assert_eq!(
            req.leader_required + req.participant_required.iter().sum::<u64>(),
            1
        );
        assert_eq!(req.leader_required, 1);
        assert_eq!(req.participant_required, vec![0]);
    }

    #[test]
    fn collateral_zero_share_leader_does_not_receive_rounding_remainder() {
        let tiers = TierPayouts {
            delay_2h: 1,
            delay_3h: 1,
            delay_4to5h: 1,
            delay_6h_or_cancelled: 1,
        };

        let req = collateral_requirements(tiers, 1, 0, 0, &[5_000, 5_000]).unwrap();

        assert_eq!(req.insurer_total_required, 1);
        assert_eq!(req.leader_required, 0);
        assert_eq!(req.participant_required.iter().sum::<u64>(), 1);
        assert_eq!(req.participant_required, vec![1, 0]);
    }

    #[test]
    fn collateral_requirements_returns_math_overflow_on_total_required_overflow() {
        let tiers = TierPayouts {
            delay_2h: u64::MAX,
            delay_3h: 0,
            delay_4to5h: 0,
            delay_6h_or_cancelled: 0,
        };

        assert!(matches!(
            collateral_requirements(tiers, 2, 0, 10_000, &[]),
            Err(OpenParamError::MathOverflow)
        ));
    }
}
