/**
 * anchor run setup
 *
 * 지갑 3개(leader, insurer1, insurer2)를 생성하고, SOL을 에어드롭합니다.
 * SPL 민트를 만들고 각 insurer의 토큰 계정에 초기 잔액을 채웁니다.
 * 이후 모든 스크립트가 읽을 .state.json을 저장합니다.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, createAccount, mintTo } from "@solana/spl-token";
import { RPC_URL, saveState } from "./common";

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");

  // 1. 키페어 생성
  const leader = Keypair.generate();
  const ins1   = Keypair.generate();
  const ins2   = Keypair.generate();

  console.log("=== 생성된 주소 ===");
  console.log("leader   :", leader.publicKey.toBase58());
  console.log("insurer1 :", ins1.publicKey.toBase58());
  console.log("insurer2 :", ins2.publicKey.toBase58());

  // 2. SOL 에어드롭 (각 10 SOL)
  for (const { publicKey, name } of [
    { publicKey: leader.publicKey, name: "leader" },
    { publicKey: ins1.publicKey,   name: "insurer1" },
    { publicKey: ins2.publicKey,   name: "insurer2" },
  ]) {
    const sig = await conn.requestAirdrop(publicKey, 10 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    console.log(`${name} airdrop 완료`);
  }

  // 3. SPL 민트 생성 (6 decimals, USDC 호환)
  const mint = await createMint(conn, leader, leader.publicKey, null, 6);
  console.log("\nSPL Mint :", mint.toBase58());

  // 4. insurer 토큰 계정 생성
  //    Keypair를 명시적으로 지정해 일반 계정(non-ATA)으로 생성합니다.
  const ins1TokenKp = Keypair.generate();
  const ins2TokenKp = Keypair.generate();
  await createAccount(conn, leader, mint, ins1.publicKey, ins1TokenKp);
  await createAccount(conn, leader, mint, ins2.publicKey, ins2TokenKp);

  // 5. 토큰 민팅 (insurer1: 3,000,000 / insurer2: 1,000,000)
  await mintTo(conn, leader, mint, ins1TokenKp.publicKey, leader, 3_000_000);
  await mintTo(conn, leader, mint, ins2TokenKp.publicKey, leader, 1_000_000);

  console.log("ins1Token:", ins1TokenKp.publicKey.toBase58(), "(3,000,000 tokens)");
  console.log("ins2Token:", ins2TokenKp.publicKey.toBase58(), "(1,000,000 tokens)");

  // 6. activeTo = 지금으로부터 2분 후 (expire 데모용)
  const activeTo = Math.floor(Date.now() / 1000) + 120;

  saveState({
    mint:      mint.toBase58(),
    leaderKey: Array.from(leader.secretKey),
    ins1Key:   Array.from(ins1.secretKey),
    ins2Key:   Array.from(ins2.secretKey),
    ins1Token: ins1TokenKp.publicKey.toBase58(),
    ins2Token: ins2TokenKp.publicKey.toBase58(),
    policyId:  1,
    activeTo,
  });

  console.log("\n=== Setup 완료 ===");
  console.log(`activeTo: ${new Date(activeTo * 1000).toLocaleTimeString()} (2분 후)`);
  console.log("다음 단계: anchor run create-policy");
}

main().catch(e => { console.error(e); process.exit(1); });
