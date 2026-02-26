use crate::errors::OpenParamError;

pub const BPS_DENOM: u64 = 10_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TierPayouts {
    pub delay_2h: u64,
    pub delay_3h: u64,
    pub delay_4to5h: u64,
    pub delay_6h_or_cancelled: u64,
}

pub fn effective_reinsurer_bps(ceded_ratio_bps: u16, commission_bps: u16) -> Result<u16, OpenParamError> {
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
    if (120..180).contains(&delay_minutes) {
        return tiers.delay_2h;
    }
    0
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

    if let Some(first) = out.first_mut() {
        let rem = total
            .checked_sub(allocated)
            .ok_or(OpenParamError::MathOverflow)?;
        *first = first
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
}
