/**
 * multiple_flights.ts
 *
 * 하나의 Active Master 아래 여러 FlightPolicy를 독립적으로 운용하는 시나리오를 검증한다.
 *
 * 시나리오:
 *   - flight1: 200분 지연 → Claimable → Paid
 *   - flight2: 50분 지연  → NoClaim  → Expired
 *   - flight3: cancelled  → Claimable → Paid
 *
 * 검증 목표:
 *   1. 각 FlightPolicy가 독립적으로 상태 전환됨
 *   2. 한 Flight 정산이 다른 Flight 상태에 영향을 주지 않음
 *   3. 두 Claimable Flight의 payout이 독립적으로 계산됨
 *   4. NoClaim 프리미엄 분배가 다른 Flight 풀 잔액에 영향을 주지 않음
 */
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

describe("multiple_flights", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const UNIT        = 1_000_000n;
  const PREMIUM     = 1n * UNIT;        // 1 USDC
  const PAYOUT_3H   = 3n * UNIT;        // flight1: 200min → 3H tier
  const PAYOUT_MAX  = 6n * UNIT;        // flight3: cancelled → max tier

  // ceded=50%, commission=10% → effective=45%
  const EFFECTIVE_BPS = 4_500n;
  const BPS_DENOM     = 10_000n;

  let masterPolicyPda: PublicKey;
  let leaderDeposit: PublicKey;
  let reinsurerDeposit: PublicKey;
  let leaderPool: PublicKey;
  let aPool: PublicKey;
  let reinsurerPool: PublicKey;
  let aDeposit: PublicKey;

  let flight1Pda: PublicKey;
  let flight2Pda: PublicKey;
  let flight3Pda: PublicKey;

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  before(async () => {
    const reinsurer   = Keypair.generate();
    const participantA = Keypair.generate();
    await airdrop(reinsurer.publicKey);
    await airdrop(participantA.publicKey);

    const mint     = await createMint(connection, payer, payer.publicKey, null, 6);
    const masterId = new anchor.BN(40);

    [masterPolicyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("master_policy"), payer.publicKey.toBuffer(), masterId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    leaderDeposit    = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
    reinsurerPool    = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    reinsurerDeposit = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    leaderPool       = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    aPool            = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    aDeposit         = await createAccount(connection, payer, mint, participantA.publicKey);

    // flight1(3H=3USDC) + flight3(6H=6USDC) 정산 충당:
    // reins가 45%, payer(50%)는 leaderPool에서, A(50%)는 aPool에서
    // flight1: reins=1.35, leader=0.825, A=0.825 → pool 합산 = 2.4+1.65+1.65 = 정확히는:
    //   총 payout=3, reins=3*0.45=1.35, insurer=1.65 → leader 50%=0.825, A 50%=0.825 (payer=5000, A=5000 bps)
    // Wait, I'm using payer=50% and A=50% in this test
    // flight1: payout=3, reins=1.35, insurer=1.65 → leader=0.825, A=0.825
    // flight3: payout=6, reins=2.7,  insurer=3.3  → leader=1.65,  A=1.65
    // Total pool needed: leaderPool = 0.825+1.65 = 2.475, aPool = 0.825+1.65 = 2.475, reinsurerPool = 1.35+2.7 = 4.05
    // Rounding: split_by_bps may add remainder to first slot
    // Let's mint generously
    await mintTo(connection, payer, mint, reinsurerPool, payer, 6_000_000);  // 6 USDC
    await mintTo(connection, payer, mint, leaderPool,    payer, 4_000_000);  // 4 USDC
    await mintTo(connection, payer, mint, aPool,         payer, 4_000_000);  // 4 USDC

    // 프리미엄 지불: 3 flights × 1 USDC = 3 USDC
    const payerToken = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
    await mintTo(connection, payer, mint, payerToken, payer, 3_000_000);

    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .createMasterPolicy({
        masterId,
        coverageStartTs: new anchor.BN(now - 10),
        coverageEndTs:   new anchor.BN(now + 86400),
        premiumPerPolicy: new anchor.BN(PREMIUM.toString()),
        payoutDelay2H:            new anchor.BN(2_000_000),
        payoutDelay3H:            new anchor.BN(PAYOUT_3H.toString()),
        payoutDelay4To5H:         new anchor.BN(4_000_000),
        payoutDelay6HOrCancelled: new anchor.BN(PAYOUT_MAX.toString()),
        leaderShareBps:     5_000,
        cededRatioBps:      5_000,
        reinsCommissionBps: 1_000,
        participants: [
          { insurer: participantA.publicKey,  shareBps: 5_000 },
        ],
        oracleFeed: PublicKey.default,
      })
      .accountsPartial({
        leader: payer.publicKey, operator: payer.publicKey,
        reinsurer: reinsurer.publicKey, currencyMint: mint,
        masterPolicy:           masterPolicyPda,
        leaderDepositWallet:    leaderDeposit,
        reinsurerPoolWallet:    reinsurerPool,
        reinsurerDepositWallet: reinsurerDeposit,
        systemProgram:          SystemProgram.programId,
      })
      .rpc();

    for (const [actor, pool, deposit, signers] of [
      [payer,         leaderPool, leaderDeposit, [] as Keypair[]],
      [participantA,  aPool,      aDeposit,      [participantA]],
    ] as const) {
      await program.methods
        .registerParticipantWallets()
        .accounts({ insurer: actor.publicKey, masterPolicy: masterPolicyPda, poolWallet: pool, depositWallet: deposit })
        .signers([...signers])
        .rpc();
      await program.methods
        .confirmMaster(0)
        .accounts({ actor: actor.publicKey, masterPolicy: masterPolicyPda })
        .signers([...signers])
        .rpc();
    }
    await program.methods.confirmMaster(1).accounts({ actor: reinsurer.publicKey, masterPolicy: masterPolicyPda }).signers([reinsurer]).rpc();
    await program.methods.activateMaster().accounts({ operator: payer.publicKey, masterPolicy: masterPolicyPda }).rpc();

    // FlightPolicy PDAs
    for (const [n, ref] of [[1, "F1"], [2, "F2"], [3, "F3"]] as const) {
      const childId = new anchor.BN(n);
      const [fpPda]  = PublicKey.findProgramAddressSync(
        [Buffer.from("flight_policy"), masterPolicyPda.toBuffer(), childId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      await program.methods
        .createFlightPolicyFromMaster({
          childPolicyId: childId,
          subscriberRef: `SUB_${ref}`,
          flightNo:      `MF00${n}`,
          route:         "ICN-SFO",
          departureTs:   new anchor.BN(now + 600),
        })
        .accountsPartial({
          creator: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: fpPda,
          payerToken, leaderPoolToken: leaderPool,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .rpc();
      if (n === 1) flight1Pda = fpPda;
      else if (n === 2) flight2Pda = fpPda;
      else flight3Pda = fpPda;
    }
  });

  it("creates 3 independent FlightPolicies all in AwaitingOracle state", async () => {
    for (const fpPda of [flight1Pda, flight2Pda, flight3Pda]) {
      const fp = await program.account.flightPolicy.fetch(fpPda);
      assert.equal(fp.status, 1); // AwaitingOracle
    }

    // leader pool에 초기 4 USDC 펀딩 + 3×premium = 7 USDC 적립됐는지 확인
    const pool = await getAccount(connection, leaderPool);
    assert.equal(pool.amount, 4_000_000n + 3n * UNIT);
  });

  it("resolves each flight to correct status independently", async () => {
    await program.methods
      .resolveFlightDelay(200, false) // 3H tier → Claimable
      .accounts({ resolver: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flight1Pda })
      .rpc();

    await program.methods
      .resolveFlightDelay(50, false)  // < 120min → NoClaim
      .accounts({ resolver: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flight2Pda })
      .rpc();

    await program.methods
      .resolveFlightDelay(0, true)    // cancelled → max payout
      .accounts({ resolver: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flight3Pda })
      .rpc();

    const fp1 = await program.account.flightPolicy.fetch(flight1Pda);
    const fp2 = await program.account.flightPolicy.fetch(flight2Pda);
    const fp3 = await program.account.flightPolicy.fetch(flight3Pda);

    assert.equal(fp1.status, 2); // Claimable
    assert.equal(fp2.status, 4); // NoClaim
    assert.equal(fp3.status, 2); // Claimable

    assert.equal(BigInt(fp1.payoutAmount.toString()), PAYOUT_3H);
    assert.equal(BigInt(fp2.payoutAmount.toString()), 0n);
    assert.equal(BigInt(fp3.payoutAmount.toString()), PAYOUT_MAX);
  });

  it("settles flight1 (Claimable) without affecting flight2 or flight3", async () => {
    const fp2Before = await program.account.flightPolicy.fetch(flight2Pda);
    const fp3Before = await program.account.flightPolicy.fetch(flight3Pda);

    await program.methods
      .settleFlightClaim()
      .accountsPartial({
        executor: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flight1Pda,
        leaderDepositToken: leaderDeposit, leaderPoolToken: leaderPool, reinsurerPoolToken: reinsurerPool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: aPool,      isWritable: true, isSigner: false },
      ])
      .rpc();

    const fp1After = await program.account.flightPolicy.fetch(flight1Pda);
    const fp2After = await program.account.flightPolicy.fetch(flight2Pda);
    const fp3After = await program.account.flightPolicy.fetch(flight3Pda);

    assert.equal(fp1After.status, 3); // Paid
    assert.equal(fp2After.status, fp2Before.status); // NoClaim — 변경 없음
    assert.equal(fp3After.status, fp3Before.status); // Claimable — 변경 없음
  });

  it("settles flight2 (NoClaim) without affecting flight3", async () => {
    const fp3Before = await program.account.flightPolicy.fetch(flight3Pda);

    await program.methods
      .settleFlightNoClaim()
      .accountsPartial({
        executor: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flight2Pda,
        leaderPoolToken: leaderPool, leaderDepositToken: leaderDeposit, reinsurerDepositToken: reinsurerDeposit,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: aDeposit,      isWritable: true, isSigner: false },
      ])
      .rpc();

    const fp2After = await program.account.flightPolicy.fetch(flight2Pda);
    const fp3After = await program.account.flightPolicy.fetch(flight3Pda);

    assert.equal(fp2After.status, 5); // Expired
    assert.equal(fp2After.premiumDistributed, true);
    assert.equal(fp3After.status, fp3Before.status); // Claimable — 변경 없음
  });

  it("settles flight3 (cancelled, Claimable) and verifies final pool balances", async () => {
    const poolBefore = await getAccount(connection, leaderPool);

    await program.methods
      .settleFlightClaim()
      .accountsPartial({
        executor: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flight3Pda,
        leaderDepositToken: leaderDeposit, leaderPoolToken: leaderPool, reinsurerPoolToken: reinsurerPool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        { pubkey: aPool,      isWritable: true, isSigner: false },
      ])
      .rpc();

    const fp3After = await program.account.flightPolicy.fetch(flight3Pda);
    assert.equal(fp3After.status, 3); // Paid

    // ceded=50%, comm=10% → effective=45%
    // flight3 payout=6 USDC: reins=2.7, insurer=3.3 → leader(50%)=1.65, A(50%)=1.65
    const reinsurerContrib = PAYOUT_MAX * EFFECTIVE_BPS / BPS_DENOM; // 2.7 USDC
    const insurerTotal = PAYOUT_MAX - reinsurerContrib;               // 3.3 USDC
    // split_by_bps([5000, 5000]): 3.3/2=1.65 each (exact, no rounding)
    const leaderContrib = insurerTotal / 2n;

    const poolAfter = await getAccount(connection, leaderPool);
    assert.equal(
      poolBefore.amount - poolAfter.amount,
      leaderContrib,
      "leaderPool 감소량 = flight3 leader 부담분"
    );
  });
});
