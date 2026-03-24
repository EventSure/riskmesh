import { useCallback, useState } from 'react';
import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { useProgram } from './useProgram';
import { PROGRAM_ID } from '@/lib/constants';
import type { TxResult } from '@/lib/tx';

// Switchboard On-Demand devnet constants
const SB_ON_DEMAND_DEVNET_PID = new PublicKey('SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv');
const SB_ON_DEMAND_DEVNET_QUEUE = new PublicKey('A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w');
const SLOT_HASHES_SYSVAR = new PublicKey('SysvarS1otHashes111111111111111111111111111');
const INSTRUCTIONS_SYSVAR = new PublicKey('Sysvar1nstructions1111111111111111111111111');

/**
 * Track B: check_oracle_and_create_claim via Switchboard On-Demand.
 *
 * Builds a 3-instruction VersionedTransaction:
 *   [0] Ed25519 signature verification  (Switchboard)
 *   [1] verified_update                 (Switchboard)
 *   [2] check_oracle_and_create_claim   (our program)
 */
export function useCheckOracle() {
  const { program, provider, wallet, connection } = useProgram();
  const [loading, setLoading] = useState(false);

  const checkOracle = useCallback(
    async (policyPubkey: PublicKey): Promise<TxResult> => {
      if (!program || !provider || !wallet || !connection) {
        return { signature: '', success: false, error: 'Wallet not connected' };
      }

      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prog = program as any;

        // Fetch the policy to get oracleFeed
        const policy = await prog.account.policy.fetch(policyPubkey);
        const oracleFeed = policy.oracleFeed as PublicKey;

        // Load Switchboard program IDL and create PullFeed
        const sbIdl = await anchor.Program.fetchIdl(SB_ON_DEMAND_DEVNET_PID, provider);
        if (!sbIdl) {
          return { signature: '', success: false, error: 'Switchboard IDL load failed' };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sbProgram = new anchor.Program(sbIdl as any, provider);

        // Dynamic import to avoid bundling issues
        const { PullFeed } = await import('@switchboard-xyz/on-demand');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pullFeed = new PullFeed(sbProgram as any, oracleFeed);

        // Fetch Switchboard update instructions (Ed25519 + verified_update)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [sbIxs, , numSuccesses, luts] = await (pullFeed as any).fetchUpdateIx({
          numSignatures: 1,
        });

        if (!sbIxs || sbIxs.length < 2 || numSuccesses < 1) {
          return {
            signature: '',
            success: false,
            error: 'Switchboard instructions fetch failed. Feed may need 1-2 min after creation.',
          };
        }

        // Determine oracle_round (current confirmed slot)
        const currentSlot = await connection.getSlot('confirmed');
        const oracleRound = new BN(currentSlot);

        // Derive claim PDA: ["claim", policy, oracle_round_le]
        const [claimPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('claim'),
            policyPubkey.toBuffer(),
            oracleRound.toArrayLike(Buffer, 'le', 8),
          ],
          PROGRAM_ID,
        );

        // Build our check_oracle_and_create_claim instruction
        const ourIx = await prog.methods
          .checkOracleAndCreateClaim(oracleRound)
          .accountsPartial({
            policy: policyPubkey,
            claim: claimPDA,
            payer: wallet.publicKey,
            oracleFeed,
            queue: SB_ON_DEMAND_DEVNET_QUEUE,
            slotHashes: SLOT_HASHES_SYSVAR,
            instructions: INSTRUCTIONS_SYSVAR,
          })
          .instruction();

        // Compose VersionedTransaction: [Ed25519, verified_update, our ix]
        const allIxs = [...sbIxs, ourIx];
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');

        const msg = new TransactionMessage({
          payerKey: wallet.publicKey,
          recentBlockhash: blockhash,
          instructions: allIxs,
        }).compileToV0Message(luts ?? []);

        const vtx = new VersionedTransaction(msg);

        // Sign via wallet adapter
        if (!wallet.signTransaction) {
          return { signature: '', success: false, error: 'Wallet does not support signTransaction' };
        }
        const signed = await wallet.signTransaction(vtx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
        });
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed',
        );

        return { signature: sig, success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const anchorMatch = message.match(/Error Code: (\w+)/);
        const errorMsg = anchorMatch ? anchorMatch[1]! : message;
        return { signature: '', success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [program, provider, wallet, connection],
  );

  return { checkOracle, loading };
}
