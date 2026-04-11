/**
 * yarn demo:manual-settle
 *
 * .state.json 없이 온체인 MasterPolicy에서 wallet 주소를 읽어 정산합니다.
 *
 * 환경변수:
 *   MASTER_PDA       MasterPolicy 주소 (필수)
 *   CHILD_POLICY_ID  FlightPolicy child ID (기본값: 4)
 *   KEYPAIR_PATH     leader 키페어 경로 (기본값: ~/.config/solana/id.json)
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";

const MASTER_PDA   = process.env.MASTER_PDA        ?? (() => { throw new Error("MASTER_PDA 환경변수가 필요합니다"); })();
const CHILD_ID     = parseInt(process.env.CHILD_POLICY_ID ?? "4");
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

function flightPolicyPub(masterPolicy: PublicKey, childId: number, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("flight_policy"),
      masterPolicy.toBuffer(),
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

  // 온체인 계정 fetch
  const master = await (pg.account as any).masterPolicy.fetch(masterPda);
  const fp = await (pg.account as any).flightPolicy.fetch(flightPda);

  console.log("=== manual-settle ===");
  console.log("leader        :", leader.publicKey.toBase58());
  console.log("masterPda     :", masterPda.toBase58());
  console.log("flightPda     :", flightPda.toBase58());
  console.log("flightNo      :", fp.flightNo);
  console.log("delayMinutes  :", fp.delayMinutes);
  console.log("cancelled     :", fp.cancelled);
  console.log("payoutAmount  :", fp.payoutAmount.toString());
  console.log("현재 status   :", fp.status, `(${STATUS[fp.status] ?? "?"})`);

  if (fp.status === 2) {
    // ── Claimable → Paid ──────────────────────────────────────────────────────
    console.log("\n→ Claimable: settle_flight_claim 실행 중...");

    const participantPoolWallets = master.participants.map((p: any) => ({
      pubkey: p.poolWallet as PublicKey,
      isWritable: true,
      isSigner: false,
    }));

    const tx = await pg.methods
      .settleFlightClaim()
      .accountsPartial({
        executor:           leader.publicKey,
        masterPolicy:       masterPda,
        flightPolicy:       flightPda,
        leaderDepositToken: master.leaderDepositWallet,
        leaderPoolToken:    master.leaderPoolWallet,
        reinsurerPoolToken: master.reinsurerPoolWallet ?? master.leaderPoolWallet,
        tokenProgram:       TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(participantPoolWallets)
      .signers([leader])
      .rpc();

    const after = await (pg.account as any).flightPolicy.fetch(flightPda);
    console.log("\n=== 완료 ===");
    console.log("tx            :", tx);
    console.log("status        :", after.status, `(${STATUS[after.status] ?? "?"})`);
    console.log("payout        :", fp.payoutAmount.toString(), "토큰 → leaderDepositWallet");

  } else if (fp.status === 4) {
    // ── NoClaim → Expired ─────────────────────────────────────────────────────
    console.log("\n→ NoClaim: settle_flight_no_claim 실행 중...");

    const participantDepositWallets = master.participants.map((p: any) => ({
      pubkey: p.depositWallet as PublicKey,
      isWritable: true,
      isSigner: false,
    }));

    const tx = await pg.methods
      .settleFlightNoClaim()
      .accountsPartial({
        executor:              leader.publicKey,
        masterPolicy:          masterPda,
        flightPolicy:          flightPda,
        leaderPoolToken:       master.leaderPoolWallet,
        leaderDepositToken:    master.leaderDepositWallet,
        reinsurerDepositToken: master.reinsurerDepositWallet ?? master.leaderPoolWallet,
        tokenProgram:          TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(participantDepositWallets)
      .signers([leader])
      .rpc();

    const after = await (pg.account as any).flightPolicy.fetch(flightPda);
    console.log("\n=== 완료 ===");
    console.log("tx            :", tx);
    console.log("status        :", after.status, `(${STATUS[after.status] ?? "?"})`);
    console.log("premium       :", fp.premiumPaid.toString(), "토큰 → 참여사 deposit wallets");

  } else {
    console.log(`\n⚠ 정산 불가 (현재 status=${fp.status})`);
    if (fp.status === 1) {
      console.log("  → manual-resolve로 먼저 오라클 결과를 기록하세요.");
    } else if (fp.status === 3 || fp.status === 5) {
      console.log("  → 이미 정산 완료된 FlightPolicy입니다.");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
