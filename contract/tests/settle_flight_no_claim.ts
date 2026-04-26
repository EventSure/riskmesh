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

describe("settle_flight_no_claim", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const DECIMALS = 6;
  const UNIT = 1_000_000n;

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  // 공통 셋업: master + flight 생성 후 콜백 실행
  async function setupActiveMaster(
    masterId: anchor.BN,
    mint: PublicKey,
    opts: {
      cededRatioBps: number;
      reinsCommissionBps: number;
      effectiveBps: number;
      payoutDelay6H: bigint;
    }
  ) {
    const reinsurer = Keypair.generate();
    const participantA = Keypair.generate();
    const participantB = Keypair.generate();
    await airdrop(reinsurer.publicKey);
    await airdrop(participantA.publicKey);
    await airdrop(participantB.publicKey);

    const [masterAgreementPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("master_agreement"),
        payer.publicKey.toBuffer(),
        masterId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // leaderDeposit은 리더(payer) 소유 ATA(정산 목적지). 풀 지갑은 PDA 소유 에스크로.
    const leaderDeposit   = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
    const reinsurerPool   = await createAccount(connection, payer, mint, masterAgreementPda, Keypair.generate());
    const reinsurerDeposit = await createAccount(connection, payer, mint, masterAgreementPda, Keypair.generate());
    const leaderPool      = await createAccount(connection, payer, mint, masterAgreementPda, Keypair.generate());
    const aPool           = await createAccount(connection, payer, mint, masterAgreementPda, Keypair.generate());
    const bPool           = await createAccount(connection, payer, mint, masterAgreementPda, Keypair.generate());
    const aDeposit        = await createAccount(connection, payer, mint, participantA.publicKey);
    const bDeposit        = await createAccount(connection, payer, mint, participantB.publicKey);

    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createMasterAgreement({
        masterId,
        coverageStartTs: new anchor.BN(now - 10),
        coverageEndTs:   new anchor.BN(now + 3600),
        premiumPerPolicy: new anchor.BN(5_000_000),
        payoutDelay2H:   new anchor.BN(0),
        payoutDelay3H:   new anchor.BN(0),
        payoutDelay4To5H: new anchor.BN(0),
        payoutDelay6HOrCancelled: new anchor.BN(opts.payoutDelay6H.toString()),
        leaderShareBps: 5_000,
        cededRatioBps:      opts.cededRatioBps,
        reinsCommissionBps: opts.reinsCommissionBps,
        participants: [
          { insurer: participantA.publicKey,  shareBps: 3_000 },
          { insurer: participantB.publicKey,  shareBps: 2_000 },
        ],
        oracleFeed: PublicKey.default,
      })
      .accountsPartial({
        leader:                 payer.publicKey,
        operator:               payer.publicKey,
        reinsurer:              reinsurer.publicKey,
        currencyMint:           mint,
        masterAgreement:           masterAgreementPda,
        leaderDepositWallet:    leaderDeposit,
        reinsurerPoolWallet:    reinsurerPool,
        reinsurerDepositWallet: reinsurerDeposit,
        systemProgram:          SystemProgram.programId,
      })
      .rpc();

    for (const [insurer, pool, deposit, signers] of [
      [payer,         leaderPool, leaderDeposit, [] as Keypair[]],
      [participantA,  aPool,      aDeposit,      [participantA]],
      [participantB,  bPool,      bDeposit,      [participantB]],
    ] as const) {
      await program.methods
        .registerParticipantWallets()
        .accounts({ insurer: insurer.publicKey, masterAgreement: masterAgreementPda, poolWallet: pool, depositWallet: deposit })
        .signers([...signers])
        .rpc();
      await program.methods
        .confirmMaster(0)
        .accounts({ actor: insurer.publicKey, masterAgreement: masterAgreementPda })
        .signers([...signers])
        .rpc();
    }
    if (opts.cededRatioBps > 0) {
      await program.methods
        .confirmMaster(1)
        .accounts({ actor: reinsurer.publicKey, masterAgreement: masterAgreementPda })
        .signers([reinsurer])
        .rpc();
    }
    await program.methods
      .activateMaster()
      .accounts({ operator: payer.publicKey, masterAgreement: masterAgreementPda })
      .rpc();

    return { masterAgreementPda, leaderDeposit, leaderPool, reinsurerDeposit, aDeposit, bDeposit };
  }

  it("distributes premium correctly on NoClaim (with reinsurance)", async () => {
    // premium 5 USDC, ceded 50%, commission 10% → effective_reinsurer = 45%
    // reinsurer_amount = 5 * 45% = 2.25 USDC
    // insurer_total   = 5 * 55% = 2.75 USDC → leader 50% + A 30% + B 20%
    const premiumAmount = 5n * UNIT;
    const reinsurerAmount = 2_250_000n; // 2.25 USDC
    const leaderShare     = 1_375_000n; // 1.375 USDC
    const aShare          = 825_000n;   // 0.825 USDC
    const bShare          = 550_000n;   // 0.55 USDC

    const mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
    const { masterAgreementPda, leaderDeposit, leaderPool, reinsurerDeposit, aDeposit, bDeposit } =
      await setupActiveMaster(new anchor.BN(10), mint, {
        cededRatioBps: 5_000,
        reinsCommissionBps: 1_000,
        effectiveBps: 4_500,
        payoutDelay6H: 80n * UNIT,
      });

    // 프리미엄 지불용 토큰 계정
    const payerToken = await createAccount(connection, payer, mint, payer.publicKey);
    await mintTo(connection, payer, mint, payerToken, payer, premiumAmount);

    const childPolicyId = new anchor.BN(1);
    const [flightPolicyPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("flight_policy"),
        masterAgreementPda.toBuffer(),
        childPolicyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createFlightPolicyFromMaster({
        childPolicyId,
        subscriberRef: "SUB_NC_1",
        flightNo:       "KE001",
        route:          "ICN-NRT",
        departureTs:    new anchor.BN(Math.floor(Date.now() / 1000) + 600),
      })
      .accountsPartial({
        creator:            payer.publicKey,
        masterAgreement:       masterAgreementPda,
        flightPolicy:       flightPolicyPda,
        payerToken,
        leaderPoolToken:    leaderPool,
        tokenProgram:       TOKEN_PROGRAM_ID,
        systemProgram:      SystemProgram.programId,
      })
      .rpc();

    // 지연 없음 (0분) → NoClaim
    await program.methods
      .resolveFlightDelay(0, false)
      .accounts({ resolver: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda })
      .rpc();

    const fpBeforeSettle = await program.account.flightPolicy.fetch(flightPolicyPda);
    assert.equal(fpBeforeSettle.status, 4); // NoClaim

    await program.methods
      .settleFlightNoClaim()
      .accountsPartial({
        executor:              payer.publicKey,
        masterAgreement:          masterAgreementPda,
        flightPolicy:          flightPolicyPda,
        leaderPoolToken:       leaderPool,
        leaderDepositToken:    leaderDeposit,
        reinsurerDepositToken: reinsurerDeposit,
        tokenProgram:          TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: aDeposit,      isWritable: true, isSigner: false },
        { pubkey: bDeposit,      isWritable: true, isSigner: false },
      ])
      .rpc();

    const leaderDepositAcct   = await getAccount(connection, leaderDeposit);
    const reinsurerDepositAcct = await getAccount(connection, reinsurerDeposit);
    const aDepositAcct        = await getAccount(connection, aDeposit);
    const bDepositAcct        = await getAccount(connection, bDeposit);

    // leader share는 leaderDeposit(=leader deposit_wallet)에 잔류 (자기 자신으로 전송 = no-op)
    assert.equal(leaderDepositAcct.amount,    leaderShare,    "leader share");
    assert.equal(reinsurerDepositAcct.amount, reinsurerAmount, "reinsurer share");
    assert.equal(aDepositAcct.amount,         aShare,         "participant A share");
    assert.equal(bDepositAcct.amount,         bShare,         "participant B share");

    const fp = await program.account.flightPolicy.fetch(flightPolicyPda);
    assert.equal(fp.status, 5);              // Expired
    assert.equal(fp.premiumDistributed, true);
  });

  it("distributes full premium to insurers when ceded_ratio is 0", async () => {
    // ceded=0 → reinsurer_amount=0, 전액 참여사에게 배분
    // premiumPerPolicy=5 USDC (setupActiveMaster 고정값)
    const premiumAmount = 5n * UNIT;
    const leaderShare   = 2_500_000n; // 5 * 50%
    const aShare        = 1_500_000n; // 5 * 30%
    const bShare        = 1_000_000n; // 5 * 20%

    const mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
    const { masterAgreementPda, leaderDeposit, leaderPool, reinsurerDeposit, aDeposit, bDeposit } =
      await setupActiveMaster(new anchor.BN(11), mint, {
        cededRatioBps: 0,
        reinsCommissionBps: 0,
        effectiveBps: 0,
        payoutDelay6H: 10n * UNIT,
      });

    const payerToken = await createAccount(connection, payer, mint, payer.publicKey);
    // premiumPerPolicy는 setupActiveMaster에서 5_000_000으로 고정
    await mintTo(connection, payer, mint, payerToken, payer, 5_000_000);

    const childPolicyId = new anchor.BN(1);
    const [flightPolicyPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("flight_policy"),
        masterAgreementPda.toBuffer(),
        childPolicyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createFlightPolicyFromMaster({
        childPolicyId,
        subscriberRef: "SUB_NC_2",
        flightNo:      "OZ002",
        route:         "ICN-LAX",
        departureTs:   new anchor.BN(Math.floor(Date.now() / 1000) + 600),
      })
      .accountsPartial({
        creator: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda,
        payerToken, leaderPoolToken: leaderPool,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 100분 지연 → 120분 미만 → NoClaim
    await program.methods
      .resolveFlightDelay(100, false)
      .accounts({ resolver: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda })
      .rpc();

    await program.methods
      .settleFlightNoClaim()
      .accountsPartial({
        executor: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda,
        leaderPoolToken: leaderPool, leaderDepositToken: leaderDeposit, reinsurerDepositToken: reinsurerDeposit,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: aDeposit,      isWritable: true, isSigner: false },
        { pubkey: bDeposit,      isWritable: true, isSigner: false },
      ])
      .rpc();

    const leaderDepositAcct    = await getAccount(connection, leaderDeposit);
    const reinsurerDepositAcct = await getAccount(connection, reinsurerDeposit);
    const aDepositAcct         = await getAccount(connection, aDeposit);
    const bDepositAcct         = await getAccount(connection, bDeposit);

    assert.equal(reinsurerDepositAcct.amount, 0n,         "reinsurer gets nothing (ceded=0)");
    assert.equal(leaderDepositAcct.amount,    leaderShare, "leader share");
    assert.equal(aDepositAcct.amount,         aShare,     "participant A share");
    assert.equal(bDepositAcct.amount,         bShare,     "participant B share");
  });

  it("sets NoClaim when delay is exactly 119 minutes (threshold boundary)", async () => {
    const premiumAmount = 1n * UNIT;
    const mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
    const { masterAgreementPda, leaderDeposit, leaderPool, reinsurerDeposit, aDeposit, bDeposit } =
      await setupActiveMaster(new anchor.BN(12), mint, {
        cededRatioBps: 0,
        reinsCommissionBps: 0,
        effectiveBps: 0,
        payoutDelay6H: 10n * UNIT,
      });

    const payerToken = await createAccount(connection, payer, mint, payer.publicKey);
    await mintTo(connection, payer, mint, payerToken, payer, 5_000_000);

    const childPolicyId = new anchor.BN(1);
    const [flightPolicyPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("flight_policy"),
        masterAgreementPda.toBuffer(),
        childPolicyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createFlightPolicyFromMaster({
        childPolicyId, subscriberRef: "SUB_NC_3", flightNo: "LJ003", route: "GMP-CJU",
        departureTs: new anchor.BN(Math.floor(Date.now() / 1000) + 600),
      })
      .accountsPartial({
        creator: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda,
        payerToken, leaderPoolToken: leaderPool,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 119분 = 120분 미만 → payout=0 → NoClaim
    await program.methods
      .resolveFlightDelay(119, false)
      .accounts({ resolver: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda })
      .rpc();

    const fp = await program.account.flightPolicy.fetch(flightPolicyPda);
    assert.equal(fp.status,       4); // NoClaim
    assert.equal(fp.payoutAmount.toNumber(), 0);

    await program.methods
      .settleFlightNoClaim()
      .accountsPartial({
        executor: payer.publicKey, masterAgreement: masterAgreementPda, flightPolicy: flightPolicyPda,
        leaderPoolToken: leaderPool, leaderDepositToken: leaderDeposit, reinsurerDepositToken: reinsurerDeposit,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: aDeposit,      isWritable: true, isSigner: false },
        { pubkey: bDeposit,      isWritable: true, isSigner: false },
      ])
      .rpc();

    const fpAfter = await program.account.flightPolicy.fetch(flightPolicyPda);
    assert.equal(fpAfter.status, 5); // Expired
    assert.equal(fpAfter.premiumDistributed, true);
  });
});
