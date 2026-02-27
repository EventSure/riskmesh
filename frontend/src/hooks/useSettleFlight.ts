import { useCallback, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useProgram } from './useProgram';
import { sendTx, type TxResult } from '@/lib/tx';
import type { MasterPolicyAccount } from '@/lib/idl/open_parametric';

export interface SettleFlightClaimInput {
  masterPolicy: PublicKey;
  flightPolicy: PublicKey;
  leaderDepositToken: PublicKey;
  reinsurerPoolToken: PublicKey;
  /** Pool wallet accounts for each participant (same order as master.participants) */
  participantPoolWallets: PublicKey[];
}

export interface SettleFlightNoClaimInput {
  masterPolicy: PublicKey;
  flightPolicy: PublicKey;
  leaderDepositToken: PublicKey;
  reinsurerDepositToken: PublicKey;
  /** Deposit wallet accounts for each participant (same order as master.participants) */
  participantDepositWallets: PublicKey[];
}

export function useSettleFlight() {
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);

  const settleFlightClaim = useCallback(
    async (input: SettleFlightClaimInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .settleFlightClaim()
            .accounts({
              executor: wallet.publicKey,
              masterPolicy: input.masterPolicy,
              flightPolicy: input.flightPolicy,
              leaderDepositToken: input.leaderDepositToken,
              reinsurerPoolToken: input.reinsurerPoolToken,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .remainingAccounts(
              input.participantPoolWallets.map((pk) => ({
                pubkey: pk,
                isSigner: false,
                isWritable: true,
              })),
            )
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

  const settleFlightNoClaim = useCallback(
    async (input: SettleFlightNoClaimInput): Promise<TxResult> => {
      if (!program || !provider || !wallet) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;
        const result = await sendTx(provider, () =>
          prog.methods
            .settleFlightNoClaim()
            .accounts({
              executor: wallet.publicKey,
              masterPolicy: input.masterPolicy,
              flightPolicy: input.flightPolicy,
              leaderDepositToken: input.leaderDepositToken,
              reinsurerDepositToken: input.reinsurerDepositToken,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .remainingAccounts(
              input.participantDepositWallets.map((pk) => ({
                pubkey: pk,
                isSigner: false,
                isWritable: true,
              })),
            )
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

  /** Helper to build wallet arrays from master policy account data */
  const buildSettleAccounts = (master: MasterPolicyAccount) => ({
    participantPoolWallets: master.participants.map((p) => p.poolWallet),
    participantDepositWallets: master.participants.map((p) => p.depositWallet),
    leaderDepositWallet: master.leaderDepositWallet,
    reinsurerPoolWallet: master.reinsurerPoolWallet,
    reinsurerDepositWallet: master.reinsurerDepositWallet,
  });

  return { settleFlightClaim, settleFlightNoClaim, buildSettleAccounts, loading };
}
