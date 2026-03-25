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
 * Fetch MasterPolicy accounts where the connected wallet appears
 * as leader or reinsurer, plus Track B Policy accounts.
 *
 * Uses memcmp-filtered queries instead of fetching all accounts:
 *   - leader:    offset 16 (discriminator 8 + master_id 8)
 *   - reinsurer: offset 174 (leader 32 + operator 32 + currency_mint 32 +
 *                coverage_start/end 16 + premium 8 + 4 payouts 32 +
 *                ceded/reins/effective bps 6)
 *
 * Note: participant role (inside Vec) cannot be memcmp-filtered.
 * Participants can access their policies via direct portal URL.
 */
// MasterPolicy field offsets (bytes)
const LEADER_OFFSET = 16; // discriminator(8) + master_id(u64=8)
const REINSURER_OFFSET = 174; // leader(32) + operator(32) + currency_mint(32) + 2×i64(16) + 5×u64(40) + 3×u16(6)

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
      const walletKey = wallet.publicKey;
      const walletBase58 = walletKey.toBase58();
      const grouped = new Map<string, MyPolicySummary>();

      // Parallel filtered queries: leader + reinsurer + Track B
      const [leaderAccounts, reinsurerAccounts, trackBAccounts] = await Promise.all([
        prog.account.masterPolicy.all([
          { memcmp: { offset: LEADER_OFFSET, bytes: walletBase58 } },
        ]),
        prog.account.masterPolicy.all([
          { memcmp: { offset: REINSURER_OFFSET, bytes: walletBase58 } },
        ]),
        prog.account.policy.all([
          { memcmp: { offset: 16, bytes: walletBase58 } },
        ]).catch(() => []), // Track B account type may not exist on-chain yet
      ]);

      // Process leader results
      for (const a of leaderAccounts) {
        const acc: MasterPolicyAccount = a.account;
        const pda = a.publicKey.toBase58();
        const roles: MyPolicyRole[] = [{ role: 'leader', shareBps: 10000, confirmed: true }];
        // Also check if reinsurer in same account
        if (acc.reinsurer.equals(walletKey)) {
          roles.push({ role: 'rein', shareBps: acc.reinsurerEffectiveBps, confirmed: acc.reinsurerConfirmed });
        }
        // Check participants in already-fetched accounts
        const participants = acc.participants || [];
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          if (p && p.insurer.equals(walletKey)) {
            roles.push({ role: i === 0 ? 'partA' : 'partB', shareBps: p.shareBps, confirmed: p.confirmed });
          }
        }
        grouped.set(pda, { pda, masterId: acc.masterId.toString(), status: acc.status, roles, track: 'A' });
      }

      // Process reinsurer results (merge with existing if already found as leader)
      for (const a of reinsurerAccounts) {
        const acc: MasterPolicyAccount = a.account;
        const pda = a.publicKey.toBase58();
        const existing = grouped.get(pda);
        if (existing) {
          // Already added via leader query — roles already merged above
          continue;
        }
        const roles: MyPolicyRole[] = [{ role: 'rein', shareBps: acc.reinsurerEffectiveBps, confirmed: acc.reinsurerConfirmed }];
        // Check participants
        const participants = acc.participants || [];
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          if (p && p.insurer.equals(walletKey)) {
            roles.push({ role: i === 0 ? 'partA' : 'partB', shareBps: p.shareBps, confirmed: p.confirmed });
          }
        }
        grouped.set(pda, { pda, masterId: acc.masterId.toString(), status: acc.status, roles, track: 'A' });
      }

      // Process Track B results
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
