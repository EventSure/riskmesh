import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { ConfirmRole } from '@/lib/idl/open_parametric';

export interface ConfirmMasterInput {
  masterAgreement: PublicKey;
  role: ConfirmRole;
  actorSourceToken: PublicKey;
  actorPoolToken: PublicKey;
}

export function useConfirmMaster() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const confirmMaster = useCallback(
    async (input: ConfirmMasterInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        if (!input.actorSourceToken || !input.actorPoolToken) {
          return { signature: '', success: false, error: 'Missing actor token accounts' };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .confirmMaster(input.role)
            .accounts({
              actor: wallet.publicKey,
              masterAgreement: input.masterAgreement,
              actorSourceToken: input.actorSourceToken,
              actorPoolToken: input.actorPoolToken,
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

  return { confirmMaster, loading };
}
