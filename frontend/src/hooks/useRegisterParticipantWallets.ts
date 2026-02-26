import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

export interface RegisterWalletsInput {
  masterPolicy: PublicKey;
  poolWallet: PublicKey;
  depositWallet: PublicKey;
}

export function useRegisterParticipantWallets() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const registerWallets = useCallback(
    async (input: RegisterWalletsInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .registerParticipantWallets()
            .accounts({
              insurer: wallet.publicKey,
              masterPolicy: input.masterPolicy,
              poolWallet: input.poolWallet,
              depositWallet: input.depositWallet,
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

  return { registerWallets, loading };
}
