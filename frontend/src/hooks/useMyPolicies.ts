import { useEffect, useState, useCallback } from 'react';
import { useProgram } from './useProgram';
import type { MasterPolicyAccount, PolicyAccount } from '@/lib/idl/open_parametric';

export interface MyPolicyRole {
  role: 'leader' | 'partA' | 'partB' | 'rein';
  shareBps: number;
  confirmed: boolean;
}

export interface MyPolicySummary {
  pda: string;
  masterId: string;
  status: number;
  roles: MyPolicyRole[];
  track: 'A' | 'B';
  /** Track B only fields */
  flightNo?: string;
  route?: string;
  payoutAmount?: number;
}

/**
 * Fetch all MasterPolicy accounts where the connected wallet appears
 * as leader, participant, or reinsurer.
 * Fetches all MasterPolicy accounts and filters client-side (MVP-safe).
 */
export function useMyPolicies() {
  const { program, wallet } = useProgram();
  const [policies, setPolicies] = useState<MyPolicySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!program || !wallet?.publicKey) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      const accounts = await prog.account.masterPolicy.all();
      const walletKey = wallet.publicKey;
      const grouped = new Map<string, MyPolicySummary>();

      for (const a of accounts) {
        const acc: MasterPolicyAccount = a.account;
        const pda = a.publicKey.toBase58();
        const masterId = acc.masterId.toString();
        const matchedRoles: MyPolicyRole[] = [];

        // Check leader
        if (acc.leader.equals(walletKey)) {
          matchedRoles.push({ role: 'leader', shareBps: 10000, confirmed: true });
        }

        // Check reinsurer
        if (acc.reinsurer.equals(walletKey)) {
          matchedRoles.push({ role: 'rein', shareBps: acc.reinsurerEffectiveBps, confirmed: acc.reinsurerConfirmed });
        }

        // Check participants
        const participants = acc.participants || [];
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          if (p && p.insurer.equals(walletKey)) {
            matchedRoles.push({ role: i === 0 ? 'partA' : 'partB', shareBps: p.shareBps, confirmed: p.confirmed });
          }
        }

        if (matchedRoles.length > 0) {
          grouped.set(pda, { pda, masterId, status: acc.status, roles: matchedRoles, track: 'A' });
        }
      }

      // Track B: fetch Policy accounts where wallet is leader (offset 16)
      try {
        const trackBAccounts = await prog.account.policy.all([
          { memcmp: { offset: 16, bytes: walletKey.toBase58() } },
        ]);
        for (const a of trackBAccounts) {
          const acc: PolicyAccount = a.account;
          const pda = a.publicKey.toBase58();
          grouped.set(pda, {
            pda,
            masterId: acc.policyId.toString(),
            status: acc.state,
            roles: [{ role: 'leader', shareBps: 10000, confirmed: true }],
            track: 'B',
            flightNo: acc.flightNo,
            route: acc.route,
            payoutAmount: acc.payoutAmount.toNumber() / 1e6,
          });
        }
      } catch {
        // Track B account type may not exist on-chain yet — ignore
      }

      const results = Array.from(grouped.values());
      results.sort((a, b) => Number(b.masterId) - Number(a.masterId));
      setPolicies(results);
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
