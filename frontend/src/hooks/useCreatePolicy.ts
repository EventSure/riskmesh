import { useCallback, useState } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';
import type { CreatePolicyParams } from '@/lib/idl/open_parametric';

/**
 * Track B: create_policy instruction
 * Creates Policy + Underwriting + RiskPool + Registry + Vault in one tx.
 *
 * PDA seeds:
 *   policy      = ["policy", leader, policy_id_le]
 *   underwriting = ["underwriting", policy]
 *   risk_pool   = ["pool", policy]
 *   registry    = ["registry", policy]
 *   vault       = ATA(risk_pool, currency_mint)
 */
export function useCreatePolicy() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const createPolicy = useCallback(
    async (params: CreatePolicyParams, currencyMint: PublicKey): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        // Derive policy PDA
        const [policyPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('policy'), wallet.publicKey.toBuffer(), params.policyId.toArrayLike(Buffer, 'le', 8)],
          PROGRAM_ID,
        );

        // Derive underwriting PDA
        const [underwritingPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('underwriting'), policyPDA.toBuffer()],
          PROGRAM_ID,
        );

        // Derive risk_pool PDA
        const [riskPoolPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('pool'), policyPDA.toBuffer()],
          PROGRAM_ID,
        );

        // Derive registry PDA
        const [registryPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('registry'), policyPDA.toBuffer()],
          PROGRAM_ID,
        );

        // Derive vault (ATA of risk_pool for currency_mint)
        const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
        const vault = getAssociatedTokenAddressSync(currencyMint, riskPoolPDA, true);

        const result = await sendTx(provider, () =>
          prog.methods
            .createPolicy(params)
            .accounts({
              leader: wallet.publicKey,
              currencyMint,
              policy: policyPDA,
              underwriting: underwritingPDA,
              riskPool: riskPoolPDA,
              registry: registryPDA,
              vault,
              systemProgram: SystemProgram.programId,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
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

  return { createPolicy, loading };
}
