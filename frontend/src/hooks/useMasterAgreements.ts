import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MasterAgreementSummary } from '@/store/useProtocolStore';
import { BACKEND_URL } from '@/lib/constants';

interface BackendMasterPolicyItem {
  pubkey: string;
  master_id: number;
  leader: string;
  reinsurer: string;
  status: number;
  status_label: string;
  coverage_end_ts: number;
  participants: Array<{ insurer: string; share_bps: number; confirmed: boolean }>;
}

function detectRole(m: BackendMasterPolicyItem, wallet: string): MasterAgreementSummary['myRole'] {
  if (m.leader === wallet) return 'leader';
  if (m.reinsurer === wallet) return 'rein';
  const nonLeaders = m.participants.filter(p => p.insurer !== m.leader);
  const idx = nonLeaders.findIndex(p => p.insurer === wallet);
  if (idx === 0) return 'partA';
  if (idx === 1) return 'partB';
  return undefined;
}

export function useMasterAgreements() {
  const { publicKey } = useWallet();
  const [policies, setPolicies] = useState<MasterAgreementSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!publicKey) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    try {
      const walletKey = publicKey.toBase58();
      const url = `${BACKEND_URL}/api/master-policies?wallet=${walletKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { master_policies: BackendMasterPolicyItem[] } = await res.json();

      const mapped: MasterAgreementSummary[] = json.master_policies.map((m) => ({
        pda: m.pubkey,
        masterId: String(m.master_id),
        status: m.status,
        statusLabel: m.status_label,
        coverageEndTs: m.coverage_end_ts,
        myRole: detectRole(m, walletKey),
      }));

      mapped.sort((a, b) => Number(b.masterId) - Number(a.masterId));
      setPolicies(mapped);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return { policies, loading, refetch: fetchPolicies };
}
