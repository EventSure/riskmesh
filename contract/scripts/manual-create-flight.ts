/**
 * yarn demo:manual-create-flight
 *
 * .state.json 없이 FlightPolicy를 직접 생성합니다.
 * child_policy_id는 온체인의 기존 FlightPolicy를 조회하여 자동 증가합니다.
 *
 * 환경변수:
 *   MASTER_PDA       MasterPolicy 주소 (필수)
 *   FLIGHT_NO        항공편명 (기본값: KE001)
 *   ROUTE            노선 (기본값: ICN-NRT)
 *   DEPARTURE_TS     출발 Unix timestamp (기본값: 현재+24시간)
 *   SUBSCRIBER_REF   가입자 참조 (기본값: manual-test)
 *   CHILD_POLICY_ID  직접 지정 시 사용 (생략하면 자동 증가)
 *   KEYPAIR_PATH     leader 키페어 경로 (기본값: ~/.config/solana/riskmesh-leader.json)
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";

const MASTER_PDA      = process.env.MASTER_PDA      ?? (() => { throw new Error("MASTER_PDA 환경변수가 필요합니다"); })();
const FLIGHT_NO       = process.env.FLIGHT_NO        ?? "KE001";
const ROUTE           = process.env.ROUTE            ?? "ICN-NRT";
const SUBSCRIBER_REF  = process.env.SUBSCRIBER_REF   ?? "manual-test";
const KEYPAIR_PATH    = process.env.KEYPAIR_PATH
  ?? path.join(process.env.HOME ?? "~", ".config/solana/riskmesh-leader.json");

// 출발시각: 기본 현재+24시간
const DEPARTURE_TS = parseInt(
  process.env.DEPARTURE_TS ?? String(Math.floor(Date.now() / 1000) + 86400)
);

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

  // 온체인 MasterPolicy 조회
  const master = await (pg.account as any).masterPolicy.fetch(masterPda);

  // child_policy_id 결정: 환경변수 지정 또는 자동 증가
  let childId: number;
  if (process.env.CHILD_POLICY_ID) {
    childId = parseInt(process.env.CHILD_POLICY_ID);
  } else {
    // 기존 FlightPolicy 조회하여 max+1
    const allFlights = await (pg.account as any).flightPolicy.all([
      { memcmp: { offset: 16, bytes: masterPda.toBase58() } },
    ]);
    const maxId = allFlights.reduce(
      (max: number, f: any) => Math.max(max, f.account.childPolicyId.toNumber()),
      0
    );
    childId = maxId + 1;
  }

  const flightPda = flightPolicyPub(masterPda, childId, programId);

  // leader의 ATA (premium 지불용)
  const { getAssociatedTokenAddress } = await import("@solana/spl-token");
  const payerAta = await getAssociatedTokenAddress(master.currencyMint, leader.publicKey);

  console.log("=== manual-create-flight ===");
  console.log("leader         :", leader.publicKey.toBase58());
  console.log("masterPda      :", masterPda.toBase58());
  console.log("childPolicyId  :", childId);
  console.log("flightPda      :", flightPda.toBase58());
  console.log("flightNo       :", FLIGHT_NO);
  console.log("route          :", ROUTE);
  console.log("subscriberRef  :", SUBSCRIBER_REF);
  console.log("departureTs    :", DEPARTURE_TS, `(${new Date(DEPARTURE_TS * 1000).toISOString()})`);
  console.log("premiumPerPolicy:", master.premiumPerPolicy.toString());
  console.log("payerAta       :", payerAta.toBase58());

  const params = {
    childPolicyId: new BN(childId),
    subscriberRef: SUBSCRIBER_REF,
    flightNo: FLIGHT_NO,
    route: ROUTE,
    departureTs: new BN(DEPARTURE_TS),
  };

  const tx = await pg.methods
    .createFlightPolicyFromMaster(params)
    .accountsPartial({
      creator:            leader.publicKey,
      masterPolicy:       masterPda,
      flightPolicy:       flightPda,
      payerToken:         payerAta,
      leaderDepositToken: master.leaderDepositWallet,
      tokenProgram:       TOKEN_PROGRAM_ID,
      systemProgram:      anchor.web3.SystemProgram.programId,
    })
    .signers([leader])
    .rpc();

  const fp = await (pg.account as any).flightPolicy.fetch(flightPda);

  console.log("\n=== 완료 ===");
  console.log("tx             :", tx);
  console.log("status         :", fp.status, "(1=AwaitingOracle)");
  console.log("premiumPaid    :", fp.premiumPaid.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
