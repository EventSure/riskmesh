import { useCallback, useState } from 'react';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

export interface FundPoolInput {
  masterPolicy: PublicKey;
  funderTokenAccount: PublicKey;
  poolToken: PublicKey;
  amountRaw: number;
}

export function useFundPool() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const fundPool = useCallback(
    async (input: FundPoolInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }
      if (!Number.isFinite(input.amountRaw) || input.amountRaw <= 0) {
        return { signature: '', success: false, error: 'Invalid amount' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .fundPool(new BN(input.amountRaw))
            .accounts({
              funder: wallet.publicKey,
              masterPolicy: input.masterPolicy,
              funderTokenAccount: input.funderTokenAccount,
              poolToken: input.poolToken,
              tokenProgram: TOKEN_PROGRAM_ID,
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

  return { fundPool, loading };
}
