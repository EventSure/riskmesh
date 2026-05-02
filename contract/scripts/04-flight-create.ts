/**
 * yarn demo:4-flight-create
 *
 * per-flight Switchboard feed 생성 + FlightPolicy 생성
 *
 * 1. 항공편별 Switchboard Pull Feed를 생성하고 feedPubkey를 저장합니다.
 *    (job spec에 FLIGHT_NO가 고정됨 → Explorer에서 편명별 오라클 값 확인 가능)
 * 2. create_flight_policy_from_master 호출 시 oracle_feed로 전달합니다.
 *
 * 환경변수:
 *   FLIGHT_NO       항공편 코드 (기본: "KE017")
 *   ROUTE           노선 (기본: "ICN-NRT")
 *   DEPARTURE_TS    출발 Unix timestamp (기본: 2시간 전 — 데몬이 즉시 처리)
 *   SUBSCRIBER_REF  가입자 참조 ID (기본: "DEMO-001")
 *   PROXY_URL       AviationStack 프록시 URL (필수)
 */
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { OracleJob } from "@switchboard-xyz/common";
import {
  PullFeed,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
} from "@switchboard-xyz/on-demand";
import { kp, loadState, makeProgram, flightPolicyPub, saveState, RPC_URL } from "./common";

async function main() {
  const s = loadState() as any;
  if (!s.masterId || !s.masterPda || !s.leaderAta || !s.leaderPoolWallet) {
    throw new Error("master-setup 데이터 없음. yarn demo:3-master-setup 먼저 실행하세요.");
  }

  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    throw new Error(
      "PROXY_URL 환경변수가 필요합니다.\n" +
      "contract/.env에 PROXY_URL=https://riskmesh-aviation-proxy.<account>.workers.dev 를 추가하세요."
    );
  }

  const leader = kp(s.leaderKey);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const pg = makeProgram(leader);
  const masterPda = new PublicKey(s.masterPda);
  const existing = (s.flightPolicies as any[] ?? []);
  const childId = existing.length > 0
    ? existing[existing.length - 1].childId + 1
    : 1;

  const flightNo     = process.env.FLIGHT_NO      ?? "KE017";
  const route        = process.env.ROUTE          ?? "ICN-NRT";
  const subscriberRef = process.env.SUBSCRIBER_REF ?? "DEMO-001";
  const departureTs  = process.env.DEPARTURE_TS
    ? parseInt(process.env.DEPARTURE_TS)
    : Math.floor(Date.now() / 1000) - 2 * 3600;

  const flightPda = flightPolicyPub(masterPda, childId);

  // ─── per-flight Switchboard Pull Feed 생성 ──────────────────────────────────
  console.log(`\nSwitchboard Feed 생성 중 (항공편: ${flightNo})...`);

  const sbIdl = await anchor.Program.fetchIdl(new PublicKey(ON_DEMAND_DEVNET_PID), provider);
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패. devnet RPC를 확인하세요.");
  const sbProgram = new anchor.Program(sbIdl as any, provider);

  const jobSpec = OracleJob.create({
    tasks: [
      { httpTask: { url: `${proxyUrl}?flight_iata=${flightNo}` } },
      { jsonParseTask: { path: "$.delay" } },
      { divideTask: { scalar: 10 } },
      { multiplyTask: { scalar: 10 } },
    ],
  });

  const v2Res = await fetch("https://crossbar.switchboard.xyz/v2/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feed: { jobs: [OracleJob.toObject(jobSpec)] } }),
  });
  if (!v2Res.ok) throw new Error(`Crossbar v2/store 실패: ${v2Res.status} ${await v2Res.text()}`);
  const v2Data = await v2Res.json() as { cid: string; feedId: string };
  const feedHashHex = v2Data.feedId;
  const feedHash = Buffer.from(feedHashHex.replace(/^0x/, ""), "hex");
  console.log(`  Feed Hash  : ${feedHashHex}`);

  const [pullFeed, feedKeypair] = (PullFeed as any).generate(sbProgram as any);
  const initIx = await (pullFeed as any).initIx({
    queue: new PublicKey(ON_DEMAND_DEVNET_QUEUE),
    feedHash,
    name: `${flightNo}-DELAY`,
    maxVariance: 1.0,
    minResponses: 1,
    minSampleSize: 1,
    maxStaleness: 150,
  });

  const { blockhash: bh1, lastValidBlockHeight: lvbh1 } =
    await conn.getLatestBlockhash("confirmed");
  const feedMsg = new TransactionMessage({
    payerKey: leader.publicKey,
    recentBlockhash: bh1,
    instructions: [initIx],
  }).compileToV0Message();
  const feedTx = new VersionedTransaction(feedMsg);
  feedTx.sign([feedKeypair, leader]);

  const feedSig = await conn.sendTransaction(feedTx, { skipPreflight: false });
  await conn.confirmTransaction({ signature: feedSig, blockhash: bh1, lastValidBlockHeight: lvbh1 }, "confirmed");

  const feedPubkey: PublicKey = pullFeed.pubkey;
  console.log(`✓ Feed 생성 완료`);
  console.log(`  Feed Pubkey: ${feedPubkey.toBase58()}`);
  console.log(`  Switchboard Explorer: https://on.switchboard.xyz/solana/devnet/feeds/${feedPubkey.toBase58()}`);

  // ─── FlightPolicy 생성 ───────────────────────────────────────────────────────
  console.log(`\nFlightPolicy 생성 중...`);
  console.log(`  childId       : ${childId}`);
  console.log(`  flightNo      : ${flightNo}`);
  console.log(`  route         : ${route}`);
  console.log(`  departureTs   : ${new Date(departureTs * 1000).toISOString()}`);
  console.log(`  flightPda     : ${flightPda.toBase58()}`);

  const tx = await pg.methods
    .createFlightPolicyFromMaster({
      childPolicyId: new BN(childId),
      subscriberRef,
      flightNo,
      route,
      departureTs: new BN(departureTs),
      oracleFeed: feedPubkey,
    })
    .accounts({
      creator:         leader.publicKey,
      masterAgreement: masterPda,
      flightPolicy:    flightPda,
      payerToken:      new PublicKey(s.leaderAta),
      leaderPoolToken: new PublicKey(s.leaderPoolWallet),
    })
    .signers([leader])
    .rpc();

  const fp = await pg.account.flightPolicy.fetch(flightPda);
  console.log(`\n✓ create_flight_policy_from_master 완료`);
  console.log(`  Tx             : ${tx}`);
  console.log(`  status         : ${fp.status} (1=AwaitingOracle)`);
  console.log(`  oracle_feed    : ${(fp as any).oracleFeed?.toBase58() ?? "?"}`);

  const updated = [...existing, {
    childId,
    pda: flightPda.toBase58(),
    flightNo,
    departureTs,
    feedPubkey: feedPubkey.toBase58(),
    feedHash: feedHashHex,
  }];
  saveState({ ...s, flightPolicies: updated });
  console.log("✓ .state.json 업데이트 완료");
  console.log("\n다음 단계: 백엔드 데몬 실행 또는 yarn demo:5b-claim");
}

main().catch(e => { console.error(e); process.exit(1); });
