import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

export interface UpdateMasterAgreementNameInput {
  masterAgreement: PublicKey;
  name: string;
}

export function useUpdateMasterAgreementName() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const updateMasterAgreementName = useCallback(
    async (input: UpdateMasterAgreementNameInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        return await sendTx(provider, () =>
          prog.methods
            .updateMasterAgreementName(input.name)
            .accounts({
              signer: wallet.publicKey,
              masterAgreement: input.masterAgreement,
            })
            .rpc(),
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { signature: '', success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [program, provider, wallet],
  );

  return { updateMasterAgreementName, loading };
}
