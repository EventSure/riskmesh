import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useProgram } from './useProgram';
import { getMasterAgreementPDA } from '@/lib/pda';
import { sendTx, type TxResult } from '@/lib/tx';
import type { CreateMasterAgreementParams, MasterParticipantInit } from '@/lib/idl/open_parametric';

interface LegacyPayoutDelayFields {
  payoutDelay2H?: number;
  payoutDelay3H?: number;
  payoutDelay4To5H?: number;
  payoutDelay6HOrCancelled?: number;
}

interface CurrentPayoutDelayFields {
  payoutDelay2h?: number;
  payoutDelay3h?: number;
  payoutDelay4to5h?: number;
  payoutDelay6hOrCancelled?: number;
}

export interface CreateMasterAgreementInput extends LegacyPayoutDelayFields, CurrentPayoutDelayFields {
  masterId: number;
  name: string;
  coverageStartTs: number; // unix seconds
  coverageEndTs: number;
  premiumPerPolicy: number; // in token base units
  collateralClaimCount: number;
  leaderShareBps: number;
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

const normalizePayoutDelays = (input: CreateMasterAgreementInput) => {
  const payoutDelay2h = input.payoutDelay2h ?? input.payoutDelay2H;
  const payoutDelay3h = input.payoutDelay3h ?? input.payoutDelay3H;
  const payoutDelay4to5h = input.payoutDelay4to5h ?? input.payoutDelay4To5H;
  const payoutDelay6hOrCancelled = input.payoutDelay6hOrCancelled ?? input.payoutDelay6HOrCancelled;

  if (
    payoutDelay2h == null ||
    payoutDelay3h == null ||
    payoutDelay4to5h == null ||
    payoutDelay6hOrCancelled == null
  ) {
    throw new Error('Missing payout delay tiers');
  }

  return {
    payoutDelay2h,
    payoutDelay3h,
    payoutDelay4to5h,
    payoutDelay6hOrCancelled,
  };
};

export function useCreateMasterAgreement() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const createMasterAgreement = useCallback(
    async (input: CreateMasterAgreementInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        const payoutDelays = normalizePayoutDelays(input);
        const masterIdBN = new BN(input.masterId);
        const leader = wallet.publicKey;
        const [masterAgreementPDA] = getMasterAgreementPDA(leader, masterIdBN);

        const params: CreateMasterAgreementParams = {
          masterId: masterIdBN,
          name: input.name,
          coverageStartTs: new BN(input.coverageStartTs),
          coverageEndTs: new BN(input.coverageEndTs),
          premiumPerPolicy: new BN(input.premiumPerPolicy),
          payoutDelay2H: new BN(payoutDelays.payoutDelay2h),
          payoutDelay3H: new BN(payoutDelays.payoutDelay3h),
          payoutDelay4To5H: new BN(payoutDelays.payoutDelay4to5h),
          payoutDelay6HOrCancelled: new BN(payoutDelays.payoutDelay6hOrCancelled),
          collateralClaimCount: input.collateralClaimCount,
          leaderShareBps: input.leaderShareBps,
          cededRatioBps: input.cededRatioBps,
          reinsCommissionBps: input.reinsCommissionBps,
          participants: input.participants.map(
            (p): MasterParticipantInit => ({
              insurer: p.insurer,
              shareBps: p.shareBps,
            }),
          ),
          oracleFeed: PublicKey.default,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .createMasterAgreement(params)
            .accounts({
              leader: leader,
              operator: input.operator,
              reinsurer: input.reinsurer,
              currencyMint: input.currencyMint,
              masterAgreement: masterAgreementPDA,
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

  return { createMasterAgreement, loading };
}
