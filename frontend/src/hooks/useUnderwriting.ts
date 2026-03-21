import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { PROGRAM_ID } from '@/lib/constants';
import type { UnderwritingAccount } from '@/lib/idl/open_parametric';

/**
 * Fetch the Underwriting account for a given policy.
 * Derives PDA: ["underwriting", policy.key()]
 */
export function useUnderwriting(policyPubkey: PublicKey | null) {
  const { program, connection } = useProgram();
  const [account, setAccount] = useState<UnderwritingAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!program || !policyPubkey) {
      setAccount(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      const [underwritingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('underwriting'), policyPubkey.toBuffer()],
        PROGRAM_ID,
      );

      const data = await prog.account.underwriting.fetch(underwritingPDA) as UnderwritingAccount;
      setAccount(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [program, policyPubkey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!connection || !policyPubkey) return;

    const [underwritingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('underwriting'), policyPubkey.toBuffer()],
      PROGRAM_ID,
    );

    const subId = connection.onAccountChange(
      underwritingPDA,
      () => { fetch(); },
      'confirmed',
    );

    return () => { connection.removeAccountChangeListener(subId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, policyPubkey?.toBase58(), fetch]);

  return { account, loading, error, refetch: fetch };
}
