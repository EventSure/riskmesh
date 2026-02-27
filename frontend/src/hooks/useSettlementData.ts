import { useMemo } from 'react';
import { useProtocolStore } from '@/store/useProtocolStore';

export function useSettlementData() {
  const claims = useProtocolStore(s => s.claims);
  const premiumPerPolicy = useProtocolStore(s => s.premiumPerPolicy);
  const shares = useProtocolStore(s => s.shares);
  const cededRatioBps = useProtocolStore(s => s.cededRatioBps);
  const reinsCommissionBps = useProtocolStore(s => s.reinsCommissionBps);

  return useMemo(() => {
    const settledClaims = claims.filter(c => c.status === 'settled');
    const pendingClaims = claims.filter(c => c.status === 'claimable');

    const settledContractIds = new Set(settledClaims.map(c => c.contractId));
    const settledTotalPremium = settledContractIds.size * premiumPerPolicy;
    const settledTotalClaim = settledClaims.reduce((s, c) => s + c.payout, 0);

    const lS = shares.leader / 100, aS = shares.partA / 100, bS = shares.partB / 100;
    const ceded = cededRatioBps / 10000;
    const commRate = reinsCommissionBps / 10000;
    const reinsEff = ceded * (1 - commRate);

    const settledAcc = {
      leaderPrem: settledTotalPremium * lS * (1 - reinsEff),
      partAPrem: settledTotalPremium * aS * (1 - reinsEff),
      partBPrem: settledTotalPremium * bS * (1 - reinsEff),
      reinPrem: settledTotalPremium * reinsEff,
      leaderClaim: settledClaims.reduce((s, c) => s + c.lNet, 0),
      partAClaim: settledClaims.reduce((s, c) => s + c.aNet, 0),
      partBClaim: settledClaims.reduce((s, c) => s + c.bNet, 0),
      reinClaim: settledClaims.reduce((s, c) => s + c.rNet, 0),
    };

    return {
      settledTotalPremium,
      settledTotalClaim,
      settledAcc,
      pendingClaims,
      settledCount: settledClaims.length,
      pendingCount: pendingClaims.length,
    };
  }, [claims, premiumPerPolicy, shares, cededRatioBps, reinsCommissionBps]);
}
