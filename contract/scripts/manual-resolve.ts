/**
 * yarn ts-node -P tsconfig.json scripts/manual-resolve.ts
 *
 * AviationStack 없이 resolve_flight_delay를 직접 호출합니다.
 *
 * 환경변수:
 *   MASTER_PDA       MasterAgreement 주소 (필수)
 *   CHILD_POLICY_ID  FlightPolicy child ID (기본값: 4)
 *   DELAY_MINUTES    지연 분 (기본값: 150 → Claimable)
 *   CANCELLED        결항 여부 "true" / "false" (기본값: false)
 *   KEYPAIR_PATH     leader 키페어 경로 (기본값: ~/.config/solana/riskmesh-leader.json)
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";

const MASTER_PDA   = process.env.MASTER_PDA        ?? (() => { throw new Error("MASTER_PDA 환경변수가 필요합니다"); })();
const CHILD_ID     = parseInt(process.env.CHILD_POLICY_ID ?? "4");
const DELAY_MIN    = parseInt(process.env.DELAY_MINUTES   ?? "150");
const CANCELLED    = process.env.CANCELLED === "true";
const KEYPAIR_PATH = process.env.KEYPAIR_PATH
  ?? path.join(process.env.HOME ?? "~", ".config/solana/riskmesh-leader.json");

function loadKeypair(p: string): Keypair {
  const expanded = p.replace(/^~/, process.env.HOME ?? "");
  const raw: number[] = JSON.parse(fs.readFileSync(expanded, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function flightPolicyPub(masterAgreement: PublicKey, childId: number, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("flight_policy"),
      masterAgreement.toBuffer(),
      new BN(childId).toArrayLike(Buffer, "le", 8),
    ],
    programId
  )[0];
}

async function main() {
  const leader = loadKeypair(KEYPAIR_PATH);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "../target/idl/open_parametric.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.address);
  const pg = new anchor.Program(idl, provider);

  const masterPda = new PublicKey(MASTER_PDA);
  const flightPda = flightPolicyPub(masterPda, CHILD_ID, programId);

  console.log("=== manual-resolve ===");
  console.log("leader        :", leader.publicKey.toBase58());
  console.log("masterPda     :", masterPda.toBase58());
  console.log("flightPda     :", flightPda.toBase58());
  console.log("delay_minutes :", DELAY_MIN);
  console.log("cancelled     :", CANCELLED);

  const before = await (pg.account as any).flightPolicy.fetch(flightPda);
  console.log("\n현재 status   :", before.status);

  const tx = await pg.methods
    .resolveFlightDelay(DELAY_MIN, CANCELLED)
    .accountsPartial({
      resolver: leader.publicKey,
      masterAgreement: masterPda,
      flightPolicy: flightPda,
    })
    .signers([leader])
    .rpc();

  const after = await (pg.account as any).flightPolicy.fetch(flightPda);

  console.log("\n=== 완료 ===");
  console.log("tx            :", tx);
  console.log("delay(온체인) :", after.delayMinutes, "분");
  console.log("status        :", after.status, "(2=Claimable, 4=NoClaim)");
}

main().catch((e) => { console.error(e); process.exit(1); });
