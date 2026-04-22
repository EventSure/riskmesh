/**
 * payout_tiers.ts
 *
 * 4단계 payout tier 전체 + cancelled=true 를 온체인에서 검증한다.
 *
 * 하나의 Active Master 아래 각 tier마다 별도 FlightPolicy를 생성해
 * resolve → settle 전 과정을 실행하고, 풀 잔액 증감이 예상치와 일치하는지 확인한다.
 *
 * Master 설정 (ceded=0, 단일 참여사=payer):
 *   payout_delay_2h            = 2 USDC
 *   payout_delay_3h            = 3 USDC
 *   payout_delay_4to5h         = 4 USDC
 *   payout_delay_6h_or_cancelled = 6 USDC
 *   premium_per_policy         = 1 USDC
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

describe("payout_tiers", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const UNIT = 1_000_000n;
  const PAYOUT_2H    = 2n * UNIT;
  const PAYOUT_3H    = 3n * UNIT;
  const PAYOUT_4TO5H = 4n * UNIT;
  const PAYOUT_6H    = 6n * UNIT;
  const PREMIUM      = 1n * UNIT;

  let masterPolicyPda: PublicKey;
  let leaderDeposit: PublicKey;
  let leaderPool: PublicKey;
  let participantPool: PublicKey;
  let participantDeposit: PublicKey;
  let reinsurerPool: PublicKey;
  let reinsurerDeposit: PublicKey;
  let payerToken: PublicKey;
  let nextChildId = 1;

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  before(async () => {
    const reinsurer = Keypair.generate();
    const participant = Keypair.generate();
    await airdrop(reinsurer.publicKey);
    await airdrop(participant.publicKey);

    const mint = await createMint(connection, payer, payer.publicKey, null, 6);
    const masterId = new anchor.BN(30);

    [masterPolicyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("master_policy"), payer.publicKey.toBuffer(), masterId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    leaderDeposit    = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
    reinsurerPool    = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    reinsurerDeposit = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    leaderPool       = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    participantPool  = await createAccount(connection, payer, mint, masterPolicyPda, Keypair.generate());
    participantDeposit = await createAccount(connection, payer, mint, participant.publicKey);

    // 풀: 6 tiers × 6 USDC = 36 USDC (충분히 적립)
    await mintTo(connection, payer, mint, leaderPool, payer, 18_000_000);
    await mintTo(connection, payer, mint, participantPool, payer, 18_000_000);

    // 프리미엄 지불 계정: 6 flights × 1 USDC
    payerToken = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
    await mintTo(connection, payer, mint, payerToken, payer, 6_000_000);

    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .createMasterPolicy({
        masterId,
        coverageStartTs: new anchor.BN(now - 10),
        coverageEndTs:   new anchor.BN(now + 86400),
        premiumPerPolicy: new anchor.BN(PREMIUM.toString()),
        payoutDelay2H:            new anchor.BN(PAYOUT_2H.toString()),
        payoutDelay3H:            new anchor.BN(PAYOUT_3H.toString()),
        payoutDelay4To5H:         new anchor.BN(PAYOUT_4TO5H.toString()),
        payoutDelay6HOrCancelled: new anchor.BN(PAYOUT_6H.toString()),
        leaderShareBps:      5_000,
        cededRatioBps:      0,
        reinsCommissionBps: 0,
        participants: [{ insurer: participant.publicKey, shareBps: 5_000 }],
        oracleFeed: PublicKey.default,
      })
      .accountsPartial({
        leader: payer.publicKey, operator: payer.publicKey,
        reinsurer: reinsurer.publicKey, currencyMint: mint,
        masterPolicy: masterPolicyPda,
        leaderDepositWallet:    leaderDeposit,
        reinsurerPoolWallet:    reinsurerPool,
        reinsurerDepositWallet: reinsurerDeposit,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .registerParticipantWallets()
      .accounts({ insurer: payer.publicKey, masterPolicy: masterPolicyPda, poolWallet: leaderPool, depositWallet: leaderDeposit })
      .rpc();
    await program.methods
      .registerParticipantWallets()
      .accounts({ insurer: participant.publicKey, masterPolicy: masterPolicyPda, poolWallet: participantPool, depositWallet: participantDeposit })
      .signers([participant])
      .rpc();
    await program.methods.confirmMaster(0).accounts({ actor: payer.publicKey, masterPolicy: masterPolicyPda }).rpc();
    await program.methods.confirmMaster(0).accounts({ actor: participant.publicKey, masterPolicy: masterPolicyPda }).signers([participant]).rpc();
    await program.methods.activateMaster().accounts({ operator: payer.publicKey, masterPolicy: masterPolicyPda }).rpc();
  });

  /**
   * 공통 헬퍼: flight 생성 → resolve → settle 전 과정 실행 후 잔액 증감을 검증
   * @param delayMinutes  resolve에 전달할 지연 분 수
   * @param cancelled     결항 여부
   * @param expectedPayout 기대 payout (bigint, 0이면 NoClaim)
   */
  async function runAndVerify(
    delayMinutes: number,
    cancelled: boolean,
    expectedPayout: bigint
  ): Promise<void> {
    const childId = new anchor.BN(nextChildId++);
    const [flightPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("flight_policy"), masterPolicyPda.toBuffer(), childId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .createFlightPolicyFromMaster({
        childPolicyId:  childId,
        subscriberRef:  `SUB_T${childId.toNumber()}`,
        flightNo:       `TP${String(childId.toNumber()).padStart(3, "0")}`,
        route:          "ICN-NRT",
        departureTs:    new anchor.BN(Math.floor(Date.now() / 1000) + 600),
      })
      .accountsPartial({
        creator: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flightPda,
        payerToken, leaderPoolToken: leaderPool,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .resolveFlightDelay(delayMinutes, cancelled)
      .accounts({ resolver: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flightPda })
      .rpc();

    const fp = await program.account.flightPolicy.fetch(flightPda);
    const expectedStatus = expectedPayout > 0n ? 2 : 4; // Claimable or NoClaim
    assert.equal(fp.status, expectedStatus, `status (delay=${delayMinutes}, cancelled=${cancelled})`);
    assert.equal(BigInt(fp.payoutAmount.toString()), expectedPayout, "payout_amount");

    // resolve 결과만 검증하는 경우 (NoClaim) settle 스킵
    if (expectedPayout === 0n) return;

    // settle 전후 잔액 스냅샷으로 증감 검증
    const leaderPoolBefore = await getAccount(connection, leaderPool);
    const participantPoolBefore = await getAccount(connection, participantPool);
    const depositBefore = await getAccount(connection, leaderDeposit);

    await program.methods
      .settleFlightClaim()
      .accountsPartial({
        executor: payer.publicKey, masterPolicy: masterPolicyPda, flightPolicy: flightPda,
        leaderDepositToken: leaderDeposit, leaderPoolToken: leaderPool, reinsurerPoolToken: reinsurerPool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([{ pubkey: participantPool, isWritable: true, isSigner: false }])
      .rpc();

    const leaderPoolAfter = await getAccount(connection, leaderPool);
    const participantPoolAfter = await getAccount(connection, participantPool);
    const depositAfter = await getAccount(connection, leaderDeposit);

    // ceded=0, 스냅샷은 premium이 이미 deposit에 쌓인 후 측정됨.
    // settle은 payout만 pool → deposit으로 이동.
    assert.equal(
      (leaderPoolBefore.amount - leaderPoolAfter.amount) + (participantPoolBefore.amount - participantPoolAfter.amount),
      expectedPayout,
      "total pool 감소량"
    );
    assert.equal(depositAfter.amount - depositBefore.amount, expectedPayout, "deposit 유입량");

    const fpAfter = await program.account.flightPolicy.fetch(flightPda);
    assert.equal(fpAfter.status, 3); // Paid
  }

  it("delay=120 min → 2H payout tier", async () => {
    await runAndVerify(120, false, PAYOUT_2H);
  });

  it("delay=180 min → 3H payout tier", async () => {
    await runAndVerify(180, false, PAYOUT_3H);
  });

  it("delay=240 min → 4-5H payout tier", async () => {
    await runAndVerify(240, false, PAYOUT_4TO5H);
  });

  it("delay=360 min → 6H payout tier", async () => {
    await runAndVerify(360, false, PAYOUT_6H);
  });

  it("cancelled=true with delay=0 → max payout regardless of delay", async () => {
    await runAndVerify(0, true, PAYOUT_6H);
  });

  it("cancelled=true overrides lower delay tier (delay=130 min → still max payout)", async () => {
    await runAndVerify(130, true, PAYOUT_6H);
  });
});
