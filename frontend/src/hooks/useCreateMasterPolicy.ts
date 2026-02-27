import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { getMasterPolicyPDA } from '@/lib/pda';
import { sendTx, type TxResult } from '@/lib/tx';
import type { CreateMasterPolicyParams, MasterParticipantInit } from '@/lib/idl/open_parametric';

export interface CreateMasterPolicyInput {
  masterId: number;
  coverageStartTs: number; // unix seconds
  coverageEndTs: number;
  premiumPerPolicy: number; // in token base units
  payoutDelay2h: number;
  payoutDelay3h: number;
  payoutDelay4to5h: number;
  payoutDelay6hOrCancelled: number;
  cededRatioBps: number;
  reinsCommissionBps: number;
  operator: PublicKey;
  reinsurer: PublicKey;
  currencyMint: PublicKey;
  leaderDepositWallet: PublicKey;
  reinsurerPoolWallet: PublicKey;
  reinsurerDepositWallet: PublicKey;
  participants: { insurer: PublicKey; shareBps: number }[];
}

export function useCreateMasterPolicy() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const createMasterPolicy = useCallback(
    async (input: CreateMasterPolicyInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        const masterIdBN = new BN(input.masterId);
        const leader = wallet.publicKey;
        const [masterPolicyPDA] = getMasterPolicyPDA(leader, masterIdBN);

        const params: CreateMasterPolicyParams = {
          masterId: masterIdBN,
          coverageStartTs: new BN(input.coverageStartTs),
          coverageEndTs: new BN(input.coverageEndTs),
          premiumPerPolicy: new BN(input.premiumPerPolicy),
          payoutDelay2h: new BN(input.payoutDelay2h),
          payoutDelay3h: new BN(input.payoutDelay3h),
          payoutDelay4to5h: new BN(input.payoutDelay4to5h),
          payoutDelay6hOrCancelled: new BN(input.payoutDelay6hOrCancelled),
          cededRatioBps: input.cededRatioBps,
          reinsCommissionBps: input.reinsCommissionBps,
          participants: input.participants.map(
            (p): MasterParticipantInit => ({
              insurer: p.insurer,
              shareBps: p.shareBps,
            }),
          ),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .createMasterPolicy(params)
            .accounts({
              leader: leader,
              operator: input.operator,
              reinsurer: input.reinsurer,
              currencyMint: input.currencyMint,
              masterPolicy: masterPolicyPDA,
              leaderDepositWallet: input.leaderDepositWallet,
              reinsurerPoolWallet: input.reinsurerPoolWallet,
              reinsurerDepositWallet: input.reinsurerDepositWallet,
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

  return { createMasterPolicy, loading };
}
