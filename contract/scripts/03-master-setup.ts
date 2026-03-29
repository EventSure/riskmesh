/**
 * yarn demo:3-master-setup
 *
 * Master Policy 전체 셋업 (devnet):
 *   1. SPL Mint 생성 (state.json의 mint가 devnet에 없으면 신규 생성)
 *   2. PDA 소유 토큰 계정 생성 (leaderDeposit, reinsurerPool, leaderPool)
 *   3. 리더 ATA 생성 및 토큰 민팅
 *   4. create_master_policy  ← oracle_feed: state.json의 feedPubkey (없으면 기본값 = Track A 전용)
 *   5. register_participant_wallets
 *   6. confirm_master (Reinsurer)
 *   7. activate_master
 *   8. 리더 키페어 파일 저장 (Rust 데몬용)
 *
 * 설정:
 *   - 단일 참여사 = leader (share_bps = 10000)
 *   - reinsurer = leader (self, ceded = 0%)
 *   - 프리미엄: 1,000,000 (1 USDC 단위, 6 decimals)
 *   - 페이아웃 tiered: 2H=2, 3H=3, 4-5H=4, 6H+=6 USDC
 *
 * Track B 사용 시:
 *   oracle-feed-create를 먼저 실행하면 feedPubkey가 state.json에 저장되고
 *   이 스크립트가 자동으로 oracle_feed에 등록합니다.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createAccount,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { kp, loadState, makeProgram, masterPolicyPub, RPC_URL, saveState } from "./common";

const MASTER_ID = 1;

async function main() {
  const s = loadState();
  const leader = kp(s.leaderKey);
  const conn = new Connection(RPC_URL, "confirmed");

  console.log(`\n리더 주소: ${leader.publicKey.toBase58()}`);
  console.log(`RPC URL  : ${RPC_URL}`);

  // ── 잔액 확인 및 에어드롭 ────────────────────────────────────────────────────
  const balance = await conn.getBalance(leader.publicKey);
  console.log(`리더 SOL 잔액: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    console.log("잔액 부족, devnet 에어드롭 요청 중...");
    const sig = await conn.requestAirdrop(leader.publicKey, 2 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("에어드롭 완료 (+2 SOL)");
  }

  // ── Mint 존재 여부 확인 → 없으면 신규 생성 ─────────────────────────────────
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

  // ── master PDA 사전 계산 ─────────────────────────────────────────────────────
  const masterPda = masterPolicyPub(leader.publicKey, MASTER_ID);
  console.log(`\nMaster PDA: ${masterPda.toBase58()}`);

  // 이미 생성된 경우 확인
  const existing = await conn.getAccountInfo(masterPda);
  if (existing) {
    console.log("이미 MasterPolicy가 존재합니다. 상태를 확인합니다...");
    const master = await pg.account.masterPolicy.fetch(masterPda);
    console.log(`status: ${master.status} (2=Active)`);
    if (master.status === 2) {
      console.log("이미 Active 상태입니다. 스킵.");
      return;
    }
  }

  // ── 리더 ATA 생성 및 토큰 민팅 ──────────────────────────────────────────────
  console.log("\n리더 ATA 생성 및 토큰 민팅 중...");
  const leaderAta = await getOrCreateAssociatedTokenAccount(
    conn, leader, mintPubkey, leader.publicKey
  );
  await mintTo(conn, leader, mintPubkey, leaderAta.address, leader, 10_000_000);
  console.log(`리더 ATA: ${leaderAta.address.toBase58()} (+10 USDC 민팅)`);

  // ── PDA 소유 토큰 계정 생성 ──────────────────────────────────────────────────
  // ATA는 (mint, owner) 쌍으로 유일 → 다수의 PDA 소유 계정은 명시적 Keypair 사용
  console.log("\nPDA 소유 토큰 계정 생성 중...");
  const leaderDepositKp = Keypair.generate();
  const reinsurerPoolKp = Keypair.generate();
  const leaderPoolKp    = Keypair.generate();

  await createAccount(conn, leader, mintPubkey, masterPda, leaderDepositKp);
  await createAccount(conn, leader, mintPubkey, masterPda, reinsurerPoolKp);
  await createAccount(conn, leader, mintPubkey, masterPda, leaderPoolKp);

  // leaderPool에 청구 정산용 자금 적립 (6 USDC — 최대 페이아웃 tier)
  await mintTo(conn, leader, mintPubkey, leaderPoolKp.publicKey, leader, 6_000_000);

  console.log(`leaderDepositWallet : ${leaderDepositKp.publicKey.toBase58()}`);
  console.log(`reinsurerPoolWallet : ${reinsurerPoolKp.publicKey.toBase58()}`);
  console.log(`leaderPoolWallet    : ${leaderPoolKp.publicKey.toBase58()} (6 USDC 적립)`);
  console.log(`leaderAta           : ${leaderAta.address.toBase58()} (premium payer)`);

  // ── create_master_policy ─────────────────────────────────────────────────────
  // oracle_feed: Track B = state.json의 feedPubkey, Track A = PublicKey.default
  const oracleFeed = s.feedPubkey
    ? new PublicKey(s.feedPubkey)
    : PublicKey.default;

  if (s.feedPubkey) {
    console.log(`\nTrack B oracle_feed: ${oracleFeed.toBase58()}`);
  } else {
    console.log("\noracle_feed 미설정 → Track A 전용 MasterPolicy");
    console.log("  (Track B 사용 시: oracle-feed-create 먼저 실행)");
  }

  const now = Math.floor(Date.now() / 1000);
  console.log("\ncreate_master_policy 호출 중...");
  const txCreate = await pg.methods
    .createMasterPolicy({
      masterId:            new BN(MASTER_ID),
      coverageStartTs:     new BN(now),
      coverageEndTs:       new BN(now + 60 * 60 * 24 * 365),
      premiumPerPolicy:    new BN(1_000_000),
      payoutDelay2H:       new BN(2_000_000),
      payoutDelay3H:       new BN(3_000_000),
      payoutDelay4To5H:    new BN(4_000_000),
      payoutDelay6HOrCancelled: new BN(6_000_000),
      cededRatioBps:       0,
      reinsCommissionBps:  0,
      participants: [
        { insurer: leader.publicKey, shareBps: 10000 },
      ],
      oracleFeed,
    })
    .accountsPartial({
      leader:                 leader.publicKey,
      operator:               leader.publicKey,
      reinsurer:              leader.publicKey,
      currencyMint:           mintPubkey,
      masterPolicy:           masterPda,
      leaderDepositWallet:    leaderDepositKp.publicKey,
      reinsurerPoolWallet:    reinsurerPoolKp.publicKey,
      reinsurerDepositWallet: leaderAta.address,   // ceded=0 이므로 실제 사용 안 됨
      systemProgram:          SystemProgram.programId,
    })
    .signers([leader])
    .rpc();
  console.log("  Tx:", txCreate);

  // ── register_participant_wallets ─────────────────────────────────────────────
  console.log("\nregister_participant_wallets 호출 중...");
  const txReg = await pg.methods
    .registerParticipantWallets()
    .accountsPartial({
      insurer:      leader.publicKey,
      masterPolicy: masterPda,
      poolWallet:   leaderPoolKp.publicKey,
      depositWallet: leaderAta.address,
    })
    .signers([leader])
    .rpc();
  console.log("  Tx:", txReg);

  // ── confirm_master (Reinsurer role=1) ────────────────────────────────────────
  // leader는 create 시 auto-confirmed(Participant), reinsurer confirm만 추가로 필요
  console.log("\nconfirm_master (Reinsurer) 호출 중...");
  const txConf = await pg.methods
    .confirmMaster(1)
    .accountsPartial({ actor: leader.publicKey, masterPolicy: masterPda })
    .signers([leader])
    .rpc();
  console.log("  Tx:", txConf);

  // ── activate_master ──────────────────────────────────────────────────────────
  console.log("\nactivate_master 호출 중...");
  const txAct = await pg.methods
    .activateMaster()
    .accountsPartial({ operator: leader.publicKey, masterPolicy: masterPda })
    .signers([leader])
    .rpc();
  console.log("  Tx:", txAct);

  // ── 결과 확인 ────────────────────────────────────────────────────────────────
  const master = await pg.account.masterPolicy.fetch(masterPda);
  console.log(`\n✓ MasterPolicy 활성화 완료`);
  console.log(`  status           : ${master.status} (2=Active)`);
  console.log(`  premiumPerPolicy : ${master.premiumPerPolicy.toString()} (1 USDC)`);
  console.log(`  payoutDelay2H    : ${master.payoutDelay2H.toString()} (2 USDC)`);

  // ── Rust 데몬용 리더 키페어 파일 저장 ────────────────────────────────────────
  const leaderKpPath = path.join(os.homedir(), ".config/solana/riskmesh-leader.json");
  fs.writeFileSync(leaderKpPath, JSON.stringify(Array.from(leader.secretKey)));
  console.log(`\n✓ 리더 키페어 저장: ${leaderKpPath}`);

  // ── .state.json 업데이트 ──────────────────────────────────────────────────────
  saveState({
    ...s,
    mint:               mintPubkey.toBase58(),
    masterId:           MASTER_ID,
    masterPda:          masterPda.toBase58(),
    leaderAta:          leaderAta.address.toBase58(),
    leaderDepositWallet: leaderDepositKp.publicKey.toBase58(),
    reinsurerPoolWallet: reinsurerPoolKp.publicKey.toBase58(),
    leaderPoolWallet:   leaderPoolKp.publicKey.toBase58(),
    flightPolicies:     [],
  } as any);
  console.log("✓ .state.json 업데이트 완료");
}

main().catch(e => { console.error(e); process.exit(1); });
