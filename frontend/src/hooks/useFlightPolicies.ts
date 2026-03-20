import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
export function useFlightPolicies(
  masterPolicyPDA: PublicKey | null,
  options?: {
    onStatusChange?: (fp: FlightPolicyWithKey, prevStatus: number, newStatus: number) => void;
    pollInterval?: number;
  },
) {
  const { program, connection } = useProgram();
  const [policies, setPolicies] = useState<FlightPolicyWithKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevStatusRef = useRef<Map<number, number>>(new Map());
  const onStatusChange = options?.onStatusChange;
  const pollInterval = options?.pollInterval ?? 60_000;

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

      // Status diff detection
      const prevMap = prevStatusRef.current;
      if (prevMap.size > 0 && onStatusChange) {
        for (const fp of mapped) {
          const id = fp.account.childPolicyId.toNumber();
          const prevStatus = prevMap.get(id);
          const newStatus = fp.account.status;
          if (prevStatus !== undefined && prevStatus !== newStatus) {
            onStatusChange(fp, prevStatus, newStatus);
          }
        }
      }
      prevStatusRef.current = new Map(
        mapped.map(fp => [fp.account.childPolicyId.toNumber(), fp.account.status])
      );

      setPolicies(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [program, masterPolicyPDA, connection, onStatusChange]);

  // Initial fetch
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Stable key for WebSocket subscription dependencies
  const policyKeys = useMemo(
    () => policies.map(p => p.publicKey.toBase58()).join(','),
    [policies],
  );

  // Subscribe to individual FlightPolicy account changes (real-time)
  useEffect(() => {
    if (!connection || policies.length === 0) return;

    const subscriptionIds = policies.map(fp =>
      connection.onAccountChange(
        fp.publicKey,
        () => { fetchPolicies(); },
        'confirmed',
      ),
    );

    return () => {
      subscriptionIds.forEach(id =>
        connection.removeAccountChangeListener(id),
      );
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, policyKeys, fetchPolicies]);

  // Long-interval polling for discovering new FlightPolicy accounts
  useEffect(() => {
    if (!masterPolicyPDA || pollInterval <= 0) return;

    const interval = setInterval(() => {
      fetchPolicies();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchPolicies, masterPolicyPDA, pollInterval]);

  return { policies, loading, error, refetch: fetchPolicies };
}
