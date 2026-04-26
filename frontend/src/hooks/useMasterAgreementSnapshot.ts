import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { CollateralStatus } from '@/lib/collateral';
import type { MasterAgreementAccount } from '@/lib/idl/open_parametric';
import { useFlightPolicies, type FlightPolicyWithKey } from './useFlightPolicies';
import { useMasterAgreementAccount } from './useMasterAgreementAccount';
import { usePoolCollateralStatus } from './usePoolCollateralStatus';

const MICRO_USDC_FACTOR = 1_000_000;

export interface MasterAgreementSnapshot {
  agreementName: string;
  totalPremiumInflow: number;
  totalClaimOutflow: number;
  netBalance: number;
  totalRequired: number;
  totalFunded: number;
  totalDeficit: number;
  readinessPct: number;
  blockers: string[];
  blockerLabels: string[];
  aggregateReady: boolean;
}

export type MasterAgreementPolicyStatus = 'loading' | 'error' | 'ready';

function rawMicroUsdcToDisplay(amount: { toString(): string }): number {
  return Number(amount.toString()) / MICRO_USDC_FACTOR;
}

export function buildMasterAgreementSnapshot(
  master: MasterAgreementAccount | null,
  policies: FlightPolicyWithKey[],
  collateralStatus: CollateralStatus | null,
): MasterAgreementSnapshot | null {
  if (!master || !collateralStatus) {
    return null;
  }

  const totalPremiumInflow = policies.reduce(
    (sum, policy) => sum + rawMicroUsdcToDisplay(policy.account.premiumPaid),
    0,
  );
  const totalClaimOutflow = policies.reduce(
    (sum, policy) => sum + rawMicroUsdcToDisplay(policy.account.payoutAmount),
    0,
  );
  const blockers = collateralStatus.parties
    .filter((party) => party.state !== 'ready')
    .map((party) => party.id);
  const blockerLabels = collateralStatus.parties
    .filter((party) => party.state !== 'ready')
    .map((party) => party.label);

  return {
    agreementName: master.name?.trim() ?? '',
    totalPremiumInflow,
    totalClaimOutflow,
    netBalance: totalPremiumInflow - totalClaimOutflow,
    totalRequired: collateralStatus.totalRequired,
    totalFunded: collateralStatus.totalFunded,
    totalDeficit: collateralStatus.totalDeficit,
    readinessPct: collateralStatus.totalHealthPct,
    blockers,
    blockerLabels,
    aggregateReady: collateralStatus.aggregateReady,
  };
}

export function useMasterAgreementSnapshot(masterPda: PublicKey | null) {
  const { account: masterData, loading: masterLoading, error: masterError } = useMasterAgreementAccount(masterPda);
  const { status, activePartyId } = usePoolCollateralStatus(masterPda);
  const { policies, loading: policiesLoading, error: policiesError } = useFlightPolicies(masterPda);
  const policyStatus: MasterAgreementPolicyStatus = policiesLoading ? 'loading' : policiesError ? 'error' : 'ready';

  const snapshot = useMemo(
    () => buildMasterAgreementSnapshot(masterData, policies, status),
    [masterData, policies, status],
  );

  return {
    snapshot,
    status,
    activePartyId,
    masterData,
    loading: masterLoading || policiesLoading,
    error: masterError ?? policiesError,
    policyStatus,
  };
}
