/**
 * yarn demo:setup
 *
 * Leader 키페어와 SPL 민트를 생성하고 초기 .state.json을 저장합니다.
 * 이후 모든 oracle-* 스크립트가 이 파일을 읽습니다.
 *
 * 다음 단계:
 *   Track A/B 공통: yarn demo:master-setup
 *   Track B 전용:   yarn demo:oracle-feed-create (master-setup 전에 실행)
 */
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { RPC_URL, saveState } from "./common";

async function main() {
  const conn = new Connection(RPC_URL, "confirmed");

  // 1. Leader 키페어 생성
  const leader = Keypair.generate();
  console.log("=== 생성된 주소 ===");
  console.log("leader :", leader.publicKey.toBase58());

  // 2. SOL 에어드롭 (localnet: 10 SOL / devnet: 2 SOL)
  const isLocalnet = RPC_URL.includes("localhost") || RPC_URL.includes("127.0.0.1");
  const airdropAmount = isLocalnet ? 10 * LAMPORTS_PER_SOL : 2 * LAMPORTS_PER_SOL;
  const sig = await conn.requestAirdrop(leader.publicKey, airdropAmount);
  await conn.confirmTransaction(sig, "confirmed");
  console.log(`leader airdrop 완료 (${airdropAmount / LAMPORTS_PER_SOL} SOL)`);

  // 3. SPL 민트 생성 (6 decimals, USDC 호환)
  const mint = await createMint(conn, leader, leader.publicKey, null, 6);
  console.log("\nSPL Mint :", mint.toBase58());

  saveState({
    mint: mint.toBase58(),
    leaderKey: Array.from(leader.secretKey),
  });

  console.log("\n=== Setup 완료 ===");
  console.log(".state.json 저장됨");
  console.log("\n다음 단계:");
  console.log("  Track B: yarn demo:oracle-feed-create  (Switchboard feed 생성)");
  console.log("  공  통 : yarn demo:master-setup        (MasterPolicy 생성 및 활성화)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
