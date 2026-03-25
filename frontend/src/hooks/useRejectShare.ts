import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';

/**
 * Track B: reject_share instruction
 * Participant rejects their share in underwriting.
 * Only valid when policy is Open(1) and participant status is Pending(0).
 */
export function useRejectShare() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const rejectShare = useCallback(
    async (policyPubkey: PublicKey, index: number): Promise<TxResult> => {
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
            .rejectShare(index)
            .accounts({
              participant: wallet.publicKey,
              policy: policyPubkey,
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

  return { rejectShare, loading };
}
