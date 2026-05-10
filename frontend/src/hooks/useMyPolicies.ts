import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from './useProgram';
import type { PolicyAccount } from '@/lib/idl/open_parametric';
import { BACKEND_URL } from '@/lib/constants';

export interface MyPolicyRole {
  role: 'leader' | 'partA' | 'partB' | 'rein';
  shareBps: number;
  confirmed: boolean;
}

export interface MyPolicySummary {
  pda: string;
  masterId: string;
  status: number;
  statusLabel: string;
  roles: MyPolicyRole[];
  track: 'A' | 'B';
  /** Coverage end timestamp (Track A only) */
  coverageEndTs?: number;
  /** Track B only fields */
  flightNo?: string;
  route?: string;
  payoutAmount?: number;
}

interface BackendMasterAgreementFull {
  pubkey: string;
  master_id: number;
  leader: string;
  operator: string;
  status: number;
  status_label: string;
  reinsurer: string;
  reinsurer_confirmed: boolean;
  reinsurer_effective_bps: number;
  coverage_end_ts: number;
  participants: Array<{
    insurer: string;
    share_bps: number;
    confirmed: boolean;
  }>;
}

/**
 * Fetch policies where the connected wallet appears as leader, reinsurer,
 * or participant. Uses backend API for Master Agreements (Track A) and
 * direct Solana RPC for Track B Policy accounts.
 */
export function useMyPolicies() {
  const { publicKey } = useWallet();
  const { program, wallet } = useProgram();
  const [policies, setPolicies] = useState<MyPolicySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!publicKey) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    try {
      const walletBase58 = publicKey.toBase58();
      const grouped = new Map<string, MyPolicySummary>();

      // Fetch only master policies involving this wallet (server-side filter
      // across leader / reinsurer / participants)
      const res = await fetch(
        `${BACKEND_URL}/api/master-agreements?wallet=${encodeURIComponent(walletBase58)}`,
      );
      if (res.ok) {
        const json: { master_agreements: BackendMasterAgreementFull[] } = await res.json();

        for (const mp of json.master_agreements) {
          const roles: MyPolicyRole[] = [];

          // Check leader
          if (mp.leader === walletBase58) {
            roles.push({ role: 'leader', shareBps: 10000, confirmed: true });
          }

          // Check reinsurer
          if (mp.reinsurer === walletBase58) {
            roles.push({
              role: 'rein',
              shareBps: mp.reinsurer_effective_bps,
              confirmed: mp.reinsurer_confirmed,
            });
          }

          // Check participants (skip leader — already handled above)
          const nonLeaders = mp.participants.filter(p => p.insurer !== mp.leader);
          for (let i = 0; i < nonLeaders.length; i++) {
            const p = nonLeaders[i]!;
            if (p.insurer === walletBase58) {
              roles.push({
                role: i === 0 ? 'partA' : 'partB',
                shareBps: p.share_bps,
                confirmed: p.confirmed,
              });
            }
          }

          if (roles.length > 0) {
            grouped.set(mp.pubkey, {
              pda: mp.pubkey,
              masterId: String(mp.master_id),
              status: mp.status,
              statusLabel: mp.status_label,
              roles,
              track: 'A',
              coverageEndTs: mp.coverage_end_ts,
            });
          }
        }
      }

      // Track B: direct RPC (not available via backend API)
      if (program && wallet?.publicKey) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prog = program as any;
          const trackBAccounts = await prog.account.policy.all([
            { memcmp: { offset: 16, bytes: walletBase58 } },
          ]);

          for (const a of trackBAccounts) {
            const acc: PolicyAccount = a.account;
            const pda = a.publicKey.toBase58();
            grouped.set(pda, {
              pda,
              masterId: acc.policyId.toString(),
              status: acc.state,
              statusLabel: '',
              roles: [{ role: 'leader', shareBps: 10000, confirmed: true }],
              track: 'B',
              flightNo: acc.flightNo,
              route: acc.route,
              payoutAmount: acc.payoutAmount.toNumber() / 1e6,
            });
          }
        } catch {
          // Track B account type may not exist on-chain yet
        }
      }

      const results = Array.from(grouped.values());
      results.sort((a, b) => Number(b.masterId) - Number(a.masterId));
      setPolicies(results);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey, program, wallet]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, refetch: fetchPolicies };
}
