import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';
import type { PolicyAccount, RiskPoolAccount } from '@/lib/idl/open_parametric';

/**
 * Track B: refund_after_expiry instruction
 * Expired policy → participant gets escrowed tokens back from vault.
 * RiskPool PDA signs the transfer.
 */
export function useRefundAfterExpiry() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const refundAfterExpiry = useCallback(
    async (policyPubkey: PublicKey, shareIndex: number): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        const policyData = await prog.account.policy.fetch(policyPubkey) as PolicyAccount;

        const [riskPoolPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );
        const riskPoolData = await prog.account.riskPool.fetch(riskPoolPDA) as RiskPoolAccount;

        const [underwritingPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('underwriting'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );

        const participantToken = getAssociatedTokenAddressSync(
          policyData.currencyMint,
          wallet.publicKey,
        );

        const result = await sendTx(provider, () =>
          prog.methods
            .refundAfterExpiry(shareIndex)
            .accounts({
              participant: wallet.publicKey,
              policy: policyPubkey,
              riskPool: riskPoolPDA,
              vault: riskPoolData.vault,
              participantToken,
              underwriting: underwritingPDA,
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

  return { refundAfterExpiry, loading };
}
