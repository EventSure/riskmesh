import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { BACKEND_URL } from '@/lib/constants';

export type ParticipantRole = 'leader' | 'partA' | 'partB' | 'rein' | null;

export interface ParticipantInfo {
  role: ParticipantRole;
  shareBps: number;
  confirmed: boolean;
  participantIndex: number;
}

interface BackendMasterPolicy {
  leader: string;
  reinsurer: string;
  reinsurer_effective_bps: number;
  reinsurer_confirmed: boolean;
  participants: Array<{ insurer: string; share_bps: number; confirmed: boolean }>;
}

/**
 * Detect all roles the connected wallet holds in a MasterPolicy.
 * Uses backend API instead of direct RPC.
 */
export function useParticipantRole(masterPolicyPDA: PublicKey | null) {
  const { publicKey } = useWallet();
  const [roles, setRoles] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const pda = masterPolicyPDA?.toBase58() ?? null;
  const walletKey = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!pda || !walletKey) {
      setRoles([]);
      return;
    }

    let cancelled = false;

    async function detect() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BACKEND_URL}/api/master-policies/${pda}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const account: BackendMasterPolicy = await res.json();
        const found: ParticipantInfo[] = [];

        if (account.leader === walletKey) {
          found.push({ role: 'leader', shareBps: 10000, confirmed: true, participantIndex: -1 });
        }
        if (account.reinsurer === walletKey) {
          found.push({
            role: 'rein',
            shareBps: account.reinsurer_effective_bps,
            confirmed: account.reinsurer_confirmed,
            participantIndex: -1,
          });
        }
        // participants[0] = leader (already handled above), [1] = partA, [2] = partB
        // non-leader 참여자만 순서대로 partA/partB 역할 부여
        const nonLeaders = account.participants
          .map((p, i) => ({ ...p, originalIndex: i }))
          .filter(p => p.insurer !== account.leader);
        for (let j = 0; j < nonLeaders.length; j++) {
          const p = nonLeaders[j]!;
          if (p.insurer === walletKey) {
            found.push({
              role: j === 0 ? 'partA' : 'partB',
              shareBps: p.share_bps,
              confirmed: p.confirmed,
              participantIndex: p.originalIndex,
            });
          }
        }

        if (!cancelled) setRoles(found);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setRoles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detect();
    return () => { cancelled = true; };
  }, [pda, walletKey, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  // Backward-compatible: primary role = first found (leader > rein > participant)
  const info = roles.length > 0 ? roles[0] : null;

  return { info, roles, loading, error, refresh };
}
