import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import type { PolicyAccount, ClaimAccount } from '@/lib/idl/open_parametric';
import type { PolicyWithKey, ClaimWithKey } from '@/store/useProtocolStore';

/**
 * Fetch all Track B Policy accounts for a given leader.
 * Policy.leader is at offset 16: discriminator(8) + policy_id(u64=8).
 * Also fetches associated Claim accounts.
 */
export function usePolicies(
  leaderPubkey: PublicKey | null,
  options?: {
    onStatusChange?: (policy: PolicyWithKey, prevState: number, newState: number) => void;
    pollInterval?: number;
  },
) {
  const { program, connection } = useProgram();
  const [policies, setPolicies] = useState<PolicyWithKey[]>([]);
  const [claims, setClaims] = useState<ClaimWithKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevStateRef = useRef<Map<string, number>>(new Map());
  const onStatusChange = options?.onStatusChange;
  const pollInterval = options?.pollInterval ?? 60_000;

  const fetchPolicies = useCallback(async () => {
    if (!program || !leaderPubkey || !connection) {
      setPolicies([]);
      setClaims([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // Fetch Policy accounts filtered by leader (offset 16)
      const accounts = await prog.account.policy.all([
        {
          memcmp: {
            offset: 16, // discriminator(8) + policy_id(u64=8)
            bytes: leaderPubkey.toBase58(),
          },
        },
      ]);

      const mapped: PolicyWithKey[] = accounts.map(
        (a: { publicKey: PublicKey; account: PolicyAccount }) => ({
          publicKey: a.publicKey,
          account: a.account,
        }),
      );

      // Sort by policyId ascending
      mapped.sort((a, b) => {
        const aId = a.account.policyId.toNumber();
        const bId = b.account.policyId.toNumber();
        return aId - bId;
      });

      // Status change detection
      const prevMap = prevStateRef.current;
      if (prevMap.size > 0 && onStatusChange) {
        for (const p of mapped) {
          const key = p.publicKey.toBase58();
          const prev = prevMap.get(key);
          if (prev !== undefined && prev !== p.account.state) {
            onStatusChange(p, prev, p.account.state);
          }
        }
      }
      prevStateRef.current = new Map(
        mapped.map(p => [p.publicKey.toBase58(), p.account.state]),
      );

      setPolicies(mapped);

      // Fetch Claim accounts per policy using memcmp (offset 8: discriminator(8) → policy pubkey)
      if (mapped.length > 0) {
        const allClaims: ClaimWithKey[] = [];
        for (const p of mapped) {
          const claimAccounts = await prog.account.claim.all([
            {
              memcmp: {
                offset: 8, // discriminator(8) → policy field
                bytes: p.publicKey.toBase58(),
              },
            },
          ]);
          for (const a of claimAccounts) {
            allClaims.push({
              publicKey: a.publicKey,
              account: a.account as ClaimAccount,
            });
          }
        }
        setClaims(allClaims);
      } else {
        setClaims([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [program, leaderPubkey, connection, onStatusChange]);

  // Initial fetch
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // WebSocket subscriptions for real-time updates
  const policyKeys = useMemo(
    () => policies.map(p => p.publicKey.toBase58()).join(','),
    [policies],
  );

  useEffect(() => {
    if (!connection || policies.length === 0) return;

    const subscriptionIds = policies.map(p =>
      connection.onAccountChange(
        p.publicKey,
        () => { fetchPolicies(); },
        'confirmed',
      ),
    );

    return () => {
      subscriptionIds.forEach(id => connection.removeAccountChangeListener(id));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, policyKeys, fetchPolicies]);

  // Polling for new Policy accounts
  useEffect(() => {
    if (!leaderPubkey || pollInterval <= 0) return;
    const interval = setInterval(() => { fetchPolicies(); }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchPolicies, leaderPubkey, pollInterval]);

  return { policies, claims, loading, error, refetch: fetchPolicies };
}
