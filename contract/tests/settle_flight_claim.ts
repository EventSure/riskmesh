import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import { OpenParametric } from "../target/types/open_parametric";
import { strict as assert } from "assert";

describe("settle_flight_claim", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const DECIMALS = 6;
  const UNIT = 1_000_000n;

  const payoutAmount = 80n * UNIT; // 80 USDC
  const premiumAmount = 5n * UNIT; // 5 USDC

  const reinsurerAmount = 36n * UNIT; // 80 * 0.45
  const insurerTotal = 44n * UNIT;
  const leaderShare = 22n * UNIT; // 44 * 0.5
  const aShare = 13_200_000n; // 44 * 0.3
  const bShare = 8_800_000n; // 44 * 0.2

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  it("settles claim and moves funds to leader deposit", async () => {
    const reinsurer = Keypair.generate();
    const participantA = Keypair.generate();
    const participantB = Keypair.generate();

    await airdrop(reinsurer.publicKey);
    await airdrop(participantA.publicKey);
    await airdrop(participantB.publicKey);

    const mint = await createMint(
      connection,
      payer,
      payer.publicKey,
      null,
      DECIMALS
    );

    const masterId = new anchor.BN(1);
    const [masterPolicyPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("master_policy"),
        payer.publicKey.toBuffer(),
        masterId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const leaderDeposit = await createAccount(connection, payer, mint, masterPolicyPda);
    const reinsurerPool = await createAccount(connection, payer, mint, masterPolicyPda);
    const reinsurerDeposit = await createAccount(connection, payer, mint, masterPolicyPda);

    const leaderPool = await createAccount(connection, payer, mint, masterPolicyPda);
    const aPool = await createAccount(connection, payer, mint, masterPolicyPda);
    const bPool = await createAccount(connection, payer, mint, masterPolicyPda);

    const aDeposit = await createAccount(connection, payer, mint, participantA.publicKey);
    const bDeposit = await createAccount(connection, payer, mint, participantB.publicKey);

    const payerToken = await createAccount(connection, payer, mint, payer.publicKey);
    await mintTo(connection, payer, mint, payerToken, payer, premiumAmount);

    await mintTo(connection, payer, mint, reinsurerPool, payer, reinsurerAmount);
    await mintTo(connection, payer, mint, leaderPool, payer, leaderShare);
    await mintTo(connection, payer, mint, aPool, payer, aShare);
    await mintTo(connection, payer, mint, bPool, payer, bShare);

    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createMasterPolicy({
        masterId,
        coverageStartTs: new anchor.BN(now - 10),
        coverageEndTs: new anchor.BN(now + 3600),
        premiumPerPolicy: new anchor.BN(premiumAmount.toString()),
        payoutDelay2h: new anchor.BN(0),
        payoutDelay3h: new anchor.BN(0),
        payoutDelay4to5h: new anchor.BN(0),
        payoutDelay6hOrCancelled: new anchor.BN(payoutAmount.toString()),
        cededRatioBps: 5_000,
        reinsCommissionBps: 1_000,
        participants: [
          { insurer: payer.publicKey, shareBps: 5_000 },
          { insurer: participantA.publicKey, shareBps: 3_000 },
          { insurer: participantB.publicKey, shareBps: 2_000 },
        ],
      })
      .accounts({
        leader: payer.publicKey,
        operator: payer.publicKey,
        reinsurer: reinsurer.publicKey,
        currencyMint: mint,
        masterPolicy: masterPolicyPda,
        leaderDepositWallet: leaderDeposit,
        reinsurerPoolWallet: reinsurerPool,
        reinsurerDepositWallet: reinsurerDeposit,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .registerParticipantWallets()
      .accounts({
        insurer: payer.publicKey,
        masterPolicy: masterPolicyPda,
        poolWallet: leaderPool,
        depositWallet: leaderDeposit,
      })
      .rpc();

    await program.methods
      .registerParticipantWallets()
      .accounts({
        insurer: participantA.publicKey,
        masterPolicy: masterPolicyPda,
        poolWallet: aPool,
        depositWallet: aDeposit,
      })
      .signers([participantA])
      .rpc();

    await program.methods
      .registerParticipantWallets()
      .accounts({
        insurer: participantB.publicKey,
        masterPolicy: masterPolicyPda,
        poolWallet: bPool,
        depositWallet: bDeposit,
      })
      .signers([participantB])
      .rpc();

    await program.methods
      .confirmMaster(0)
      .accounts({
        actor: payer.publicKey,
        masterPolicy: masterPolicyPda,
      })
      .rpc();

    await program.methods
      .confirmMaster(0)
      .accounts({
        actor: participantA.publicKey,
        masterPolicy: masterPolicyPda,
      })
      .signers([participantA])
      .rpc();

    await program.methods
      .confirmMaster(0)
      .accounts({
        actor: participantB.publicKey,
        masterPolicy: masterPolicyPda,
      })
      .signers([participantB])
      .rpc();

    await program.methods
      .confirmMaster(1)
      .accounts({
        actor: reinsurer.publicKey,
        masterPolicy: masterPolicyPda,
      })
      .signers([reinsurer])
      .rpc();

    await program.methods
      .activateMaster()
      .accounts({
        operator: payer.publicKey,
        masterPolicy: masterPolicyPda,
      })
      .rpc();

    const childPolicyId = new anchor.BN(1);
    const [flightPolicyPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("flight_policy"),
        masterPolicyPda.toBuffer(),
        childPolicyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createFlightPolicyFromMaster({
        childPolicyId,
        subscriberRef: "TEST_SUB_1",
        flightNo: "AB123",
        route: "ICN-SFO",
        departureTs: new anchor.BN(now + 600),
      })
      .accounts({
        creator: payer.publicKey,
        masterPolicy: masterPolicyPda,
        flightPolicy: flightPolicyPda,
        payerToken: payerToken,
        leaderDepositToken: leaderDeposit,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .resolveFlightDelay(360, false)
      .accounts({
        resolver: payer.publicKey,
        masterPolicy: masterPolicyPda,
        flightPolicy: flightPolicyPda,
      })
      .rpc();

    await program.methods
      .settleFlightClaim()
      .accounts({
        executor: payer.publicKey,
        masterPolicy: masterPolicyPda,
        flightPolicy: flightPolicyPda,
        leaderDepositToken: leaderDeposit,
        reinsurerPoolToken: reinsurerPool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: leaderPool, isWritable: true, isSigner: false },
        { pubkey: aPool, isWritable: true, isSigner: false },
        { pubkey: bPool, isWritable: true, isSigner: false },
      ])
      .rpc();

    const leaderDepositAcct = await getAccount(connection, leaderDeposit);
    const reinsurerPoolAcct = await getAccount(connection, reinsurerPool);
    const leaderPoolAcct = await getAccount(connection, leaderPool);
    const aPoolAcct = await getAccount(connection, aPool);
    const bPoolAcct = await getAccount(connection, bPool);

    assert.equal(leaderDepositAcct.amount, premiumAmount + payoutAmount);
    assert.equal(reinsurerPoolAcct.amount, 0n);
    assert.equal(leaderPoolAcct.amount, 0n);
    assert.equal(aPoolAcct.amount, 0n);
    assert.equal(bPoolAcct.amount, 0n);

    const flight = await program.account.flightPolicy.fetch(flightPolicyPda);
    assert.equal(flight.status, 3); // FlightPolicyStatus::Paid
  });
});
