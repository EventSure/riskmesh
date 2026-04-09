/**
 * yarn demo:2-feed-create
 *
 * Track B (1회 실행) — Switchboard On-Demand Pull Feed 생성
 *
 * AviationStack API를 데이터 소스로 하는 Pull Feed를 devnet에 생성합니다.
 * 생성된 feed public key를 .state.json에 저장합니다.
 *
 * 사전 조건:
 *   - devnet 사용 권장: ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
 *   - 지갑에 충분한 SOL (feed 생성 약 0.01–0.05 SOL)
 *
 * 환경변수:
 *   AVIATIONSTACK_API_KEY   AviationStack API 키 (job에 embed)
 *   FLIGHT_NO               항공편 코드 (기본값: "KE017")
 *   ANCHOR_PROVIDER_URL     RPC 엔드포인트
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { CrossbarClient, OracleJob, OracleFeed } from "@switchboard-xyz/common";
import {
  PullFeed,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
} from "@switchboard-xyz/on-demand";
import { loadState, kp, RPC_URL, saveState } from "./common";
import { requireApiKey } from "./lib/flight-api";

async function main() {
  const apiKey = requireApiKey();
  const flightNo = (process.env.FLIGHT_NO ?? "KE017").toUpperCase();
  const s = loadState();
  const leader = kp(s.leaderKey);

  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // ─── Switchboard 프로그램 로드 ─────────────────────────────────────────────
  console.log("Switchboard On-Demand 프로그램 로드 중...");
  const sbIdl = await anchor.Program.fetchIdl(
    new PublicKey(ON_DEMAND_DEVNET_PID),
    provider
  );
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패. devnet RPC를 확인하세요.");
  const sbProgram = new anchor.Program(sbIdl as any, provider);

  // ─── Job 정의 ─────────────────────────────────────────────────────────────
  // AviationStack → 출발 지연(분) → 10분 단위 내림
  //
  // 주의: API 키가 job에 포함되어 Crossbar에 저장됩니다.
  //   - 무료 플랜 키는 노출되어도 괜찮지만, 유료 키는 주의 필요
  //   - 향후 Switchboard Secrets를 통해 키를 숨기는 방법 사용 가능
  const jobSpec = OracleJob.create({
    tasks: [
      {
        httpTask: {
          // AviationStack 무료 플랜: HTTP 전용 (유료: HTTPS)
          url: `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightNo}`,
        },
      },
      {
        jsonParseTask: {
          // 출발 지연(분). 데이터 없으면 0.
          path: "$.data[0].departure.delay",
        },
      },
      // 10분 단위 내림: floor(delay / 10) * 10
      { divideTask: { scalar: 10 } },
      { multiplyTask: { scalar: 10 } },
    ],
  });

  // ─── Crossbar에 job 업로드 (v2 /v2/store) ────────────────────────────────
  // storeOracleFeed (v2) 는 feedId = sha256(OracleFeed) 를 반환한다.
  // 이 feedId가 온체인 feedHash로 사용되어야 Switchboard UI와 oracle 노드가
  // /v2/fetch/{feedId}로 job 정의를 조회할 수 있다.
  //
  // ❌ 이전 실수: storeOracleFeed로 저장하고 FeedHash.compute(queue, jobs) 를
  //    온체인에 넣으면 feedId ≠ feedHash가 되어 503이 난다.
  // ❌ 이전 실수: v1 /store 를 쓰면 v2 /v2/fetch에서 400이 난다.
  console.log("\nCrossbar에 job 업로드 중 (v2 /v2/store)...");
  const crossbar = CrossbarClient.default();
  const oracleFeed = OracleFeed.create({ jobs: [jobSpec] });
  const { cid, feedId } = await crossbar.storeOracleFeed(oracleFeed);
  // feedId 를 그대로 온체인 feedHash로 사용한다.
  const feedHash = Buffer.from(feedId.replace(/^0x/, ""), "hex");
  console.log("IPFS CID   :", cid);
  console.log("Feed ID    :", feedId);

  // ─── Feed 생성 ─────────────────────────────────────────────────────────────
  // storeFeed가 반환한 feedHash를 initIx에 전달한다.
  // jobs 배열을 직접 넘기면 Crossbar 업로드 없이 해시만 계산되어
  // 오라클 노드가 job 정의를 조회할 수 없다.
  console.log(`\nPull Feed 생성 중 (항공편: ${flightNo})...`);

  const initParams = {
    queue: new PublicKey(ON_DEMAND_DEVNET_QUEUE),
    feedHash,
    name: `${flightNo}-DELAY`,
    maxVariance: 1.0,
    minResponses: 1,
    minSampleSize: 1,
    maxStaleness: 150,
  };

  const [pullFeed, feedKeypair] = (PullFeed as any).generate(sbProgram as any);
  const initIx = await (pullFeed as any).initIx(initParams);

  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: leader.publicKey,
    recentBlockhash: blockhash,
    instructions: [initIx],
  }).compileToV0Message();
  const createTx = new VersionedTransaction(msg);
  createTx.sign([feedKeypair, leader]);

  const txSig = await conn.sendTransaction(createTx, { skipPreflight: false });
  await conn.confirmTransaction(
    { signature: txSig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  const feedPubkey = pullFeed.pubkey.toBase58();

  console.log("\n=== Feed 생성 완료 ===");
  console.log("Tx             :", txSig);
  console.log("Feed Pubkey    :", feedPubkey);
  console.log("IPFS CID       :", cid);
  console.log("Feed ID        :", feedId);
  console.log("항공편         :", flightNo);
  console.log("Switchboard Queue:", ON_DEMAND_DEVNET_QUEUE.toBase58());

  // .state.json에 feed pubkey, cid, feedId 저장
  saveState({ ...s, feedPubkey, feedCid: cid, feedHash: feedId });
  console.log("\n.state.json에 feedPubkey / feedCid / feedHash 저장 완료");
  console.log("\n다음 단계:");
  console.log("  yarn demo:3-master-setup   (oracle_feed에 feedPubkey 자동 사용)");
  console.log("\n주의: oracle 노드가 feed를 처리하기까지 1~2분 소요될 수 있습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
