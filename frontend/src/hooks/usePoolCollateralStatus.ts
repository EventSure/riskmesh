import { useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useShallow } from 'zustand/react/shallow';
import type { MasterAgreementAccount } from '@/lib/idl/open_parametric';
import { buildCollateralStatus, type CollateralStatus } from '@/lib/collateral';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useMasterAgreementAccount } from './useMasterAgreementAccount';
import { useProgram } from './useProgram';

interface PoolCollateralBalances {
  leader: number;
  reinsurer: number;
  participants: number[];
}

interface UsePoolCollateralStatusResult {
  status: CollateralStatus | null;
  activePartyId?: string;
  masterData: MasterAgreementAccount | null;
  loading: boolean;
  error: string | null;
}

function participantId(index: number): string {
  return `participant-${index + 1}`;
}

function rawMicroUsdcToNumber(amount: { toString(): string }): number {
  return Number(amount.toString()) / 1_000_000;
}

function toEffectiveReinsurerBps(cededRatioBps: number, reinsCommissionBps: number): number {
  return Math.max(0, Math.min(10_000, Math.round((cededRatioBps * (10_000 - reinsCommissionBps)) / 10_000)));
}

export function resolveLeaderLabel(
  selectedMasterAgreementName: string | null | undefined,
  masterAgreementName: string | null | undefined,
  fallbackLabel: string,
): string {
  return selectedMasterAgreementName?.trim() || masterAgreementName?.trim() || fallbackLabel;
}

export function resolvePartyLabel(
  wallet: PublicKey | null | undefined,
  fallbackLabel: string,
  displayNamesByWallet: Record<string, string>,
  storedLabel?: string,
): string {
  const walletLabel = wallet ? displayNamesByWallet[wallet.toBase58()] : undefined;
  return walletLabel?.trim() || storedLabel?.trim() || fallbackLabel;
}

export async function readTokenBalance(
  connection: ReturnType<typeof useProgram>['connection'],
  tokenAccount: PublicKey | null | undefined,
): Promise<number> {
  if (!tokenAccount || tokenAccount.equals(PublicKey.default)) {
    return 0;
  }

  const balance = await connection.getTokenAccountBalance(tokenAccount);
  return rawMicroUsdcToNumber({ toString: () => balance.value.amount });
}

function getActivePartyId(
  masterData: MasterAgreementAccount | null,
  activeWallet: PublicKey | null | undefined,
): string | undefined {
  if (!masterData || !activeWallet) {
    return undefined;
  }

  if (masterData.leader.equals(activeWallet)) {
    return 'leader';
  }

  if (masterData.reinsurer?.equals(activeWallet)) {
    return 'reinsurer';
  }

  const participantIndex = masterData.participants.findIndex((participant) =>
    participant.insurer.equals(activeWallet),
  );

  return participantIndex >= 0 ? participantId(participantIndex) : undefined;
}

function getSimulationActivePartyId(
  role: ReturnType<typeof useProtocolStore.getState>['role'],
  participantCount: number,
  reinsurerEnabled: boolean,
): string | undefined {
  if (role === 'rein') {
    return reinsurerEnabled ? 'reinsurer' : 'leader';
  }

  if (role === 'participant') {
    return participantCount > 0 ? participantId(0) : undefined;
  }

  return 'leader';
}

