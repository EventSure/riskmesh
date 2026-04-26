import { useEffect, useMemo, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { MasterAgreementAccount } from '@/lib/idl/open_parametric';
import { buildCollateralStatus, type CollateralStatus } from '@/lib/collateral';
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
}

function participantId(index: number): string {
  return `participant-${index + 1}`;
}

function rawMicroUsdcToNumber(amount: { toString(): string }): number {
  return Number(amount.toString()) / 1_000_000;
}

async function readTokenBalance(
  connection: ReturnType<typeof useProgram>['connection'],
  tokenAccount: PublicKey | null | undefined,
): Promise<number> {
  if (!tokenAccount || tokenAccount.equals(PublicKey.default)) {
    return 0;
  }

  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return rawMicroUsdcToNumber({ toString: () => balance.value.amount });
  } catch {
    return 0;
  }
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

export function usePoolCollateralStatus(
  masterPDA: PublicKey | null,
  activeWallet?: PublicKey | null,
): UsePoolCollateralStatusResult {
  const { connection, wallet } = useProgram();
  const { account: masterData } = useMasterAgreementAccount(masterPDA);
  const [balances, setBalances] = useState<PoolCollateralBalances | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBalances() {
      if (!masterData) {
        setBalances(null);
        return;
      }

      setBalances(null);

      const [leader, reinsurer, participants] = await Promise.all([
        readTokenBalance(connection, masterData.leaderPoolWallet),
        readTokenBalance(connection, masterData.reinsurerPoolWallet),
        Promise.all(masterData.participants.map((participant) => readTokenBalance(connection, participant.poolWallet))),
      ]);

      if (!cancelled) {
        setBalances({ leader, reinsurer, participants });
      }
    }

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [connection, masterData]);

  const resolvedActiveWallet = activeWallet ?? wallet?.publicKey ?? null;

  const activePartyId = useMemo(
    () => getActivePartyId(masterData, resolvedActiveWallet),
    [masterData, resolvedActiveWallet],
  );

  const status = useMemo(() => {
    if (!masterData) {
      return null;
    }

    const safeBalances = balances ?? {
      leader: 0,
      reinsurer: 0,
      participants: masterData.participants.map(() => 0),
    };

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
          label: 'Leader',
          confirmed: true,
          balance: safeBalances.leader,
        },
        participants: masterData.participants.map((participant, index) => ({
          id: participantId(index),
          label: `Participant ${index + 1}`,
          shareBps: participant.shareBps,
          confirmed: participant.confirmed,
          balance: safeBalances.participants[index] ?? 0,
        })),
        reinsurer: masterData.reinsurer ? {
          label: 'Reinsurer',
          confirmed: masterData.reinsurerConfirmed,
          balance: safeBalances.reinsurer,
        } : undefined,
      });
    } catch {
      return null;
    }
  }, [balances, masterData]);

  return { status, activePartyId, masterData };
}
