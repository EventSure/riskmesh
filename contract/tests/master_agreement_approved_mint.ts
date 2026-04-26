import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { createAccount, createMint } from "@solana/spl-token";
import { strict as assert } from "assert";

import { OpenParametric } from "../target/types/open_parametric";
import { ensureApprovedMasterCurrencyMint } from "./helpers/approvedMint";

describe("master_agreement_approved_mint", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  function masterPda(masterId: anchor.BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("master_agreement"), payer.publicKey.toBuffer(), masterId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
  }

  function assertAnchorError(err: unknown, expectedCode: string): void {
    assert.ok(err instanceof AnchorError, `AnchorError가 아님: ${err}`);
    assert.equal(err.error.errorCode.code, expectedCode);
  }

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  it("accepts createMasterAgreement when currency mint matches the configured approved mint", async () => {
    const approvedMint = await ensureApprovedMasterCurrencyMint(connection, payer, payer.publicKey, null, 6);
    const pda = masterPda(new anchor.BN(930));
    const reinsurer = Keypair.generate();
    await airdrop(reinsurer.publicKey);
    const leaderDeposit = await createAccount(connection, payer, approvedMint, pda, Keypair.generate());
    const reinsurerPool = await createAccount(connection, payer, approvedMint, pda, Keypair.generate());
    const reinsurerDeposit = await createAccount(connection, payer, approvedMint, pda, Keypair.generate());
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createMasterAgreement({
        masterId: new anchor.BN(930),
        coverageStartTs: new anchor.BN(now),
        coverageEndTs: new anchor.BN(now + 3600),
        premiumPerPolicy: new anchor.BN(1_000_000),
        payoutDelay2H: new anchor.BN(0),
        payoutDelay3H: new anchor.BN(0),
        payoutDelay4To5H: new anchor.BN(0),
        payoutDelay6HOrCancelled: new anchor.BN(0),
        collateralClaimCount: 1,
        leaderShareBps: 5_000,
        cededRatioBps: 0,
        reinsCommissionBps: 0,
        participants: [{ insurer: Keypair.generate().publicKey, shareBps: 5_000 }],
        oracleFeed: PublicKey.default,
      })
      .accountsPartial({
        leader: payer.publicKey,
        operator: payer.publicKey,
        reinsurer: reinsurer.publicKey,
        currencyMint: approvedMint,
        masterAgreement: pda,
        leaderDepositWallet: leaderDeposit,
        reinsurerPoolWallet: reinsurerPool,
        reinsurerDepositWallet: reinsurerDeposit,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const master = await program.account.masterAgreement.fetch(pda);
    assert.equal(master.currencyMint.toBase58(), approvedMint.toBase58());
  });

  it("rejects createMasterAgreement when currency mint is not the configured approved mint", async () => {
    const approvedMint = await ensureApprovedMasterCurrencyMint(connection, payer, payer.publicKey, null, 6);
    const wrongMint = await createMint(connection, payer, payer.publicKey, null, 6);
    const pda = masterPda(new anchor.BN(931));
    const leaderDeposit = await createAccount(connection, payer, wrongMint, pda, Keypair.generate());
    const reinsurerPool = await createAccount(connection, payer, wrongMint, pda, Keypair.generate());
    const reinsurerDeposit = await createAccount(connection, payer, wrongMint, pda, Keypair.generate());
    const now = Math.floor(Date.now() / 1000);

    assert.notEqual(approvedMint.toBase58(), wrongMint.toBase58());

    try {
      await program.methods
        .createMasterAgreement({
          masterId: new anchor.BN(931),
          coverageStartTs: new anchor.BN(now),
          coverageEndTs: new anchor.BN(now + 3600),
          premiumPerPolicy: new anchor.BN(1_000_000),
          payoutDelay2H: new anchor.BN(0),
          payoutDelay3H: new anchor.BN(0),
          payoutDelay4To5H: new anchor.BN(0),
          payoutDelay6HOrCancelled: new anchor.BN(0),
          collateralClaimCount: 1,
          leaderShareBps: 5_000,
          cededRatioBps: 0,
          reinsCommissionBps: 0,
          participants: [{ insurer: Keypair.generate().publicKey, shareBps: 5_000 }],
          oracleFeed: PublicKey.default,
        })
        .accountsPartial({
          leader: payer.publicKey,
          operator: payer.publicKey,
          reinsurer: Keypair.generate().publicKey,
          currencyMint: wrongMint,
          masterAgreement: pda,
          leaderDepositWallet: leaderDeposit,
          reinsurerPoolWallet: reinsurerPool,
          reinsurerDepositWallet: reinsurerDeposit,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("실패해야 하는데 성공함");
    } catch (err) {
      assertAnchorError(err, "InvalidInput");
    }
  });
});
