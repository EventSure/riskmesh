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
 *   - Cloudflare Worker 배포 완료 (oracle-proxy/ 참고)
 *
 * 환경변수:
 *   PROXY_URL               HTTPS 프록시 URL (기본값: contract/.env의 PROXY_URL)
 *                           예: https://riskmesh-aviation-proxy.<account>.workers.dev
 *   FLIGHT_NO               항공편 코드 (기본값: "KE017")
 *   ANCHOR_PROVIDER_URL     RPC 엔드포인트
 *
 * 주의: API 키는 Cloudflare Worker secret에 저장되므로 job spec에 포함되지 않습니다.
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { OracleJob } from "@switchboard-xyz/common";
import {
  PullFeed,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
} from "@switchboard-xyz/on-demand";
import { loadState, kp, RPC_URL, saveState } from "./common";

async function main() {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    throw new Error(
      "PROXY_URL 환경변수가 설정되지 않았습니다.\n" +
      "contract/.env에 PROXY_URL=https://riskmesh-aviation-proxy.<account>.workers.dev 를 추가하세요.\n" +
      "Cloudflare Worker 배포 방법은 oracle-proxy/README.md를 참고하세요."
    );
  }
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
  const jobSpec = OracleJob.create({
    tasks: [
      {
        httpTask: {
          // Cloudflare Worker HTTPS 프록시 경유 (Switchboard는 HTTPS만 허용)
          // API 키는 Worker secret에 저장됨 — URL에 포함되지 않음
          url: `${proxyUrl}?flight_iata=${flightNo}`,
        },
      },
      {
        jsonParseTask: {
          // Worker가 {"delay": N} 형태로 정규화해서 반환 (데이터 없으면 0)
          path: "$.delay",
        },
      },
      // 10분 단위 내림: floor(delay / 10) * 10
      { divideTask: { scalar: 10 } },
      { multiplyTask: { scalar: 10 } },
    ],
  });

  // ─── Crossbar에 job 업로드 (v2 /v2/store) ───────────────────────────────
  // v2 스토리지를 사용해야 Switchboard 웹사이트에서 feedId로 조회 가능.
  // v1 /store는 다른 해시 알고리즘을 사용하므로 웹사이트 v2 /v2/fetch에서 400이 남.
  // 05b-claim.ts는 IOracleFeed 객체 방식으로 Crossbar를 완전 우회하므로
  // v1/v2 저장 방식과 무관하게 oracle 실행에는 영향 없음.
  console.log("\nCrossbar에 job 업로드 중 (v2 /v2/store)...");
  const v2Res = await fetch("https://crossbar.switchboard.xyz/v2/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feed: { jobs: [OracleJob.toObject(jobSpec)] },
    }),
  });
  if (!v2Res.ok) throw new Error(`Crossbar v2/store 실패: ${v2Res.status}`);
  const v2Data = await v2Res.json() as { cid: string; feedId: string; version: string };
  const cid = v2Data.cid;
  const feedHashHex = v2Data.feedId;
  const feedId = feedHashHex;
  const feedHash = Buffer.from(feedHashHex.replace(/^0x/, ""), "hex");
  console.log("IPFS CID   :", cid);
  console.log("Feed ID    :", feedHashHex);

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
  console.log("\nSwitchboard 웹사이트 feed 조회:");
  console.log(`  https://on.switchboard.xyz/solana/devnet/feeds/${feedPubkey}`);

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
