/**
 * yarn demo:oracle-feed-create
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
import { OracleJob } from "@switchboard-xyz/common";
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
  // 주의: API 키가 job에 포함되어 feed 계정(온체인)에 저장됩니다.
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
      // divideTask(정수 나눗셈) → 자동으로 내림 효과, multiplyTask로 복원
      { divideTask: { scalar: 10 } },
      { multiplyTask: { scalar: 10 } },
    ],
  });

  // ─── Feed 생성 ─────────────────────────────────────────────────────────────
  // PullFeed.initTx 내부에서 payer를 asV0TxWithComputeIxs에 전달하지 않는
  // SDK 버그(v3.9)를 우회: generate + initIx로 분리하여 수동 트랜잭션 구성.
  console.log(`\nPull Feed 생성 중 (항공편: ${flightNo})...`);

  const initParams = {
    queue: new PublicKey(ON_DEMAND_DEVNET_QUEUE),
    jobs: [jobSpec],
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
  console.log("항공편         :", flightNo);
  console.log("Switchboard Queue:", ON_DEMAND_DEVNET_QUEUE);

  // .state.json에 feed pubkey 저장
  saveState({ ...s, feedPubkey });
  console.log("\n.state.json에 feedPubkey 저장 완료");
  console.log("\n다음 단계:");
  console.log("  1. create-policy 스크립트에서 oracleFeed에 이 주소를 사용하세요.");
  console.log("  2. oracle-claim.ts가 .state.json에서 feedPubkey를 자동으로 읽습니다.");
  console.log("\n주의: oracle 노드가 feed를 처리하기까지 1~2분 소요될 수 있습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
