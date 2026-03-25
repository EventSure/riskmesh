import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

/**
 * Track B: expire_policy instruction
 * PolicyState: Active(3) → Expired(7)
 * Requires: now > policy.active_to
 * Anyone can call (no signer check on policy.leader).
 */
export function useExpirePolicy() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const expirePolicy = useCallback(
    async (policyPubkey: PublicKey): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        const result = await sendTx(provider, () =>
          prog.methods
            .expirePolicy()
            .accounts({
              policy: policyPubkey,
            })
            .rpc(),
        );
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { signature: '', success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [program, provider, wallet],
  );

  return { expirePolicy, loading };
}
