import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';

export interface ActivateMasterInput {
  masterAgreement: PublicKey;
  leaderPoolToken: PublicKey;
  reinsurerPoolToken: PublicKey;
  participantPoolTokens: PublicKey[];
}

export function useActivateMaster() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const activateMaster = useCallback(
    async (input: ActivateMasterInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        if (!input.leaderPoolToken || !input.reinsurerPoolToken || !Array.isArray(input.participantPoolTokens)) {
          return { signature: '', success: false, error: 'Missing pool token accounts' };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .activateMaster()
            .accounts({
              operator: wallet.publicKey,
              masterAgreement: input.masterAgreement,
              leaderPoolToken: input.leaderPoolToken,
              reinsurerPoolToken: input.reinsurerPoolToken,
            })
            .remainingAccounts(
              input.participantPoolTokens.map((pubkey) => ({
                pubkey,
                isSigner: false,
                isWritable: false,
              })),
            )
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

  return { activateMaster, loading };
}
