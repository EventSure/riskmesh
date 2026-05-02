import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MasterAgreementSummary } from '@/store/useProtocolStore';
import { BACKEND_URL } from '@/lib/constants';

interface BackendMasterAgreementItem {
  pubkey: string;
  master_id: number;
  name: string;
  leader: string;
  operator: string;
  reinsurer: string;
  status: number;
  status_label: string;
  coverage_end_ts: number;
  participants: Array<{ insurer: string; share_bps: number; confirmed: boolean }>;
}

function detectRole(m: BackendMasterAgreementItem, wallet: string): MasterAgreementSummary['myRole'] {
  if (m.leader === wallet) return 'leader';
  if (m.operator === wallet) return 'operator';
  if (m.reinsurer === wallet) return 'rein';
  const nonLeaders = m.participants.filter(p => p.insurer !== m.leader);
  if (nonLeaders.some(p => p.insurer === wallet)) return 'participant';
  return undefined;
}

export function useMasterAgreements() {
  const { publicKey } = useWallet();
  const [policies, setPolicies] = useState<MasterAgreementSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async (): Promise<boolean> => {
    if (!publicKey) {
      setPolicies([]);
      return false;
    }

    setLoading(true);
    try {
      const walletKey = publicKey.toBase58();
      const url = `${BACKEND_URL}/api/master-agreements?wallet=${walletKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { master_agreements: BackendMasterAgreementItem[] } = await res.json();

      const mapped: MasterAgreementSummary[] = json.master_agreements.map((m) => ({
        pda: m.pubkey,
        masterId: String(m.master_id),
        name: m.name,
        status: m.status,
        statusLabel: m.status_label,
        coverageEndTs: m.coverage_end_ts,
        myRole: detectRole(m, walletKey),
      }));

      mapped.sort((a, b) => Number(b.masterId) - Number(a.masterId));
      setPolicies(mapped);
      return true;
    } catch {
      setPolicies([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, refetch: fetchPolicies };
}