export function usePoolCollateralStatus(
  masterPDA: PublicKey | null,
  activeWallet?: PublicKey | null,
): UsePoolCollateralStatusResult {
  const { connection, wallet } = useProgram();
  const { account: masterData, loading: masterLoading, error: masterError } = useMasterAgreementAccount(masterPDA);
  const {
    mode,
    role,
    displayNamesByWallet,
    leaderShare,
    collateralClaimCount,
    payoutTiers,
    cededRatioBps,
    reinsCommissionBps,
    poolBalance,
    participants: storedParticipants,
    reinsurer: storedReinsurer,
    selectedMasterAgreementName,
  } = useProtocolStore(
    useShallow((state) => ({
      mode: state.mode,
      role: state.role,
      displayNamesByWallet: state.displayNamesByWallet,
      leaderShare: state.leaderShare,
      collateralClaimCount: state.collateralClaimCount,
      payoutTiers: state.payoutTiers,
      cededRatioBps: state.cededRatioBps,
      reinsCommissionBps: state.reinsCommissionBps,
      poolBalance: state.poolBalance,
      participants: state.participants,
      reinsurer: state.reinsurer,
      selectedMasterAgreementName: state.selectedMasterAgreementName,
    })),
  );
  const [balances, setBalances] = useState<PoolCollateralBalances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'simulation') {
      setBalances(null);
      setBalancesLoading(false);
      setBalancesError(null);
      return;
    }

    let cancelled = false;

    async function loadBalances() {
      if (!masterData) {
        setBalances(null);
        setBalancesLoading(false);
        setBalancesError(null);
        return;
      }

      setBalances(null);
      setBalancesLoading(true);
      setBalancesError(null);

      try {
        const [leader, reinsurer, participants] = await Promise.all([
          readTokenBalance(connection, masterData.leaderPoolWallet),
          readTokenBalance(connection, masterData.reinsurerPoolWallet),
          Promise.all(masterData.participants.map((participant) => readTokenBalance(connection, participant.poolWallet))),
        ]);

        if (!cancelled) {
          setBalances({ leader, reinsurer, participants });
          setBalancesLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setBalances(null);
          setBalancesLoading(false);
          setBalancesError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [connection, masterData, mode]);

  const resolvedActiveWallet = activeWallet ?? wallet?.publicKey ?? null;

  const activePartyId = useMemo(
    () => (
      mode === 'simulation'
        ? getSimulationActivePartyId(role, storedParticipants.length, storedReinsurer.enabled)
        : getActivePartyId(masterData, resolvedActiveWallet)
    ),
    [masterData, mode, resolvedActiveWallet, role, storedParticipants.length, storedReinsurer.enabled],
  );

  const status = useMemo(() => {
    if (mode === 'simulation') {
      const simulationInput = {
        payoutTiers,
        collateralClaimCount,
        reinsurerEffectiveBps: storedReinsurer.enabled
          ? toEffectiveReinsurerBps(cededRatioBps, reinsCommissionBps)
          : 0,
        leaderShareBps: leaderShare * 100,
        leader: {
          label: resolveLeaderLabel(selectedMasterAgreementName, null, 'Leader'),
          confirmed: true,
          balance: 0,
        },
        participants: storedParticipants.map((participant, index) => ({
          id: participantId(index),
          label: participant.name?.trim() || `Participant ${index + 1}`,
          shareBps: participant.share * 100,
          confirmed: participant.confirmed,
          balance: 0,
        })),
        reinsurer: storedReinsurer.enabled ? {
          label: storedReinsurer.name?.trim() || 'Reinsurer',
          confirmed: storedReinsurer.confirmed,
          balance: 0,
        } : undefined,
      };

      try {
        const baselineStatus = buildCollateralStatus(simulationInput);
        const totalFunded = Math.max(0, poolBalance);
        const balanceByPartyId = new Map(
          baselineStatus.parties.map((party) => [
            party.id,
            baselineStatus.totalRequired > 0 ? (totalFunded * party.required) / baselineStatus.totalRequired : 0,
          ]),
        );

        return buildCollateralStatus({
          ...simulationInput,
          leader: {
            ...simulationInput.leader,
            balance: balanceByPartyId.get('leader') ?? 0,
          },
          participants: simulationInput.participants.map((participant) => ({
            ...participant,
            balance: balanceByPartyId.get(participant.id) ?? 0,
          })),
          reinsurer: simulationInput.reinsurer ? {
            ...simulationInput.reinsurer,
            balance: balanceByPartyId.get('reinsurer') ?? 0,
          } : undefined,
        });
      } catch {
        return null;
      }
    }

    if (!masterData) {
      return null;
    }

    if (!balances) {
      return null;
    }

    try {
      return buildCollateralStatus({
        payoutTiers: {
          delay2h: rawMicroUsdcToNumber(masterData.payoutDelay2H),
          delay3h: rawMicroUsdcToNumber(masterData.payoutDelay3H),
          delay4to5h: rawMicroUsdcToNumber(masterData.payoutDelay4To5H),
          delay6hOrCancelled: rawMicroUsdcToNumber(masterData.payoutDelay6HOrCancelled),
        },
        collateralClaimCount: masterData.collateralClaimCount ?? 10,
        reinsurerEffectiveBps: masterData.reinsurerEffectiveBps,
        leaderShareBps: masterData.leaderShareBps,
        leader: {
          label: resolveLeaderLabel(selectedMasterAgreementName, masterData.name, 'Leader'),
          confirmed: true,
          balance: balances.leader,
        },
        participants: masterData.participants.map((participant, index) => ({
          id: participantId(index),
          label: resolvePartyLabel(
            participant.insurer,
            `Participant ${index + 1}`,
            displayNamesByWallet,
            storedParticipants[index]?.name,
          ),
          shareBps: participant.shareBps,
          confirmed: participant.confirmed,
          balance: balances.participants[index] ?? 0,
        })),
        reinsurer: masterData.reinsurer ? {
          label: resolvePartyLabel(
            masterData.reinsurer,
            'Reinsurer',
            displayNamesByWallet,
            storedReinsurer.name,
          ),
          confirmed: masterData.reinsurerConfirmed,
          balance: balances.reinsurer,
        } : undefined,
      });
    } catch {
      return null;
    }
  }, [
    balances,
    cededRatioBps,
    collateralClaimCount,
    displayNamesByWallet,
    leaderShare,
    masterData,
    mode,
    payoutTiers,
    poolBalance,
    reinsCommissionBps,
    selectedMasterAgreementName,
    storedParticipants,
    storedReinsurer,
  ]);

  return {
    status,
    activePartyId,
    masterData,
    loading: mode === 'simulation' ? false : masterLoading || balancesLoading,
    error: mode === 'simulation' ? null : masterError ?? balancesError,
  };
}
