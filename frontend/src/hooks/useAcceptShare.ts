import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';
import type { PolicyAccount, RiskPoolAccount } from '@/lib/idl/open_parametric';

/**
 * Track B: accept_share instruction
 * Participant deposits tokens into vault. When all shares accepted (sum=10000bps),
 * underwriting finalizes and policy moves to Funded(2).
 */
export function useAcceptShare() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const acceptShare = useCallback(
    async (policyPubkey: PublicKey, index: number, depositAmount: BN): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        // Fetch policy to get currencyMint
        const policyData = await prog.account.policy.fetch(policyPubkey) as PolicyAccount;

        // Derive PDAs
        const [underwritingPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('underwriting'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );
        const [riskPoolPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );

        // Fetch riskPool to get vault
        const riskPoolData = await prog.account.riskPool.fetch(riskPoolPDA) as RiskPoolAccount;

        // Participant's ATA for currency_mint
        const participantToken = getAssociatedTokenAddressSync(
          policyData.currencyMint,
          wallet.publicKey,
        );

        const result = await sendTx(provider, () =>
          prog.methods
            .acceptShare(index, depositAmount)
            .accounts({
              participant: wallet.publicKey,
              policy: policyPubkey,
              underwriting: underwritingPDA,
              riskPool: riskPoolPDA,
              participantToken,
              vault: riskPoolData.vault,
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

  return { acceptShare, loading };
}
