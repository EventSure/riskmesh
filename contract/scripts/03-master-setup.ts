/**
 * yarn demo:3-master-setup
 *
 * Master Agreement 전체 셋업 (devnet):
 *   1. Mint 재사용 또는 신규 생성
 *   2. PDA 소유 토큰 계정 생성 (leaderDeposit, reinsurerPool, reinsurerDeposit, 각 participant pool)
 *   3. 각 참여사 ATA 생성 및 리더 ATA에 토큰 민팅
 *   4. create_master_agreement  ← oracle_feed: state.json의 feedPubkey (없으면 Track A)
 *   5. register_participant_wallets (leader, A, B)
 *   6. confirm_master(0) — leader, A, B
 *      confirm_master(1) — reinsurer
 *   7. activate_master
 *
 * 고정 키페어 경로:
 *   Leader    : ~/.config/solana/riskmesh-leader.json
 *   Participant A: ~/.config/solana/riskmesh-participant-a.json
 *   Participant B: ~/.config/solana/riskmesh-participant-b.json
 *   Reinsurer : ~/.config/solana/riskmesh-reinsurer.json
 *
 * 참여사 배분 (shareBps):  Leader 50%, A 30%, B 20%
 * 재보험 ceded ratio     : 0% (Track A 단순 데모용)
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createAccount, createMint, mintTo,
  getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  kp, loadState, makeProgram, masterAgreementPub, RPC_URL, saveState,
} from "./common";

const MASTER_ID = process.env.MASTER_ID ? parseInt(process.env.MASTER_ID) : 1;

// 고정 키페어 경로
const KP_PATHS = {
  leader:        path.join(os.homedir(), ".config/solana/riskmesh-leader.json"),
  participantA:  path.join(os.homedir(), ".config/solana/riskmesh-participant-a.json"),
  participantB:  path.join(os.homedir(), ".config/solana/riskmesh-participant-b.json"),
  reinsurer:     path.join(os.homedir(), ".config/solana/riskmesh-reinsurer.json"),
};

function loadKp(p: string): Keypair {
  if (!fs.existsSync(p)) throw new Error(`키페어 파일 없음: ${p}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))));
}

async function main() {
  const s = loadState();

  // ── 키페어 로드 ──────────────────────────────────────────────────────────────
  const leader  = kp(s.leaderKey);
  const partyA  = loadKp(KP_PATHS.participantA);
  const partyB  = loadKp(KP_PATHS.participantB);
  const reins   = loadKp(KP_PATHS.reinsurer);

  const conn = new Connection(RPC_URL, "confirmed");

  console.log("=== 지갑 주소 ===");
  console.log(`Leader       : ${leader.publicKey.toBase58()}`);
  console.log(`Participant A: ${partyA.publicKey.toBase58()}`);
  console.log(`Participant B: ${partyB.publicKey.toBase58()}`);
  console.log(`Reinsurer    : ${reins.publicKey.toBase58()}`);
  console.log(`RPC          : ${RPC_URL}`);

  // ── 잔액 확인 (리더만; 나머지는 devnet에서 충분히 보유 중) ──────────────────
  const balance = await conn.getBalance(leader.publicKey);
  console.log(`\n리더 SOL 잔액: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    console.log("잔액 부족, devnet 에어드롭 요청 중...");
    const sig = await conn.requestAirdrop(leader.publicKey, 2 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("에어드롭 완료 (+2 SOL)");
  }

  // ── Mint 확인 → 없으면 신규 생성 ────────────────────────────────────────────
  let mintPubkey: PublicKey;
  const existingMintInfo = await conn.getAccountInfo(new PublicKey(s.mint));
  if (!existingMintInfo) {
    console.log("\n기존 mint가 devnet에 없습니다. 새로 생성 중...");
    mintPubkey = await createMint(conn, leader, leader.publicKey, null, 6);
    console.log(`새 Mint: ${mintPubkey.toBase58()}`);
    s.mint = mintPubkey.toBase58();
  } else {
    mintPubkey = new PublicKey(s.mint);
    console.log(`\n기존 Mint 사용: ${mintPubkey.toBase58()}`);
  }

  const pg = makeProgram(leader);

  // ── master PDA 계산 ──────────────────────────────────────────────────────────
  const masterPda = masterAgreementPub(leader.publicKey, MASTER_ID);
  console.log(`\nMaster PDA: ${masterPda.toBase58()}`);

  const existing = await conn.getAccountInfo(masterPda);
  if (existing) {
    console.log("이미 MasterAgreement가 존재합니다. 상태 확인 중...");
    const master = await pg.account.masterAgreement.fetch(masterPda);
    console.log(`status: ${master.status} (2=Active)`);
    if (master.status === 2) {
      console.log("이미 Active 상태입니다. 스킵.");
      return;
    }
  }

  // ── ATAs (identity 지갑별 deposit 계정) ─────────────────────────────────────
  console.log("\nATA 생성 중...");
  const leaderAta = await getOrCreateAssociatedTokenAccount(conn, leader, mintPubkey, leader.publicKey);
  const aAta      = await getOrCreateAssociatedTokenAccount(conn, leader, mintPubkey, partyA.publicKey);
  const bAta      = await getOrCreateAssociatedTokenAccount(conn, leader, mintPubkey, partyB.publicKey);
  const reinsAta  = await getOrCreateAssociatedTokenAccount(conn, leader, mintPubkey, reins.publicKey);

  // 리더 ATA에 premium 지불용 토큰 민팅 (10 USDC)
  await mintTo(conn, leader, mintPubkey, leaderAta.address, leader, 10_000_000);
  console.log(`Leader ATA    : ${leaderAta.address.toBase58()} (+10 USDC)`);
  console.log(`Participant A ATA: ${aAta.address.toBase58()}`);
  console.log(`Participant B ATA: ${bAta.address.toBase58()}`);
  console.log(`Reinsurer ATA : ${reinsAta.address.toBase58()}`);

  // ── PDA 소유 토큰 계정 생성 ──────────────────────────────────────────────────
  // leaderDeposit은 leader(ATA) 소유. 나머지 풀은 모두 masterPda 소유 에스크로.
  console.log("\n토큰 계정 생성 중...");
  const reinsurerPoolKp  = Keypair.generate();
  const reinsurerDepKp   = Keypair.generate();
  const leaderPoolKp     = Keypair.generate();
  const aPoolKp          = Keypair.generate();
  const bPoolKp          = Keypair.generate();

  await createAccount(conn, leader, mintPubkey, masterPda, reinsurerPoolKp);
  await createAccount(conn, leader, mintPubkey, masterPda, reinsurerDepKp);
  await createAccount(conn, leader, mintPubkey, masterPda, leaderPoolKp);
  await createAccount(conn, leader, mintPubkey, masterPda, aPoolKp);
  await createAccount(conn, leader, mintPubkey, masterPda, bPoolKp);

  // 각 pool에 최대 페이아웃 분담분 적립 (6 USDC 기준, ceded=0)
  // Leader 50% = 3 USDC, A 30% = 1.8 USDC, B 20% = 1.2 USDC
  await mintTo(conn, leader, mintPubkey, leaderPoolKp.publicKey, leader, 3_000_000);
  await mintTo(conn, leader, mintPubkey, aPoolKp.publicKey,      leader, 1_800_000);
  await mintTo(conn, leader, mintPubkey, bPoolKp.publicKey,      leader, 1_200_000);

  console.log(`leaderDepositWallet : ${leaderAta.address.toBase58()} (leader ATA)`);
  console.log(`reinsurerPoolWallet : ${reinsurerPoolKp.publicKey.toBase58()}`);
  console.log(`reinsurerDepWallet  : ${reinsurerDepKp.publicKey.toBase58()}`);
  console.log(`leaderPoolWallet    : ${leaderPoolKp.publicKey.toBase58()} (+3 USDC)`);
  console.log(`participantAPool    : ${aPoolKp.publicKey.toBase58()} (+1.8 USDC)`);
  console.log(`participantBPool    : ${bPoolKp.publicKey.toBase58()} (+1.2 USDC)`);

  // ── create_master_agreement ─────────────────────────────────────────────────────
  const oracleFeed = s.feedPubkey ? new PublicKey(s.feedPubkey) : PublicKey.default;
  if (s.feedPubkey) console.log(`\nTrack B oracle_feed: ${oracleFeed.toBase58()}`);
  else              console.log("\noracle_feed 미설정 → Track A 전용 MasterAgreement");

  const now = Math.floor(Date.now() / 1000);
  console.log("\ncreate_master_agreement 호출 중...");
  const txCreate = await pg.methods
    .createMasterAgreement({
      masterId:            new BN(MASTER_ID),
      coverageStartTs:     new BN(now),
      coverageEndTs:       new BN(now + 60 * 60 * 24 * 365),
      premiumPerPolicy:    new BN(1_000_000),
      payoutDelay2H:       new BN(2_000_000),
      payoutDelay3H:       new BN(3_000_000),
      payoutDelay4To5H:    new BN(4_000_000),
      payoutDelay6HOrCancelled: new BN(6_000_000),
      collateralClaimCount: 1,
      leaderShareBps:      5_000,
      cededRatioBps:       0,
      reinsCommissionBps:  0,
      participants: [
        { insurer: partyA.publicKey, shareBps: 3_000 },
        { insurer: partyB.publicKey, shareBps: 2_000 },
      ],
      oracleFeed,
    })
    .accountsPartial({
      leader:                 leader.publicKey,
      operator:               leader.publicKey,
      reinsurer:              reins.publicKey,
      currencyMint:           mintPubkey,
      masterAgreement:           masterPda,
      leaderDepositWallet:    leaderAta.address,
      reinsurerPoolWallet:    reinsurerPoolKp.publicKey,
      reinsurerDepositWallet: reinsurerDepKp.publicKey,
      systemProgram:          SystemProgram.programId,
    })
    .signers([leader])
    .rpc();
  console.log("  Tx:", txCreate);

  // ── register_participant_wallets ─────────────────────────────────────────────
  console.log("\nregister_participant_wallets 호출 중...");
  for (const [actor, poolWallet, depositWallet, signers] of [
    [leader, leaderPoolKp.publicKey, leaderAta.address, [leader]],
    [partyA, aPoolKp.publicKey,      aAta.address,      [partyA]],
    [partyB, bPoolKp.publicKey,      bAta.address,      [partyB]],
  ] as const) {
    await pg.methods
      .registerParticipantWallets()
      .accountsPartial({
        insurer:       actor.publicKey,
        masterAgreement:  masterPda,
        poolWallet,
        depositWallet,
      })
      .signers([...signers])
      .rpc();
    console.log(`  ${actor.publicKey.toBase58().slice(0, 8)}... 완료`);
  }

  // ── confirm_master ───────────────────────────────────────────────────────────
  console.log("\nconfirm_master(0) — 참여사 전원 승인 중...");
  for (const [actor, poolWallet, depositWallet, signers] of [
    [leader, leaderPoolKp.publicKey, leaderAta.address, [leader]],
    [partyA, aPoolKp.publicKey,      aAta.address,      [partyA]],
    [partyB, bPoolKp.publicKey,      bAta.address,      [partyB]],
  ] as const) {
    await pg.methods
      .confirmMaster(0)
      .accountsPartial({
        actor: actor.publicKey,
        masterAgreement: masterPda,
        actorSourceToken: depositWallet,
        actorPoolToken: poolWallet,
      })
      .signers([...signers])
      .rpc();
    console.log(`  ${actor.publicKey.toBase58().slice(0, 8)}... 완료`);
  }

  // ── activate_master ──────────────────────────────────────────────────────────
  console.log("\nactivate_master 호출 중...");
  const txAct = await pg.methods
    .activateMaster()
    .accountsPartial({
      operator: leader.publicKey,
      masterAgreement: masterPda,
      leaderPoolToken: leaderPoolKp.publicKey,
      reinsurerPoolToken: reinsurerPoolKp.publicKey,
    })
    .remainingAccounts([
      { pubkey: aPoolKp.publicKey, isSigner: false, isWritable: false },
      { pubkey: bPoolKp.publicKey, isSigner: false, isWritable: false },
    ])
    .signers([leader])
    .rpc();
  console.log("  Tx:", txAct);

  // ── 결과 확인 ────────────────────────────────────────────────────────────────
  const master = await pg.account.masterAgreement.fetch(masterPda);
  console.log(`\n✓ MasterAgreement 활성화 완료 (status=${master.status}, 2=Active)`);

  // ── .state.json 업데이트 ──────────────────────────────────────────────────────
  saveState({
    ...s,
    mint:                   mintPubkey.toBase58(),
    masterId:               MASTER_ID,
    masterPda:              masterPda.toBase58(),
    leaderAta:              leaderAta.address.toBase58(),
    leaderDepositWallet:    leaderAta.address.toBase58(),
    reinsurerPoolWallet:    reinsurerPoolKp.publicKey.toBase58(),
    reinsurerDepositWallet: reinsurerDepKp.publicKey.toBase58(),
    leaderPoolWallet:       leaderPoolKp.publicKey.toBase58(),
    participantAPoolWallet: aPoolKp.publicKey.toBase58(),
    participantADepositWallet: aAta.address.toBase58(),
    participantBPoolWallet: bPoolKp.publicKey.toBase58(),
    participantBDepositWallet: bAta.address.toBase58(),
    flightPolicies:         [],
  });
  console.log("✓ .state.json 업데이트 완료");
}

main().catch(e => { console.error(e); process.exit(1); });
