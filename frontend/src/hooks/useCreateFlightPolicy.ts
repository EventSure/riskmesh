import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { getFlightPolicyPDA } from '@/lib/pda';
import { sendTx, type TxResult } from '@/lib/tx';
import type { CreateFlightPolicyParams } from '@/lib/idl/open_parametric';

export interface CreateFlightPolicyInput {
  masterAgreement: PublicKey;
  childPolicyId: number;
  subscriberRef: string;
  flightNo: string;
  route: string;
  departureTs: number; // unix seconds
  payerToken: PublicKey;
  leaderPoolToken: PublicKey;
}

export function useCreateFlightPolicy() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const createFlightPolicy = useCallback(
    async (input: CreateFlightPolicyInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        const childIdBN = new BN(input.childPolicyId);
        const [flightPolicyPDA] = getFlightPolicyPDA(input.masterAgreement, childIdBN);

        const params: CreateFlightPolicyParams = {
          childPolicyId: childIdBN,
          subscriberRef: input.subscriberRef,
          flightNo: input.flightNo,
          route: input.route,
          departureTs: new BN(input.departureTs),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .createFlightPolicyFromMaster(params)
            .accounts({
              creator: wallet.publicKey,
              masterAgreement: input.masterAgreement,
              flightPolicy: flightPolicyPDA,
              payerToken: input.payerToken,
              leaderPoolToken: input.leaderPoolToken,
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

  return { createFlightPolicy, loading };
}
