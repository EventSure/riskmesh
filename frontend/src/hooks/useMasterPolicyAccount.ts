import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import type { MasterPolicyAccount } from '@/lib/idl/open_parametric';

/**
 * Fetch and subscribe to a MasterPolicy account by its PDA address.
 */
export function useMasterPolicyAccount(masterPolicyPDA: PublicKey | null) {
  const { program, connection } = useProgram();
  const [account, setAccount] = useState<MasterPolicyAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!program || !masterPolicyPDA) {
      setAccount(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      const data = await prog.account.masterPolicy.fetch(masterPolicyPDA);
      setAccount(data as MasterPolicyAccount);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Account may not exist yet — not an error in all cases
      if (message.includes('Account does not exist')) {
        setAccount(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [program, masterPolicyPDA]);

  // Initial fetch
  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  // Subscribe to account changes
  useEffect(() => {
    if (!connection || !masterPolicyPDA) return;

    const subscriptionId = connection.onAccountChange(
      masterPolicyPDA,
      () => {
        // Re-fetch and decode on change
        fetchAccount();
      },
      'confirmed',
    );

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, masterPolicyPDA, fetchAccount]);

  return { account, loading, error, refetch: fetchAccount };
}
