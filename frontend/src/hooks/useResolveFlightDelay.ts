import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

export interface ResolveFlightDelayInput {
  masterPolicy: PublicKey;
  flightPolicy: PublicKey;
  delayMinutes: number;
  cancelled: boolean;
}

export function useResolveFlightDelay() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const resolveFlightDelay = useCallback(
    async (input: ResolveFlightDelayInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .resolveFlightDelay(input.delayMinutes, input.cancelled)
            .accounts({
              resolver: wallet.publicKey,
              masterPolicy: input.masterPolicy,
              flightPolicy: input.flightPolicy,
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

  return { resolveFlightDelay, loading };
}
