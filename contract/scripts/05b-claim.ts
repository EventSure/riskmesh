/**
 * yarn demo:5b-claim
 *
 * Track B — Switchboard On-Demand oracle 자동화
 *
 * Switchboard oracle에서 서명된 update를 가져와 FlightPolicy에 대한
 * check_oracle_and_resolve_flight를 호출합니다.
 *
 * 트랜잭션 구조 (컨트랙트 필수 순서):
 *   [0] Ed25519 서명 검증 인스트럭션   ← Switchboard
 *   [1] verified_update 인스트럭션     ← Switchboard
 *   [2] check_oracle_and_resolve_flight ← 우리 프로그램
 *
 * 사전 조건:
 *   - oracle-feed-create 실행 완료 (feedPubkey가 .state.json에 저장)
 *   - master-setup 실행 완료 (oracle_feed가 MasterPolicy에 등록)
 *   - flight-create 실행 완료 (FlightPolicy가 AwaitingOracle 상태)
 *
 * 환경변수:
 *   ANCHOR_PROVIDER_URL  devnet RPC (기본값: http://localhost:8899)
 *   CHILD_POLICY_ID      처리할 FlightPolicy ID (기본값: 마지막 항목)
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
  PullFeed,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
  SPL_SYSVAR_SLOT_HASHES_ID,
  SPL_SYSVAR_INSTRUCTIONS_ID,
} from "@switchboard-xyz/on-demand";
import {
  loadState,
  kp,
  makeProgram,
  RPC_URL,
  masterPolicyPub,
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

  const leader = kp(s.leaderKey);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const pg = makeProgram(leader);
  const masterPda = new PublicKey(s.masterPda);

  // ─── MasterPolicy에서 oracle_feed 확인 ────────────────────────────────────
  const master = await pg.account.masterPolicy.fetch(masterPda);
  const oracleFeed: PublicKey = master.oracleFeed;

  if (oracleFeed.equals(PublicKey.default)) {
    throw new Error(
      "MasterPolicy.oracle_feed가 설정되어 있지 않습니다.\n" +
        "이 MasterPolicy는 Track A(Trusted Resolver) 전용입니다.\n" +
        "Track B를 사용하려면 oracle-feed-create 후 master-setup을 다시 실행하세요."
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

  // ─── Switchboard 프로그램 & feed 로드 ────────────────────────────────────
  console.log("\nSwitchboard 프로그램 로드 중...");
  const sbIdl = await anchor.Program.fetchIdl(
    new PublicKey(ON_DEMAND_DEVNET_PID),
    provider
  );
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패. devnet RPC를 확인하세요.");
  const sbProgram = new anchor.Program(sbIdl as any, provider);
  const pullFeed = new PullFeed(sbProgram as any, oracleFeed);

  // ─── Switchboard oracle update 인스트럭션 가져오기 ────────────────────────
  // fetchUpdateIx 반환: [ixs, responses, successCount, luts]
  // ixs[0] = Ed25519 서명 검증
  // ixs[1] = verified_update (feed 계정에 값 기록)
  console.log("oracle update 요청 중 (Switchboard 네트워크)...");
  const [sbIxs, responses, , luts] = await pullFeed.fetchUpdateIx({
    numSignatures: 1,
  });

  if (!sbIxs || sbIxs.length < 2) {
    throw new Error(
      "Switchboard 인스트럭션 수신 실패.\n" +
        "  - feed 생성 직후라면 oracle 노드 처리까지 1~2분 대기하세요.\n" +
        "  - Switchboard 상태: https://ondemand.switchboard.xyz"
    );
  }

  if (responses.length > 0) {
    console.log(`oracle 응답 값: ${responses[0]?.value} 분`);
  }

  // ─── check_oracle_and_resolve_flight 인스트럭션 빌드 ─────────────────────
  // 파라미터 없음. 계정 순서: payer, master_policy, flight_policy,
  //   oracle_feed, queue, slot_hashes, instructions
  const ourIx = await pg.methods
    .checkOracleAndResolveFlight()
    .accountsPartial({
      payer:        leader.publicKey,
      masterPolicy: masterPda,
      flightPolicy: flightPda,
      oracleFeed:   oracleFeed,
      queue:        new PublicKey(ON_DEMAND_DEVNET_QUEUE),
      slotHashes:   SPL_SYSVAR_SLOT_HASHES_ID,
      instructions: SPL_SYSVAR_INSTRUCTIONS_ID,
    })
    .instruction();

  // ─── v0 트랜잭션 구성 (순서 필수: Ed25519, verified_update, our ix) ───────
  const allIxs = [...sbIxs, ourIx];
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const msg = new TransactionMessage({
    payerKey:        leader.publicKey,
    recentBlockhash: blockhash,
    instructions:    allIxs,
  }).compileToV0Message(luts ?? []);

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
