import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MasterPolicySummary } from '@/store/useProtocolStore';
import { BACKEND_URL } from '@/lib/constants';

interface BackendMasterPolicyItem {
  pubkey: string;
  master_id: number;
  status: number;
  coverage_end_ts: number;
}

export function useMasterPolicies() {
  const { publicKey } = useWallet();
  const [policies, setPolicies] = useState<MasterPolicySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPolicies = useCallback(async () => {
    if (!publicKey) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    try {
      const url = `${BACKEND_URL}/api/master-policies?leader=${publicKey.toBase58()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { master_policies: BackendMasterPolicyItem[] } = await res.json();

      const mapped: MasterPolicySummary[] = json.master_policies.map((m) => ({
        pda: m.pubkey,
        masterId: String(m.master_id),
        status: m.status,
        coverageEndTs: m.coverage_end_ts,
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
