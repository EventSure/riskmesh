/**
 * npm run demo:5b-claim
 *
 * Track B — Switchboard On-Demand quote 기반 자동화
 *
 * Crossbar v2 feed hash로 ed25519 quote를 받아 계약에서 직접 검증합니다.
 * oracle_feed 계정은 Explorer가 조회할 v2 feed hash를 보관하는 기준 계정입니다.
 *
 * 트랜잭션 구조:
 *   [0] ed25519 quote ix                  — oracle 값 서명 검증
 *   [1] check_oracle_and_resolve_flight   — 검증된 quote에서 값 읽기
 *
 * 환경변수:
 *   ANCHOR_PROVIDER_URL  devnet RPC
 *   CHILD_POLICY_ID      처리할 FlightPolicy ID (기본값: 마지막 항목)
 *   PROGRAM_ID           프로그램 ID override (선택)
 *   PROXY_URL            04-flight-create에서 feed 생성 시 필요
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
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
  Queue,
  SPL_SYSVAR_INSTRUCTIONS_ID,
  SPL_SYSVAR_SLOT_HASHES_ID,
} from "@switchboard-xyz/on-demand";
import { CrossbarClient } from "@switchboard-xyz/common";
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

  const leader = kp(s.leaderKey);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const pg = makeProgram(leader);
  const masterPda = new PublicKey(s.masterPda);

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
  console.log(`  flightNo   : ${fp.flightNo}`);
  console.log(`  status     : ${fp.status} (${FLIGHT_STATUS[fp.status] ?? "?"})`);

  if (fp.status !== 0 && fp.status !== 1) {
    throw new Error(
      `FlightPolicy가 Issued(0) 또는 AwaitingOracle(1) 상태여야 합니다.\n` +
        `현재 상태: ${fp.status} (${FLIGHT_STATUS[fp.status] ?? "?"})`
    );
  }

  // ─── FlightPolicy.oracle_feed에서 per-flight feed pubkey 조회 ───────────────
  const oracleFeed: PublicKey = (fp as any).oracleFeed;
  if (!oracleFeed || oracleFeed.equals(PublicKey.default)) {
    throw new Error(
      "FlightPolicy.oracle_feed가 설정되지 않음.\n" +
      "구버전 계정(oracle_feed 필드 없음)이거나 staging 재배포 전 생성된 계정입니다.\n" +
      "yarn demo:4-flight-create를 다시 실행하세요."
    );
  }
  console.log(`\noracle_feed : ${oracleFeed.toBase58()}`);
  console.log(`  Explorer  : https://on.switchboard.xyz/solana/devnet/feeds/${oracleFeed.toBase58()}`);

  // ─── Switchboard quote ix 생성 ───────────────────────────────────────────
  console.log("\nSwitchboard 프로그램 로드 중...");
  const sbIdl = await anchor.Program.fetchIdl(
    new PublicKey(ON_DEMAND_DEVNET_PID),
    provider
  );
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패. devnet RPC를 확인하세요.");
  const sbProgram = new anchor.Program(sbIdl as any, provider);

  const crossbar = (CrossbarClient as any).default();
  const feedHash = (fpMeta as any).feedHash as string | undefined;
  if (!feedHash) {
    throw new Error(
      ".state.json의 FlightPolicy 항목에 feedHash가 없습니다.\n" +
        "Explorer 호환 feed로 새 FlightPolicy를 생성하세요."
    );
  }
  console.log("\noracle quote 요청 중 (Crossbar v2 feed hash)...");
  const switchboardQueue = new PublicKey(ON_DEMAND_DEVNET_QUEUE);
  const queueAccount = new (Queue as any)(sbProgram, switchboardQueue);
  const quoteIx = await queueAccount.fetchQuoteIx(crossbar, [feedHash], {
    numSignatures: 1,
    instructionIdx: 0,
  });
  console.log(`  state feed_hash : ${feedHash}`);

  // ─── check_oracle_and_resolve_flight 인스트럭션 빌드 ─────────────────────
  const ourIx = await pg.methods
    .checkOracleAndResolveFlight()
    .accountsPartial({
      payer:           leader.publicKey,
      masterAgreement: masterPda,
      flightPolicy:    flightPda,
      oracleFeed:      oracleFeed,
      switchboardQueue,
      slothashSysvar:   SPL_SYSVAR_SLOT_HASHES_ID,
      instructionsSysvar: SPL_SYSVAR_INSTRUCTIONS_ID,
    })
    .instruction();

  // ─── v0 트랜잭션 구성 ────────────────────────────────────────────────────
  // 순서 필수: [Switchboard quote ed25519 ix, check_oracle]
  const allIxs = [quoteIx, ourIx];
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const msg = new TransactionMessage({
    payerKey:        leader.publicKey,
    recentBlockhash: blockhash,
    instructions:    allIxs,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  vtx.sign([leader]);

  console.log("\n트랜잭션 전송 중...");
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
  console.log(`\nSwitchboard Explorer에서 oracle 값 확인:`);
  console.log(`  https://on.switchboard.xyz/solana/devnet/feeds/${oracleFeed.toBase58()}`);

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
