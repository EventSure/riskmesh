/**
 * yarn demo:1-setup
 *
 * 고정 Leader 키페어(~/.config/solana/riskmesh-leader.json)를 사용해
 * SPL 민트를 생성하고 초기 .state.json을 저장합니다.
 * 이후 모든 스크립트가 이 파일을 읽습니다.
 *
 * Leader 지갑 잔액이 부족하면 id.json(기본 지갑)에서 수동으로 전송하세요:
 *   solana transfer <leader-address> 5 --url devnet --allow-unfunded-recipient
 *
 * 다음 단계:
 *   Track B 전용: yarn demo:2-feed-create  (Switchboard feed 생성)
 *   Track A/B 공통: yarn demo:3-master-setup
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { RPC_URL, saveState } from "./common";

const LEADER_KEYPAIR_PATH = path.join(
  os.homedir(),
  ".config/solana/riskmesh-leader.json"
);

async function main() {
  // 1. 고정 Leader 키페어 로드
  if (!fs.existsSync(LEADER_KEYPAIR_PATH)) {
    throw new Error(
      `Leader 키페어 파일이 없습니다: ${LEADER_KEYPAIR_PATH}\n` +
        "다음 명령으로 생성하세요:\n" +
        "  solana-keygen new --outfile ~/.config/solana/riskmesh-leader.json"
    );
  }
  const leaderSecret: number[] = JSON.parse(
    fs.readFileSync(LEADER_KEYPAIR_PATH, "utf-8")
  );
  const leader = Keypair.fromSecretKey(Uint8Array.from(leaderSecret));
  console.log("=== Leader 키페어 ===");
  console.log("경로   :", LEADER_KEYPAIR_PATH);
  console.log("주소   :", leader.publicKey.toBase58());

  // 2. 잔액 확인
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(leader.publicKey);
  console.log(`잔액   : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    throw new Error(
      `잔액 부족 (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL).\n` +
        "다음 명령으로 충전하세요:\n" +
        `  solana transfer ${leader.publicKey.toBase58()} 5 --url devnet --allow-unfunded-recipient`
    );
  }

  // 3. SPL 민트 생성 (6 decimals, USDC 호환)
  console.log("\nSPL 민트 생성 중...");
  const mint = await createMint(conn, leader, leader.publicKey, null, 6);
  console.log("SPL Mint :", mint.toBase58());

  saveState({
    mint: mint.toBase58(),
    leaderKey: Array.from(leader.secretKey),
  });

  console.log("\n=== Setup 완료 ===");
  console.log(".state.json 저장됨");
  console.log("\n다음 단계:");
  console.log("  Track B: yarn demo:2-feed-create  (Switchboard feed 생성)");
  console.log("  공  통 : yarn demo:3-master-setup  (MasterPolicy 생성 및 활성화)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
