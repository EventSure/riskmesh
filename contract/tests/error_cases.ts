/**
 * error_cases.ts
 *
 * 인가·상태·입력 오류 케이스 모음.
 * 각 테스트는 특정 OpenParamError 코드를 기대하고 트랜잭션이 실패하는지 검증한다.
 */
import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { OpenParametric } from "../target/types/open_parametric";
import { strict as assert } from "assert";

describe("error_cases", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  let mint: PublicKey;

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  }

  /** 오류 코드가 일치하는지 검증하는 헬퍼 */
  function assertAnchorError(err: unknown, expectedCode: string): void {
    assert.ok(err instanceof AnchorError, `AnchorError가 아님: ${err}`);
    assert.equal(
      err.error.errorCode.code,
      expectedCode,
      `오류 코드 불일치. 실제: ${err.error.errorCode.code}, 기대: ${expectedCode}`
    );
  }

  /** masterId에 해당하는 Master PDA 반환 */
  function masterPda(masterId: anchor.BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("master_agreement"), payer.publicKey.toBuffer(), masterId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
  }

  /** flightPolicyId에 해당하는 Flight PDA 반환 */
  function flightPda(masterAgreementPda: PublicKey, childId: anchor.BN): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("flight_policy"), masterAgreementPda.toBuffer(), childId.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];
  }

  /** Active 상태의 Master 생성 (단일 참여사=payer) */
  async function createActiveMaster(masterId: anchor.BN) {
    const reinsurer = Keypair.generate();
    const participant = Keypair.generate();
    await airdrop(reinsurer.publicKey);
    await airdrop(participant.publicKey);
    const pda = masterPda(masterId);

    const leaderDeposit    = await createAccount(connection, payer, mint, pda, Keypair.generate());
    const reinsurerPool    = await createAccount(connection, payer, mint, pda, Keypair.generate());
    const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
    const leaderPool       = await createAccount(connection, payer, mint, pda, Keypair.generate());
    const participantPool  = await createAccount(connection, payer, mint, pda, Keypair.generate());
    const participantDeposit = await createAccount(connection, payer, mint, participant.publicKey);
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .createMasterAgreement({
        masterId,
        coverageStartTs: new anchor.BN(now - 10),
        coverageEndTs:   new anchor.BN(now + 3600),
        premiumPerPolicy: new anchor.BN(1_000_000),
        payoutDelay2H: new anchor.BN(0),
        payoutDelay3H: new anchor.BN(0),
        payoutDelay4To5H: new anchor.BN(0),
        payoutDelay6HOrCancelled: new anchor.BN(5_000_000),
        leaderShareBps: 5_000,
        cededRatioBps: 0,
        reinsCommissionBps: 0,
        participants: [{ insurer: participant.publicKey, shareBps: 5_000 }],
        oracleFeed: PublicKey.default,
      })
      .accountsPartial({
        leader: payer.publicKey, operator: payer.publicKey,
        reinsurer: reinsurer.publicKey, currencyMint: mint, masterAgreement: pda,
        leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
        reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .registerParticipantWallets()
      .accounts({ insurer: payer.publicKey, masterAgreement: pda, poolWallet: leaderPool, depositWallet: leaderDeposit })
      .rpc();
    await program.methods
      .registerParticipantWallets()
      .accounts({ insurer: participant.publicKey, masterAgreement: pda, poolWallet: participantPool, depositWallet: participantDeposit })
      .signers([participant])
      .rpc();
    await program.methods.confirmMaster(0).accounts({ actor: payer.publicKey, masterAgreement: pda }).rpc();
    await program.methods.confirmMaster(0).accounts({ actor: participant.publicKey, masterAgreement: pda }).signers([participant]).rpc();
    await program.methods.activateMaster().accounts({ operator: payer.publicKey, masterAgreement: pda }).rpc();

    return { pda, leaderDeposit, reinsurerDeposit, leaderPool, participantPool, participantDeposit, reinsurer };
  }

  before(async () => {
    mint = await createMint(connection, payer, payer.publicKey, null, 6);
  });

  // ── createMasterAgreement 입력 검증 ─────────────────────────────────────────────

  describe("createMasterAgreement validation", () => {
    it("rejects participants whose share_bps do not sum to 10000", async () => {
      const pda = masterPda(new anchor.BN(200));
      const leaderDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerPool = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .createMasterAgreement({
            masterId: new anchor.BN(200),
            coverageStartTs: new anchor.BN(now),
            coverageEndTs:   new anchor.BN(now + 3600),
            premiumPerPolicy: new anchor.BN(1_000_000),
            payoutDelay2H: new anchor.BN(0), payoutDelay3H: new anchor.BN(0),
            payoutDelay4To5H: new anchor.BN(0), payoutDelay6HOrCancelled: new anchor.BN(0),
            leaderShareBps: 5_000,
            cededRatioBps: 0, reinsCommissionBps: 0,
            // 합계 = 9000 (≠ 10000)
            participants: [
              { insurer: Keypair.generate().publicKey, shareBps: 4_000 },
            ],
            oracleFeed: PublicKey.default,
          })
          .accountsPartial({
            leader: payer.publicKey, operator: payer.publicKey,
            reinsurer: Keypair.generate().publicKey, currencyMint: mint, masterAgreement: pda,
            leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
            reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidRatio");
      }
    });

    it("rejects when no participants are provided (leader-only)", async () => {
      const pda = masterPda(new anchor.BN(202));
      const leaderDeposit    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerPool    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .createMasterAgreement({
            masterId: new anchor.BN(202),
            coverageStartTs: new anchor.BN(now),
            coverageEndTs:   new anchor.BN(now + 3600),
            premiumPerPolicy: new anchor.BN(1_000_000),
            payoutDelay2H: new anchor.BN(0), payoutDelay3H: new anchor.BN(0),
            payoutDelay4To5H: new anchor.BN(0), payoutDelay6HOrCancelled: new anchor.BN(0),
            leaderShareBps: 10_000,
            cededRatioBps: 0, reinsCommissionBps: 0,
            participants: [],
            oracleFeed: PublicKey.default,
          })
          .accountsPartial({
            leader: payer.publicKey, operator: payer.publicKey,
            reinsurer: Keypair.generate().publicKey, currencyMint: mint, masterAgreement: pda,
            leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
            reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidInput");
      }
    });

    it("rejects when participant count exceeds MAX_MASTER_PARTICIPANTS (6명)", async () => {
      const pda = masterPda(new anchor.BN(203));
      const leaderDeposit    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerPool    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .createMasterAgreement({
            masterId: new anchor.BN(203),
            coverageStartTs: new anchor.BN(now),
            coverageEndTs:   new anchor.BN(now + 3600),
            premiumPerPolicy: new anchor.BN(1_000_000),
            payoutDelay2H: new anchor.BN(0), payoutDelay3H: new anchor.BN(0),
            payoutDelay4To5H: new anchor.BN(0), payoutDelay6HOrCancelled: new anchor.BN(0),
            leaderShareBps: 4_000,
            cededRatioBps: 0, reinsCommissionBps: 0,
            participants: Array.from({ length: 6 }, () => ({
              insurer: Keypair.generate().publicKey,
              shareBps: 1_000,
            })),
            oracleFeed: PublicKey.default,
          })
          .accountsPartial({
            leader: payer.publicKey, operator: payer.publicKey,
            reinsurer: Keypair.generate().publicKey, currencyMint: mint, masterAgreement: pda,
            leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
            reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidInput");
      }
    });

    it("rejects when leader is included in the participants list", async () => {
      const pda = masterPda(new anchor.BN(201));
      const leaderDeposit    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerPool    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const stranger = Keypair.generate();
      const now = Math.floor(Date.now() / 1000);

      try {
        await program.methods
          .createMasterAgreement({
            masterId: new anchor.BN(201),
            coverageStartTs: new anchor.BN(now),
            coverageEndTs:   new anchor.BN(now + 3600),
            premiumPerPolicy: new anchor.BN(1_000_000),
            payoutDelay2H: new anchor.BN(0), payoutDelay3H: new anchor.BN(0),
            payoutDelay4To5H: new anchor.BN(0), payoutDelay6HOrCancelled: new anchor.BN(0),
            leaderShareBps: 5_000,
            cededRatioBps: 0, reinsCommissionBps: 0,
            participants: [
              { insurer: payer.publicKey, shareBps: 5_000 },
              { insurer: stranger.publicKey, shareBps: 5_000 },
            ],
            oracleFeed: PublicKey.default,
          })
          .accountsPartial({
            leader: payer.publicKey, operator: payer.publicKey,
            reinsurer: Keypair.generate().publicKey, currencyMint: mint, masterAgreement: pda,
            leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
            reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidInput");
      }
    });
  });

  // ── confirmMaster 오류 ────────────────────────────────────────────────────────

  describe("confirmMaster errors", () => {
    let pda: PublicKey;

    before(async () => {
      // PendingConfirm 상태의 Master 생성 (activate 전까지 멈춤)
      const reinsurer = Keypair.generate();
      const masterId  = new anchor.BN(210);
      pda = masterPda(masterId);
      const leaderDeposit    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerPool    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const now = Math.floor(Date.now() / 1000);

      await program.methods
        .createMasterAgreement({
          masterId,
          coverageStartTs: new anchor.BN(now - 10),
          coverageEndTs:   new anchor.BN(now + 3600),
          premiumPerPolicy: new anchor.BN(1_000_000),
          payoutDelay2H: new anchor.BN(0), payoutDelay3H: new anchor.BN(0),
          payoutDelay4To5H: new anchor.BN(0), payoutDelay6HOrCancelled: new anchor.BN(5_000_000),
          leaderShareBps: 5_000,
          cededRatioBps: 0, reinsCommissionBps: 0,
          participants: [{ insurer: reinsurer.publicKey, shareBps: 5_000 }],
          oracleFeed: PublicKey.default,
        })
        .accountsPartial({
          leader: payer.publicKey, operator: payer.publicKey,
          reinsurer: reinsurer.publicKey, currencyMint: mint, masterAgreement: pda,
          leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
          reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("rejects confirmMaster from an actor not in participants", async () => {
      const stranger = Keypair.generate();
      await airdrop(stranger.publicKey);

      try {
        await program.methods
          .confirmMaster(0)
          .accounts({ actor: stranger.publicKey, masterAgreement: pda })
          .signers([stranger])
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "Unauthorized");
      }
    });

    it("rejects confirmMaster(role=0) when wallet not registered yet", async () => {
      // registerParticipantWallets 호출 없이 confirmMaster → pool/deposit = default
      try {
        await program.methods
          .confirmMaster(0)
          .accounts({ actor: payer.publicKey, masterAgreement: pda })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidInput");
      }
    });

    it("rejects confirmMaster with an invalid role value", async () => {
      try {
        await program.methods
          .confirmMaster(2) // 유효하지 않은 role
          .accounts({ actor: payer.publicKey, masterAgreement: pda })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidRole");
      }
    });
  });

  // ── activateMaster 오류 ───────────────────────────────────────────────────────

  describe("activateMaster errors", () => {
    it("rejects activation when not all participants have confirmed", async () => {
      const reinsurer = Keypair.generate();
      const participantA = Keypair.generate();
      await airdrop(reinsurer.publicKey);
      await airdrop(participantA.publicKey);
      const masterId = new anchor.BN(220);
      const pda      = masterPda(masterId);
      const leaderDeposit    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerPool    = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const reinsurerDeposit = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const leaderPool       = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const aPool            = await createAccount(connection, payer, mint, pda, Keypair.generate());
      const aDeposit         = await createAccount(connection, payer, mint, participantA.publicKey);
      const now = Math.floor(Date.now() / 1000);

      await program.methods
        .createMasterAgreement({
          masterId,
          coverageStartTs: new anchor.BN(now - 10),
          coverageEndTs:   new anchor.BN(now + 3600),
          premiumPerPolicy: new anchor.BN(1_000_000),
          payoutDelay2H: new anchor.BN(0), payoutDelay3H: new anchor.BN(0),
          payoutDelay4To5H: new anchor.BN(0), payoutDelay6HOrCancelled: new anchor.BN(5_000_000),
          leaderShareBps: 5_000,
          cededRatioBps: 0, reinsCommissionBps: 0,
          participants: [{ insurer: participantA.publicKey, shareBps: 5_000 }],
          oracleFeed: PublicKey.default,
        })
        .accountsPartial({
          leader: payer.publicKey, operator: payer.publicKey,
          reinsurer: reinsurer.publicKey, currencyMint: mint, masterAgreement: pda,
          leaderDepositWallet: leaderDeposit, reinsurerPoolWallet: reinsurerPool,
          reinsurerDepositWallet: reinsurerDeposit, systemProgram: SystemProgram.programId,
        })
        .rpc();

      // leader만 등록/승인, participantA는 미승인 상태로 남겨 activation 실패를 확인한다.
      await program.methods
        .registerParticipantWallets()
        .accounts({ insurer: payer.publicKey, masterAgreement: pda, poolWallet: leaderPool, depositWallet: leaderDeposit })
        .rpc();
      await program.methods
        .registerParticipantWallets()
        .accounts({ insurer: participantA.publicKey, masterAgreement: pda, poolWallet: aPool, depositWallet: aDeposit })
        .signers([participantA])
        .rpc();
      await program.methods.confirmMaster(0).accounts({ actor: payer.publicKey, masterAgreement: pda }).rpc();

      try {
        await program.methods.activateMaster().accounts({ operator: payer.publicKey, masterAgreement: pda }).rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "MasterNotConfirmed");
      }
    });
  });

  // ── resolveFlightDelay 오류 ───────────────────────────────────────────────────

  describe("resolveFlightDelay errors", () => {
    let pda: PublicKey;
    let flightPolicyPda: PublicKey;
    let leaderPool: PublicKey;

    before(async () => {
      const { pda: masterAgreementPda, leaderPool: lp } = await createActiveMaster(new anchor.BN(230));
      pda = masterAgreementPda;
      leaderPool = lp;

      const childPolicyId = new anchor.BN(1);
      flightPolicyPda = flightPda(pda, childPolicyId);
      const payerToken = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
      await mintTo(connection, payer, mint, payerToken, payer, 1_000_000);

      await program.methods
        .createFlightPolicyFromMaster({
          childPolicyId, subscriberRef: "E_SUB_1", flightNo: "XX001", route: "GMP-PUS",
          departureTs: new anchor.BN(Math.floor(Date.now() / 1000) + 600),
        })
        .accountsPartial({
          creator: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda,
          payerToken, leaderPoolToken: leaderPool,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("rejects resolveFlightDelay from unauthorized actor", async () => {
      const stranger = Keypair.generate();
      await airdrop(stranger.publicKey);

      try {
        await program.methods
          .resolveFlightDelay(200, false)
          .accounts({ resolver: stranger.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda })
          .signers([stranger])
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "Unauthorized");
      }
    });

    it("rejects resolveFlightDelay when flight is already resolved", async () => {
      // 첫 번째 resolve 성공
      await program.methods
        .resolveFlightDelay(200, false)
        .accounts({ resolver: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda })
        .rpc();

      // 두 번째 resolve는 상태가 이미 Claimable이므로 실패
      try {
        await program.methods
          .resolveFlightDelay(300, false)
          .accounts({ resolver: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda })
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidState");
      }
    });
  });

  // ── settleFlightClaim 오류 ────────────────────────────────────────────────────

  describe("settleFlightClaim errors", () => {
    it("rejects settleFlightClaim when flight is not Claimable", async () => {
      const { pda, leaderDeposit, reinsurerDeposit, leaderPool, participantPool } = await createActiveMaster(new anchor.BN(240));
      const payerToken = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
      await mintTo(connection, payer, mint, payerToken, payer, 1_000_000);

      const childPolicyId   = new anchor.BN(1);
      const flightPolicyPda = flightPda(pda, childPolicyId);

      await program.methods
        .createFlightPolicyFromMaster({
          childPolicyId, subscriberRef: "E_SUB_2", flightNo: "XX002", route: "ICN-PVG",
          departureTs: new anchor.BN(Math.floor(Date.now() / 1000) + 600),
        })
        .accountsPartial({
          creator: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda,
          payerToken, leaderPoolToken: leaderPool,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .rpc();

      // resolve 없이 바로 settle 시도 (AwaitingOracle 상태)
      try {
        await program.methods
          .settleFlightClaim()
          .accountsPartial({
            executor: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda,
            leaderDepositToken: leaderDeposit, leaderPoolToken: leaderPool, reinsurerPoolToken: reinsurerDeposit,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts([{ pubkey: participantPool, isWritable: true, isSigner: false }])
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        assertAnchorError(err, "InvalidState");
      }
    });
  });

  // ── settleFlightNoClaim 오류 ──────────────────────────────────────────────────

  describe("settleFlightNoClaim errors", () => {
    it("rejects double settlement (AlreadySettled)", async () => {
      const { pda, leaderDeposit, leaderPool, reinsurerDeposit, participantDeposit } = await createActiveMaster(new anchor.BN(250));
      const payerToken = await createAccount(connection, payer, mint, payer.publicKey, Keypair.generate());
      await mintTo(connection, payer, mint, payerToken, payer, 1_000_000);

      const childPolicyId   = new anchor.BN(1);
      const flightPolicyPda = flightPda(pda, childPolicyId);

      await program.methods
        .createFlightPolicyFromMaster({
          childPolicyId, subscriberRef: "E_SUB_3", flightNo: "XX003", route: "ICN-HKG",
          departureTs: new anchor.BN(Math.floor(Date.now() / 1000) + 600),
        })
        .accountsPartial({
          creator: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda,
          payerToken, leaderPoolToken: leaderPool,
          tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .rpc();

      // delay=0 → NoClaim
      await program.methods
        .resolveFlightDelay(0, false)
        .accounts({ resolver: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda })
        .rpc();

      // 첫 번째 settle (성공)
      await program.methods
        .settleFlightNoClaim()
        .accountsPartial({
          executor: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda,
          leaderPoolToken: leaderPool, leaderDepositToken: leaderDeposit, reinsurerDepositToken: reinsurerDeposit,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([{ pubkey: participantDeposit, isWritable: true, isSigner: false }])
        .rpc();

      // 두 번째 settle: 첫 settle 후 status=Expired(5)이므로 NoClaim 상태 체크가 먼저 실패
      try {
        await program.methods
          .settleFlightNoClaim()
          .accountsPartial({
            executor: payer.publicKey, masterAgreement: pda, flightPolicy: flightPolicyPda,
            leaderPoolToken: leaderPool, leaderDepositToken: leaderDeposit,
            reinsurerDepositToken: reinsurerDeposit,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .remainingAccounts([{ pubkey: participantDeposit, isWritable: true, isSigner: false }])
          .rpc();
        assert.fail("실패해야 하는데 성공함");
      } catch (err) {
        // settle 후 status=Expired → NoClaim 상태 체크(InvalidState)가 AlreadySettled보다 먼저 실행
        assertAnchorError(err, "InvalidState");
      }
    });
  });
});
