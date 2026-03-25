import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';

/**
 * Track B: open_underwriting instruction
 * PolicyState: Draft(0) → Open(1), UnderwritingStatus: Proposed(0) → Open(1)
 */
export function useOpenUnderwriting() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const openUnderwriting = useCallback(
    async (policyPubkey: PublicKey): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        const [underwritingPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('underwriting'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );

        const result = await sendTx(provider, () =>
          prog.methods
            .openUnderwriting()
            .accounts({
              policy: policyPubkey,
              leader: wallet.publicKey,
              underwriting: underwritingPDA,
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

  return { openUnderwriting, loading };
}
