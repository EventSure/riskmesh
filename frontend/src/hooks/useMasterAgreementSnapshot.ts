import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useShallow } from 'zustand/react/shallow';
import type { CollateralStatus } from '@/lib/collateral';
import type { MasterAgreementAccount } from '@/lib/idl/open_parametric';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useFlightPolicies, type FlightPolicyWithKey } from './useFlightPolicies';
import { useMasterAgreementAccount, type SharedMasterAgreementAccountState } from './useMasterAgreementAccount';
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

export function buildSimulationMasterAgreementSnapshot({
  agreementName,
  totalPremiumInflow,
  totalClaimOutflow,
  collateralStatus,
}: {
  agreementName: string;
  totalPremiumInflow: number;
  totalClaimOutflow: number;
  collateralStatus: CollateralStatus | null;
}): MasterAgreementSnapshot | null {
  if (!collateralStatus) {
    return null;
  }

  const blockers = collateralStatus.parties
    .filter((party) => party.state !== 'ready')
    .map((party) => party.id);
  const blockerLabels = collateralStatus.parties
    .filter((party) => party.state !== 'ready')
    .map((party) => party.label);

  return {
    agreementName,
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

export function useMasterAgreementSnapshot(
  masterPda: PublicKey | null,
  sharedMasterState?: SharedMasterAgreementAccountState,
) {
  const { mode, selectedMasterAgreementName, totalPremium, totalClaim } = useProtocolStore(
    useShallow((state) => ({
      mode: state.mode,
      selectedMasterAgreementName: state.selectedMasterAgreementName,
      totalPremium: state.totalPremium,
      totalClaim: state.totalClaim,
    })),
  );
  const resolvedMasterState = useMasterAgreementAccount(sharedMasterState ? null : masterPda);
  const masterData = sharedMasterState?.masterData ?? resolvedMasterState.account;
  const masterLoading = sharedMasterState?.masterLoading ?? resolvedMasterState.loading;
  const masterError = sharedMasterState?.masterError ?? resolvedMasterState.error;
  const { status, activePartyId, loading: collateralLoading, error: collateralError } = usePoolCollateralStatus(
    masterPda,
    undefined,
    { masterData, masterLoading, masterError },
  );
  const { policies, loading: policiesLoading, error: policiesError } = useFlightPolicies(masterPda);
  const policyStatus: MasterAgreementPolicyStatus =
    mode === 'simulation' ? 'ready' : policiesLoading ? 'loading' : policiesError ? 'error' : 'ready';
  const readinessLoading = mode === 'simulation' ? false : masterLoading || collateralLoading;
  const readinessError = mode === 'simulation' ? null : masterError ?? collateralError;

  const snapshot = useMemo(
    () => (
      mode === 'simulation'
        ? buildSimulationMasterAgreementSnapshot({
          agreementName: selectedMasterAgreementName?.trim() || '',
          totalPremiumInflow: totalPremium,
          totalClaimOutflow: totalClaim,
          collateralStatus: status,
        })
        : buildMasterAgreementSnapshot(masterData, policies, status)
    ),
    [masterData, mode, policies, selectedMasterAgreementName, status, totalClaim, totalPremium],
  );

  return {
    snapshot,
    status,
    activePartyId,
    masterData,
    loading: readinessLoading,
    error: readinessError,
    policyStatus,
    policyError: mode === 'simulation' ? null : policiesError,
  };
}
