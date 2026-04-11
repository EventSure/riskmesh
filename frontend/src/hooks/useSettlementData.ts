import { useMemo } from 'react';
import { useProtocolStore, type Acc } from '@/store/useProtocolStore';

export function useSettlementData() {
  const claims = useProtocolStore(s => s.claims);
  const premiumPerPolicy = useProtocolStore(s => s.premiumPerPolicy);
  const leaderShare = useProtocolStore(s => s.leaderShare);
  const participants = useProtocolStore(s => s.participants);
  const reinsurerEnabled = useProtocolStore(s => s.reinsurer.enabled);
  const cededRatioBps = useProtocolStore(s => s.cededRatioBps);
  const reinsCommissionBps = useProtocolStore(s => s.reinsCommissionBps);

  return useMemo(() => {
    const settledClaims = claims.filter(c => c.status === 'settled');
    const pendingClaims = claims.filter(c => c.status === 'claimable');

    const settledContractIds = new Set(settledClaims.map(c => c.contractId));
    const settledTotalPremium = settledContractIds.size * premiumPerPolicy;
    const settledTotalClaim = settledClaims.reduce((s, c) => s + c.payout, 0);

    const lS = leaderShare / 100;
    const ceded = cededRatioBps / 10000;
    const commRate = reinsCommissionBps / 10000;
    const reinsEff = reinsurerEnabled ? ceded * (1 - commRate) : 0;

    const settledAcc: Acc = {
      leaderPrem: settledTotalPremium * lS * (1 - reinsEff),
      participantPrems: participants.map(p => settledTotalPremium * (p.share / 100) * (1 - reinsEff)),
      reinPrem: settledTotalPremium * reinsEff,
      leaderClaim: settledClaims.reduce((s, c) => s + c.lNet, 0),
      participantClaims: participants.map((_, i) => settledClaims.reduce((s, c) => s + (c.participantNets[i] ?? 0), 0)),
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
  }, [claims, premiumPerPolicy, leaderShare, participants, reinsurerEnabled, cededRatioBps, reinsCommissionBps]);
}
