import { useEffect, useState, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { MasterAgreementAccount } from '@/lib/idl/open_parametric';
import { BACKEND_URL } from '@/lib/constants';

/** Minimal BN-like wrapper for number fields the store calls .toNumber() on */
const fakeBN = (n: number) => ({
  toNumber: () => n,
  toString: () => String(n),
});

interface BackendMasterAgreement {
  pubkey: string;
  master_id: number;
  name: string;
  status: number;
  collateral_claim_count?: number;
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
  leader_share_bps: number;
  coverage_end_ts: number;
  coverage_start_ts: number;
  leader: string;
  operator: string;
  currency_mint: string;
  reinsurer: string | null;
  reinsurer_pool_wallet: string | null;
  reinsurer_deposit_wallet: string | null;
  leader_pool_wallet: string;
  leader_deposit_wallet: string;
  created_at: number;
  status_label: string;
}

function toMasterAgreementAccount(data: BackendMasterAgreement): MasterAgreementAccount {
  const SYSTEM_PROGRAM = '11111111111111111111111111111111';
  const safePubkey = (s: string | undefined | null) =>
    new PublicKey(s && s.length > 0 ? s : SYSTEM_PROGRAM);
  const optionalPubkey = (s: string | undefined | null) =>
    s && s.length > 0 ? new PublicKey(s) : null;

  return {
    masterId: fakeBN(data.master_id) as unknown as import('@coral-xyz/anchor').BN,
    name: data.name,
    leader: safePubkey(data.leader),
    operator: safePubkey(data.operator),
    currencyMint: safePubkey(data.currency_mint),
    coverageStartTs: fakeBN(data.coverage_start_ts) as unknown as import('@coral-xyz/anchor').BN,
    coverageEndTs: fakeBN(data.coverage_end_ts) as unknown as import('@coral-xyz/anchor').BN,
    premiumPerPolicy: fakeBN(data.premium_per_policy) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay2H: fakeBN(data.payout_delay_2h) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay3H: fakeBN(data.payout_delay_3h) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay4To5H: fakeBN(data.payout_delay_4to5h) as unknown as import('@coral-xyz/anchor').BN,
    payoutDelay6HOrCancelled: fakeBN(
      data.payout_delay_6h_or_cancelled,
    ) as unknown as import('@coral-xyz/anchor').BN,
    leaderShareBps: data.leader_share_bps,
    cededRatioBps: data.ceded_ratio_bps,
    reinsCommissionBps: data.reins_commission_bps,
    reinsurerEffectiveBps: data.reinsurer_effective_bps,
    reinsurer: optionalPubkey(data.reinsurer),
    reinsurerConfirmed: data.reinsurer_confirmed,
    reinsurerPoolWallet: optionalPubkey(data.reinsurer_pool_wallet),
    reinsurerDepositWallet: optionalPubkey(data.reinsurer_deposit_wallet),
    leaderPoolWallet: safePubkey(data.leader_pool_wallet),
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
    bump: 0,
    collateralClaimCount: data.collateral_claim_count ?? 10,
  } as unknown as MasterAgreementAccount;
}

export function useMasterAgreementAccount(masterAgreementPDA: PublicKey | null) {
  const [account, setAccount] = useState<MasterAgreementAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdaKey = masterAgreementPDA?.toBase58() ?? null;
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
      const res = await fetch(`${BACKEND_URL}/api/master-agreements/${pda}`);
      if (res.status === 404) {
        if (pdaRef.current === pda) {
          setAccount(null);
        }
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BackendMasterAgreement = await res.json();
      if (pdaRef.current === pda) {
        setAccount(toMasterAgreementAccount(data));
      }
    } catch (err: unknown) {
      if (pdaRef.current === pda) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (pdaRef.current === pda) {
        setLoading(false);
      }
    }
  }, [pdaKey]);

  useEffect(() => {
    setAccount(null);
    setError(null);
  }, [pdaKey]);

  // Initial fetch
  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (!pdaKey) return;

    const es = new EventSource(`${BACKEND_URL}/api/events?master=${pdaKey}`);

    es.addEventListener('master_agreement_updated', (e: MessageEvent) => {
      try {
        const data: BackendMasterAgreement = JSON.parse(e.data);
        if (data.pubkey === pdaKey) {
          setAccount(toMasterAgreementAccount(data));
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
