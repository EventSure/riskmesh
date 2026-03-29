import { useEffect, useState, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { MasterPolicyAccount } from '@/lib/idl/open_parametric';
import { BACKEND_URL } from '@/lib/constants';

/** Minimal BN-like wrapper for number fields the store calls .toNumber() on */
const fakeBN = (n: number) => ({
  toNumber: () => n,
  toString: () => String(n),
});

interface BackendMasterPolicy {
  pubkey: string;
  master_id: number;
  status: number;
  participants: Array<{
    insurer: string;
    share_bps: number;
    confirmed: boolean;
    pool_wallet: string;
    deposit_wallet: string;
  }>;
  reinsurer_confirmed: boolean;
  ceded_ratio_bps: number;
  reins_commission_bps: number;
  reinsurer_effective_bps: number;
  premium_per_policy: number;
  payout_delay_2h: number;
  payout_delay_3h: number;
  payout_delay_4to5h: number;
  payout_delay_6h_or_cancelled: number;
  coverage_end_ts: number;
  coverage_start_ts: number;
  leader: string;
  operator: string;
  currency_mint: string;
  reinsurer: string;
  reinsurer_pool_wallet: string;
  reinsurer_deposit_wallet: string;
  leader_deposit_wallet: string;
  created_at: number;
  bump: number;
}

function toMasterPolicyAccount(data: BackendMasterPolicy): MasterPolicyAccount {
  const SYSTEM_PROGRAM = '11111111111111111111111111111111';
  const safePubkey = (s: string | undefined | null) =>
    new PublicKey(s && s.length > 0 ? s : SYSTEM_PROGRAM);

  return {
    masterId: fakeBN(data.master_id) as unknown as import('@coral-xyz/anchor').BN,
    leader: safePubkey(data.leader),
    operator: safePubkey(data.operator),
    currencyMint: safePubkey(data.currency_mint),
    coverageStartTs: fakeBN(data.coverage_start_ts) as unknown as import('@coral-xyz/anchor').BN,
    coverageEndTs: fakeBN(data.coverage_end_ts) as unknown as import('@coral-xyz/anchor').BN,
    premiumPerPolicy: fakeBN(data.premium_per_policy) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay2h: fakeBN(data.payout_delay_2h) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay3h: fakeBN(data.payout_delay_3h) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay4to5h: fakeBN(data.payout_delay_4to5h) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay6hOrCancelled: fakeBN(
      data.payout_delay_6h_or_cancelled,
    ) as unknown as import('@coral-xyz/anchor').BN,
    cededRatioBps: data.ceded_ratio_bps,
    reinsCommissionBps: data.reins_commission_bps,
    reinsurerEffectiveBps: data.reinsurer_effective_bps,
    reinsurer: safePubkey(data.reinsurer),
    reinsurerConfirmed: data.reinsurer_confirmed,
    reinsurerPoolWallet: safePubkey(data.reinsurer_pool_wallet),
    reinsurerDepositWallet: safePubkey(data.reinsurer_deposit_wallet),
    leaderDepositWallet: safePubkey(data.leader_deposit_wallet),
    participants: data.participants.map((p) => ({
      insurer: safePubkey(p.insurer),
      shareBps: p.share_bps,
      confirmed: p.confirmed,
      poolWallet: safePubkey(p.pool_wallet),
      depositWallet: safePubkey(p.deposit_wallet),
    })),
    status: data.status,
    createdAt: fakeBN(data.created_at) as unknown as import('@coral-xyz/anchor').BN,
    bump: data.bump,
  } as unknown as MasterPolicyAccount;
}

export function useMasterPolicyAccount(masterPolicyPDA: PublicKey | null) {
  const [account, setAccount] = useState<MasterPolicyAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdaKey = masterPolicyPDA?.toBase58() ?? null;
  const pdaRef = useRef(pdaKey);
  pdaRef.current = pdaKey;

  const fetchAccount = useCallback(async () => {
    const pda = pdaRef.current;
    if (!pda) {
      setAccount(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/master-policies/${pda}`);
      if (res.status === 404) {
        setAccount(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BackendMasterPolicy = await res.json();
      setAccount(toMasterPolicyAccount(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pdaKey]);

  // Initial fetch
  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!pdaKey) return;

    const es = new EventSource(`${BACKEND_URL}/api/events?master=${pdaKey}`);

    es.addEventListener('master_policy_updated', (e: MessageEvent) => {
      try {
        const data: BackendMasterPolicy = JSON.parse(e.data);
        if (data.pubkey === pdaKey) {
          setAccount(toMasterPolicyAccount(data));
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // SSE reconnects automatically — no action needed
    };

    return () => es.close();
  }, [pdaKey]);

  return { account, loading, error, refetch: fetchAccount };
}
