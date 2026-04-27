/**
 * yarn demo:5b-claim
 *
 * Track B — Switchboard On-Demand oracle 자동화
 *
 * Queue.fetchQuoteIx()를 사용해 Ed25519 서명 인스트럭션을 생성합니다.
 * (fetchUpdateIx 기본값인 secp256k1과 달리, QuoteVerifier가 요구하는 Ed25519 방식)
 *
 * 트랜잭션 구조:
 *   [0] Ed25519 서명 검증 인스트럭션   ← Queue.fetchQuoteIx()
 *   [1] check_oracle_and_resolve_flight ← 우리 프로그램
 *
 * 환경변수:
 *   ANCHOR_PROVIDER_URL  devnet RPC
 *   CHILD_POLICY_ID      처리할 FlightPolicy ID (기본값: 마지막 항목)
 *   FLIGHT_NO            oracle job spec에 사용할 편명 override (기본값: on-chain fp.flightNo)
 *   PROGRAM_ID           프로그램 ID override (선택)
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  Queue,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
  SPL_SYSVAR_SLOT_HASHES_ID,
  SPL_SYSVAR_INSTRUCTIONS_ID,
} from "@switchboard-xyz/on-demand";
import { CrossbarClient, OracleJob } from "@switchboard-xyz/common";
import {
  loadState,
  kp,
  makeProgram,
  RPC_URL,
  masterAgreementPub,
  flightPolicyPub,
} from "./common";

const FLIGHT_STATUS: Record<number, string> = {
  0: "Issued",
  1: "AwaitingOracle",
  2: "Claimable",
  3: "Paid",
  4: "NoClaim",
  5: "Expired",
};

async function main() {
  const s = loadState();

  if (!s.masterPda || !s.flightPolicies?.length) {
    throw new Error(
      ".state.json에 masterPda / flightPolicies가 없습니다.\n" +
        "먼저 `yarn demo:3-master-setup` 및 `yarn demo:4-flight-create`를 실행하세요."
    );
  }

  if (!s.feedHash) {
    throw new Error(
      ".state.json에 feedHash가 없습니다.\n" +
        "먼저 `yarn demo:2-feed-create`를 실행하세요."
    );
  }

  const leader = kp(s.leaderKey);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const pg = makeProgram(leader);
  const masterPda = new PublicKey(s.masterPda);

  // ─── MasterAgreement에서 oracle_feed 확인 ────────────────────────────────────
  const master = await pg.account.masterAgreement.fetch(masterPda);
  const oracleFeed: PublicKey = master.oracleFeed;

  if (oracleFeed.equals(PublicKey.default)) {
    throw new Error(
      "MasterAgreement.oracle_feed가 설정되어 있지 않습니다.\n" +
        "이 MasterAgreement는 Track A(Trusted Resolver) 전용입니다."
    );
  }
  console.log(`oracle_feed : ${oracleFeed.toBase58()}`);

  // ─── 처리할 FlightPolicy 선택 ─────────────────────────────────────────────
  const existing = s.flightPolicies;
  const targetId = process.env.CHILD_POLICY_ID
    ? parseInt(process.env.CHILD_POLICY_ID)
    : existing[existing.length - 1].childId;

  const fpMeta = existing.find((f) => f.childId === targetId);
  if (!fpMeta) {
    throw new Error(`childId=${targetId}인 FlightPolicy를 찾을 수 없습니다.`);
  }

  const flightPda = flightPolicyPub(masterPda, fpMeta.childId);
  const fp = await pg.account.flightPolicy.fetch(flightPda);

  console.log(`\nFlightPolicy (${flightPda.toBase58().slice(0, 8)}...)`);
  console.log(`  flightNo : ${fp.flightNo}`);
  console.log(
    `  status   : ${fp.status} (${FLIGHT_STATUS[fp.status] ?? "?"})`
  );

  if (fp.status !== 0 && fp.status !== 1) {
    throw new Error(
      `FlightPolicy가 Issued(0) 또는 AwaitingOracle(1) 상태여야 합니다.\n` +
        `현재 상태: ${fp.status} (${FLIGHT_STATUS[fp.status] ?? "?"})`
    );
  }

  // ─── Switchboard 프로그램 & Queue 인스턴스 생성 ──────────────────────────
  console.log("\nSwitchboard 프로그램 로드 중...");
  const sbIdl = await anchor.Program.fetchIdl(
    new PublicKey(ON_DEMAND_DEVNET_PID),
    provider
  );
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패. devnet RPC를 확인하세요.");
  const sbProgram = new anchor.Program(sbIdl as any, provider);

  // Queue 인스턴스 (fetchQuoteIx 호출용)
  const queuePubkey = new PublicKey(ON_DEMAND_DEVNET_QUEUE);
  const queueAccount = new (Queue as any)(sbProgram, queuePubkey);

  // CrossbarClient (기본 Crossbar 서버 사용)
  const crossbar = (CrossbarClient as any).default();

  // ─── IOracleFeed 객체로 Job Spec 재구성 ──────────────────────────────────
  // string hash(feedHashHex) 방식은 Crossbar v2 /v2/fetch/{hash}를 호출하는데,
  // 우리 feed는 v1 /store로 저장됐으므로 v2에서 400이 남.
  // IOracleFeed 객체를 넘기면 fetchSignaturesConsensus({useEd25519: true})를
  // 직접 호출해 Crossbar fetch를 완전히 우회함.
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    throw new Error(
      "PROXY_URL 환경변수가 필요합니다.\n" +
      "contract/.env에 PROXY_URL=https://riskmesh-aviation-proxy.<account>.workers.dev 를 추가하세요."
    );
  }

  const flightNo: string = process.env.FLIGHT_NO ?? fp.flightNo;
  if (process.env.FLIGHT_NO && process.env.FLIGHT_NO !== fp.flightNo) {
    console.log(`FLIGHT_NO override: ${flightNo} (on-chain: ${fp.flightNo})`);
  }

  const jobSpec = OracleJob.create({
    tasks: [
      { httpTask: { url: `${proxyUrl}?flight_iata=${flightNo}` } },
      { jsonParseTask: { path: "$.delay" } },
      { divideTask: { scalar: 10 } },
      { multiplyTask: { scalar: 10 } },
    ],
  });

  const oracleFeedObj = {
    name: `${flightNo}-DELAY`,
    jobs: [jobSpec],
    minOracleSamples: 1,
  };

  console.log(`feed hash   : ${s.feedHash}`);
  console.log(`flight No   : ${flightNo}`);
  console.log(`proxy URL   : ${proxyUrl}`);

  // ─── Worker 직접 호출 테스트 (실제 AviationStack 데이터 흐름 가시화) ──────
  console.log("\nWorker 직접 호출 테스트...");
  const workerTestRes = await fetch(`${proxyUrl}?flight_iata=${flightNo}`);
  const workerTestData = await workerTestRes.json() as { delay: number; found?: boolean };
  console.log(`Worker 응답 (직접): ${JSON.stringify(workerTestData)}`);
  if (workerTestData.found === false) {
    console.log(`  → AviationStack에서 ${flightNo} 편명 데이터 없음 (delay=0 기본값)`);
    console.log("  → FLIGHT_NO env var로 현재 운항 중인 편명을 지정하세요.");
  } else if (workerTestData.delay === 0) {
    console.log(`  → ${flightNo}: 정시 운항 (AviationStack delay=0 또는 null)`);
  } else {
    console.log(`  → ${flightNo}: ${workerTestData.delay}분 지연 감지 ✓`);
  }

  // ─── Ed25519 서명 인스트럭션 가져오기 (QuoteVerifier 호환) ─────────────────
  // IOracleFeed 방식: oracle이 Job Spec을 직접 평가 → Ed25519 서명 반환
  console.log("\noracle update 요청 중 (IOracleFeed 방식, Ed25519 모드)...");
  const ed25519Ix = await queueAccount.fetchQuoteIx(
    crossbar,
    [oracleFeedObj],
    { numSignatures: 1 }
  );

  // instruction data에서 feed value 파싱해서 로그 출력
  try {
    const instrData = Buffer.from(ed25519Ix.data);
    // message_data_offset은 instrData[10..11] (little-endian u16)
    const msgOffset = instrData.readUInt16LE(10);
    // slothash(32) + feed_id(32) + feed_value i128(16) + min_oracle_samples(1)
    const feedValueBuf = instrData.slice(msgOffset + 64, msgOffset + 80);
    // i128 little-endian: lower 8 bytes + upper 8 bytes
    const lo = feedValueBuf.readBigUInt64LE(0);
    const hi = feedValueBuf.readBigUInt64LE(8);
    // PRECISION=18: oracle value = actual_minutes * 10^18
    const PRECISION = BigInt("1000000000000000000"); // 10^18
    const raw = (hi << BigInt(64)) | lo;
    const actualMinutes = Number(raw / PRECISION);
    console.log(`oracle 응답 값: ${actualMinutes} 분 (raw i128=${raw})`);
  } catch {
    console.log("oracle 응답 값 파싱 스킵");
  }

  // ─── check_oracle_and_resolve_flight 인스트럭션 빌드 ─────────────────────
  const ourIx = await pg.methods
    .checkOracleAndResolveFlight()
    .accountsPartial({
      payer:        leader.publicKey,
      masterAgreement: masterPda,
      flightPolicy: flightPda,
      oracleFeed:   oracleFeed,
      queue:        new PublicKey(ON_DEMAND_DEVNET_QUEUE),
      slotHashes:   SPL_SYSVAR_SLOT_HASHES_ID,
      instructions: SPL_SYSVAR_INSTRUCTIONS_ID,
    })
    .instruction();

  // ─── v0 트랜잭션 구성 (순서 필수: Ed25519[0], check_oracle[1]) ────────────
  const allIxs = [ed25519Ix, ourIx];
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const msg = new TransactionMessage({
    payerKey:        leader.publicKey,
    recentBlockhash: blockhash,
    instructions:    allIxs,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  vtx.sign([leader]);

  const sig = await conn.sendTransaction(vtx, { skipPreflight: false });
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  // ─── 결과 확인 ────────────────────────────────────────────────────────────
  const afterFp = await pg.account.flightPolicy.fetch(flightPda);

  console.log("\n=== check_oracle_and_resolve_flight 완료 ===");
  console.log("Tx             :", sig);
  console.log(
    "status         :",
    afterFp.status,
    `(${FLIGHT_STATUS[afterFp.status] ?? "?"})`
  );
  console.log("delay_minutes  :", afterFp.delayMinutes, "분");
  console.log("payout_amount  :", afterFp.payoutAmount.toString());

  if (afterFp.status === 2) {
    console.log("\n→ Claimable. 다음 단계: yarn demo:6-settle");
  } else if (afterFp.status === 4) {
    console.log("\n→ NoClaim (지연 기준 미달). 다음 단계: yarn demo:6-settle");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
