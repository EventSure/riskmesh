import { useEffect, useState, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { FlightPolicyAccount } from '@/lib/idl/open_parametric';
import { BACKEND_URL } from '@/lib/constants';

export interface FlightPolicyWithKey {
  publicKey: PublicKey;
  account: FlightPolicyAccount;
}

const fakeBN = (n: number) => ({
  toNumber: () => n,
  toString: () => String(n),
});

interface BackendFlightPolicy {
  pubkey: string;
  child_policy_id: number;
  master: string;
  creator: string;
  subscriber_ref: string;
  flight_no: string;
  route: string;
  departure_ts: number;
  premium_paid: number;
  delay_minutes: number;
  cancelled: boolean;
  payout_amount: number;
  status: number;
  premium_distributed: boolean;
  created_at: number;
  updated_at: number;
  status_label: string;
}

function toFlightPolicyWithKey(data: BackendFlightPolicy): FlightPolicyWithKey {
  const SYSTEM_PROGRAM = '11111111111111111111111111111111';
  const safePubkey = (s: string | undefined | null) =>
    new PublicKey(s && s.length > 0 ? s : SYSTEM_PROGRAM);

  return {
    publicKey: safePubkey(data.pubkey),
    account: {
      childPolicyId: fakeBN(data.child_policy_id) as unknown as import('@coral-xyz/anchor').BN,
      master: safePubkey(data.master),
      creator: safePubkey(data.creator),
      subscriberRef: data.subscriber_ref,
      flightNo: data.flight_no,
      route: data.route,
      departureTs: fakeBN(data.departure_ts) as unknown as import('@coral-xyz/anchor').BN,
      premiumPaid: fakeBN(data.premium_paid) as unknown as import('@coral-xyz/anchor').BN,
      delayMinutes: data.delay_minutes,
      cancelled: data.cancelled,
      payoutAmount: fakeBN(data.payout_amount) as unknown as import('@coral-xyz/anchor').BN,
      status: data.status,
      premiumDistributed: data.premium_distributed,
      createdAt: fakeBN(data.created_at) as unknown as import('@coral-xyz/anchor').BN,
      updatedAt: fakeBN(data.updated_at) as unknown as import('@coral-xyz/anchor').BN,
      bump: 0,
    } as unknown as FlightPolicyAccount,
  };
}

export function useFlightPolicies(
  masterAgreementPDA: PublicKey | null,
  options?: {
    onStatusChange?: (fp: FlightPolicyWithKey, prevStatus: number, newStatus: number) => void;
    pollInterval?: number;
  },
) {
  const [policies, setPolicies] = useState<FlightPolicyWithKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevStatusRef = useRef<Map<number, number>>(new Map());
  const onStatusChangeRef = useRef(options?.onStatusChange);
  onStatusChangeRef.current = options?.onStatusChange;

  const masterKey = masterAgreementPDA?.toBase58() ?? null;

  const fetchPolicies = useCallback(async () => {
    if (!masterKey) {
      setPolicies([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/flight-policies?master=${masterKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { flight_policies: BackendFlightPolicy[] } = await res.json();

      const mapped = json.flight_policies.map(toFlightPolicyWithKey);
      mapped.sort(
        (a, b) => a.account.childPolicyId.toNumber() - b.account.childPolicyId.toNumber(),
      );

      // Status diff detection
      const prevMap = prevStatusRef.current;
      const cb = onStatusChangeRef.current;
      if (prevMap.size > 0 && cb) {
        for (const fp of mapped) {
          const id = fp.account.childPolicyId.toNumber();
          const prevStatus = prevMap.get(id);
          const newStatus = fp.account.status;
          if (prevStatus !== undefined && prevStatus !== newStatus) {
            cb(fp, prevStatus, newStatus);
          }
        }
      }
      prevStatusRef.current = new Map(
        mapped.map((fp) => [fp.account.childPolicyId.toNumber(), fp.account.status]),
      );

      setPolicies(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [masterKey]);

  // Initial fetch
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // SSE for real-time flight policy updates
  useEffect(() => {
    if (!masterKey) return;

    const es = new EventSource(`${BACKEND_URL}/api/events?master=${masterKey}`);
    console.log('[SSE] connected:', `${BACKEND_URL}/api/events?master=${masterKey}`);

    es.addEventListener('flight_policy_updated', (e: MessageEvent) => {
      console.log('[SSE] flight_policy_updated', JSON.parse(e.data));
      try {
        const data: BackendFlightPolicy = JSON.parse(e.data);
        if (data.master !== masterKey) return;

        const updated = toFlightPolicyWithKey(data);
        const id = updated.account.childPolicyId.toNumber();

        setPolicies((prev) => {
          const idx = prev.findIndex((p) => p.account.childPolicyId.toNumber() === id);
          const existing = idx >= 0 ? prev[idx]! : undefined;

          const prevStatus = existing?.account.status;
          const nextStatus = updated.account.status;
          if (prevStatus !== undefined && prevStatus !== nextStatus) {
            const cb = onStatusChangeRef.current;
            if (cb) setTimeout(() => cb(updated, prevStatus, nextStatus), 0);
          }
          prevStatusRef.current.set(id, nextStatus);

          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          // New policy — append and sort
          return [...prev, updated].sort(
            (a, b) => a.account.childPolicyId.toNumber() - b.account.childPolicyId.toNumber(),
          );
        });
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // SSE auto-reconnects
    };

    return () => es.close();
  }, [masterKey]);

  return { policies, loading, error, refetch: fetchPolicies };
}
