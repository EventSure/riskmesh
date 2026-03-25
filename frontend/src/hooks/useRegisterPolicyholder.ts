import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import { PROGRAM_ID } from '@/lib/constants';
import type { PolicyholderEntryInput } from '@/lib/idl/open_parametric';

/**
 * Track B: register_policyholder instruction
 * Leader adds a policyholder entry to the registry.
 */
export function useRegisterPolicyholder() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const registerPolicyholder = useCallback(
    async (policyPubkey: PublicKey, entry: PolicyholderEntryInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        const [registryPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('registry'), policyPubkey.toBuffer()],
          PROGRAM_ID,
        );

        const result = await sendTx(provider, () =>
          prog.methods
            .registerPolicyholder(entry)
            .accounts({
              registry: registryPDA,
              policy: policyPubkey,
              leader: wallet.publicKey,
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

  return { registerPolicyholder, loading };
}
