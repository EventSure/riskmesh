import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { BACKEND_URL } from '@/lib/constants';

export type ParticipantRole = 'leader' | 'participant' | 'rein' | null;

export interface ParticipantInfo {
  role: ParticipantRole;
  shareBps: number;
  confirmed: boolean;
  participantIndex: number;
}

interface BackendMasterPolicy {
  leader: string;
  leader_share_bps: number;
  reinsurer: string | null;
  reinsurer_effective_bps: number;
  reinsurer_confirmed: boolean;
  participants: Array<{ insurer: string; share_bps: number; confirmed: boolean }>;
}

/**
 * Detect all roles the connected wallet holds in a MasterPolicy.
 * Uses backend API instead of direct RPC.
 */
export function useParticipantRole(masterAgreementPDA: PublicKey | null) {
  const { publicKey } = useWallet();
  const [roles, setRoles] = useState<ParticipantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const pda = masterAgreementPDA?.toBase58() ?? null;
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
          found.push({ role: 'leader', shareBps: account.leader_share_bps, confirmed: true, participantIndex: -1 });
        }
        if (account.reinsurer === walletKey) {
          found.push({
            role: 'rein',
            shareBps: account.reinsurer_effective_bps,
            confirmed: account.reinsurer_confirmed,
            participantIndex: -1,
          });
        }
        for (let j = 0; j < account.participants.length; j++) {
          const p = account.participants[j]!;
          if (p.insurer === walletKey) {
            found.push({
              role: 'participant',
              shareBps: p.share_bps,
              confirmed: p.confirmed,
              participantIndex: j,
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
