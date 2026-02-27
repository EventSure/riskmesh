import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import type { FlightPolicyAccount } from '@/lib/idl/open_parametric';

export interface FlightPolicyWithKey {
  publicKey: PublicKey;
  account: FlightPolicyAccount;
}

/**
 * Fetch all FlightPolicy accounts belonging to a specific MasterPolicy.
 * Uses getProgramAccounts with a memcmp filter on the master field.
 */
export function useFlightPolicies(masterPolicyPDA: PublicKey | null) {
  const { program, connection } = useProgram();
  const [policies, setPolicies] = useState<FlightPolicyWithKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    if (!program || !masterPolicyPDA || !connection) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      // FlightPolicy has `master: Pubkey` as the 2nd field (after discriminator + child_policy_id)
      // Discriminator (8 bytes) + child_policy_id (8 bytes) = offset 16 for master field
      const accounts = await prog.account.flightPolicy.all([
        {
          memcmp: {
            offset: 16, // 8 (discriminator) + 8 (child_policy_id u64)
            bytes: masterPolicyPDA.toBase58(),
          },
        },
      ]);

      const mapped: FlightPolicyWithKey[] = accounts.map(
        (a: { publicKey: PublicKey; account: FlightPolicyAccount }) => ({
          publicKey: a.publicKey,
          account: a.account,
        }),
      );

      // Sort by child_policy_id ascending
      mapped.sort((a, b) => {
        const aId = a.account.childPolicyId.toNumber();
        const bId = b.account.childPolicyId.toNumber();
        return aId - bId;
      });

      setPolicies(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [program, masterPolicyPDA, connection]);

  // Initial fetch
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, error, refetch: fetchPolicies };
}
