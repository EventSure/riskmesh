import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';
import type { PolicyAccount, RiskPoolAccount } from '@/lib/idl/open_parametric';

/**
 * Track B on-chain settle flow:
 *   1. approveClaim: PolicyState.Claimable(4) → Approved(5), ClaimStatus.Claimable(2) → Approved(3)
 *   2. settleClaim:  PolicyState.Approved(5) → Settled(6), ClaimStatus.Approved(3) → Settled(4)
 *      vault → beneficiary_token (leader's ATA for currency_mint)
 */
export function useTrackBSettle() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  /**
   * approve_claim instruction
   * accounts: policy(mut, has_one=leader), leader(Signer), claim(mut)
   */
  const approveClaim = useCallback(
    async (policyPubkey: PublicKey, claimPubkey: PublicKey): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .approveClaim()
            .accounts({
              policy: policyPubkey,
              leader: wallet.publicKey,
              claim: claimPubkey,
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

  /**
   * settle_claim instruction
   * accounts: policy(mut), leader(Signer), claim(mut), risk_pool(mut),
   *           vault(mut), beneficiary_token(mut), token_program
   *
   * beneficiary_token = leader's ATA for policy.currency_mint
   * risk_pool PDA     = ["pool", policy.key()]
   * vault             = risk_pool.vault (fetched from chain)
   */
  const settleClaim = useCallback(
    async (policyPubkey: PublicKey, claimPubkey: PublicKey): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        // Fetch policy to get currencyMint
        const policyData = await prog.account.policy.fetch(policyPubkey) as PolicyAccount;

        // Derive risk_pool PDA
        const [riskPoolPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );

        // Fetch risk_pool to get vault address
        const riskPoolData = await prog.account.riskPool.fetch(riskPoolPDA) as RiskPoolAccount;

        // beneficiary_token = leader's ATA for currency_mint (create if needed)
        const beneficiaryToken = getAssociatedTokenAddressSync(
          policyData.currencyMint,
          wallet.publicKey,
        );

        // Ensure ATA exists before settle — idempotent (no-op if already exists)
        const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          beneficiaryToken,
          wallet.publicKey,
          policyData.currencyMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        const result = await sendTx(provider, () =>
          prog.methods
            .settleClaim()
            .accounts({
              policy: policyPubkey,
              leader: wallet.publicKey,
              claim: claimPubkey,
              riskPool: riskPoolPDA,
              vault: riskPoolData.vault,
              beneficiaryToken,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions([createAtaIx])
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

  return { approveClaim, settleClaim, loading };
}
