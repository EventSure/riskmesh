import { useEffect, useState, useCallback } from 'react';
import { useProgram } from './useProgram';
import type { MasterPolicySummary } from '@/store/useProtocolStore';

/**
 * Fetch all MasterPolicy accounts where the connected wallet is the leader.
 * Uses getProgramAccounts with a memcmp filter on the leader field.
 * MasterPolicy layout: discriminator(8) + master_id(8) = offset 16 for leader field.
 */
export function useMasterPolicies() {
  const { program, wallet } = useProgram();
  const [policies, setPolicies] = useState<MasterPolicySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!program || !wallet) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      const accounts = await prog.account.masterPolicy.all([
        {
          memcmp: {
            offset: 16, // discriminator(8) + master_id u64(8)
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: MasterPolicySummary[] = accounts.map((a: any) => ({
        pda: a.publicKey.toBase58(),
        masterId: a.account.masterId.toString(),
        status: a.account.status,
        coverageEndTs: a.account.coverageEndTs.toNumber(),
      }));

      // Most recent coverage end date first
      mapped.sort((a, b) => b.coverageEndTs - a.coverageEndTs);
      setPolicies(mapped);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [program, wallet]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, refetch: fetchPolicies };
}
