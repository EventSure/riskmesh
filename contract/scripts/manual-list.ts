/**
 * yarn demo:manual-list
 *
 * 특정 MasterPolicy에 속한 모든 FlightPolicy를 조회합니다.
 * .state.json 없이 온체인에서 직접 읽어옵니다.
 *
 * 환경변수:
 *   MASTER_PDA       MasterPolicy 주소 (필수)
 *   KEYPAIR_PATH     키페어 경로 (기본값: ~/.config/solana/id.json)
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";

const MASTER_PDA   = process.env.MASTER_PDA ?? (() => { throw new Error("MASTER_PDA 환경변수가 필요합니다"); })();
const KEYPAIR_PATH = process.env.KEYPAIR_PATH
  ?? path.join(process.env.HOME ?? "~", ".config/solana/id.json");

const STATUS: Record<number, string> = {
  0: "Issued",
  1: "AwaitingOracle",
  2: "Claimable",
  3: "Paid",
  4: "NoClaim",
  5: "Expired",
};

function loadKeypair(p: string): Keypair {
  const expanded = p.replace(/^~/, process.env.HOME ?? "");
  const raw: number[] = JSON.parse(fs.readFileSync(expanded, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const payer = loadKeypair(KEYPAIR_PATH);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(payer), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "../target/idl/open_parametric.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const pg = new anchor.Program(idl, provider);

  const masterPda = new PublicKey(MASTER_PDA);

  // memcmp 필터: FlightPolicy.master 필드 (offset = 8 discriminator + 8 child_policy_id = 16)
  const allFlights = await (pg.account as any).flightPolicy.all([
    { memcmp: { offset: 16, bytes: masterPda.toBase58() } },
  ]);

  if (allFlights.length === 0) {
    console.log(`\nMasterPolicy (${masterPda.toBase58().slice(0, 12)}...)에 속한 FlightPolicy가 없습니다.`);
    return;
  }

  // child_policy_id 기준 정렬
  allFlights.sort((a: any, b: any) =>
    a.account.childPolicyId.toNumber() - b.account.childPolicyId.toNumber()
  );

  console.log(`\n=== FlightPolicy 목록 (MasterPolicy: ${masterPda.toBase58().slice(0, 12)}...) ===\n`);
  console.log(
    "ID".padStart(4),
    "flightNo".padEnd(10),
    "status".padEnd(20),
    "delay".padStart(5),
    "cancelled".padEnd(9),
    "payout".padStart(12),
    "premium".padStart(12),
    "PDA",
  );
  console.log("-".repeat(110));

  for (const { publicKey, account: fp } of allFlights) {
    const id = fp.childPolicyId.toNumber();
    const statusLabel = `${STATUS[fp.status] ?? "?"}(${fp.status})`;
    console.log(
      String(id).padStart(4),
      fp.flightNo.padEnd(10),
      statusLabel.padEnd(20),
      String(fp.delayMinutes).padStart(5),
      String(fp.cancelled).padEnd(9),
      fp.payoutAmount.toString().padStart(12),
      fp.premiumPaid.toString().padStart(12),
      publicKey.toBase58().slice(0, 16) + "...",
    );
  }

  console.log(`\n총 ${allFlights.length}개 FlightPolicy`);
}

main().catch((e) => { console.error(e); process.exit(1); });
