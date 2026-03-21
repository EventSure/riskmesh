import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

/**
 * Track B: activate_policy instruction
 * PolicyState: Funded(2) → Active(3)
 * Requires: now >= policy.active_from
 */
export function useActivatePolicy() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const activatePolicy = useCallback(
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
            .activatePolicy()
            .accounts({
              policy: policyPubkey,
              leader: wallet.publicKey,
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

  return { activatePolicy, loading };
}
