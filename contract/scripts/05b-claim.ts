/**
 * yarn demo:5b-claim
 *
 * Track B — Switchboard On-Demand Pull Feed 기반 자동화
 *
 * PullFeed.fetchUpdateIx()를 사용해 oracle_feed 계정을 on-chain 업데이트합니다.
 * → Switchboard Explorer에서 실시간 oracle 값 확인 가능
 *
 * 트랜잭션 구조:
 *   [0] pullIx (Switchboard PullFeed.fetchUpdateIx) — oracle_feed 계정 업데이트
 *   [1] check_oracle_and_resolve_flight              — 업데이트된 feed에서 값 읽기
 *
 * 환경변수:
 *   ANCHOR_PROVIDER_URL  devnet RPC
 *   CHILD_POLICY_ID      처리할 FlightPolicy ID (기본값: 마지막 항목)
 *   PROGRAM_ID           프로그램 ID override (선택)
 *   PROXY_URL            AviationStack 프록시 URL (선택 — pull feed 방식은 불필요하지만 로그에 활용)
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

  // ─── Switchboard 프로그램 로드 ────────────────────────────────────────────
  console.log("\nSwitchboard 프로그램 로드 중...");
  const sbIdl = await anchor.Program.fetchIdl(
    new PublicKey(ON_DEMAND_DEVNET_PID),
    provider
  );
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패. devnet RPC를 확인하세요.");
  const sbProgram = new anchor.Program(sbIdl as any, provider);

  // CrossbarClient (Crossbar 게이트웨이를 통해 oracle 노드에 on-demand 요청)
  const crossbar = (CrossbarClient as any).default();

  // ─── PullFeed.fetchUpdateIx — oracle_feed 계정 업데이트 ───────────────────
  // fetchUpdateIx는 pullIx를 반환:
  //   - oracle 노드가 job spec 평가 후 서명
  //   - pullIx 실행 시 oracle_feed 계정이 on-chain 업데이트 → Explorer 가시
  console.log("\noracle update 요청 중 (PullFeed.fetchUpdateIx)...");
  const pullFeed = new (PullFeed as any)(sbProgram, oracleFeed);
  const { pullIx, responses, numSuccess } = await pullFeed.fetchUpdateIx({ crossbar });

  if (numSuccess === 0) {
    throw new Error(
      "oracle 노드 응답 없음 (numSuccess=0).\n" +
      "Crossbar 게이트웨이 또는 oracle 노드 상태를 확인하세요."
    );
  }
  console.log(`oracle 응답: numSuccess=${numSuccess}`);
  if (responses && responses[0]) {
    const resp = responses[0];
    // Switchboard PRECISION=18: 실제값 = raw / 10^18
    const raw = typeof resp.value === "bigint" ? resp.value : BigInt(resp.value ?? 0);
    const PRECISION = BigInt("1000000000000000000");
    const actualMinutes = Number(raw / PRECISION);
    console.log(`  oracle 응답 값: ${actualMinutes}분 (raw=${raw})`);
  }

  // ─── check_oracle_and_resolve_flight 인스트럭션 빌드 ─────────────────────
  const ourIx = await pg.methods
    .checkOracleAndResolveFlight()
    .accountsPartial({
      payer:           leader.publicKey,
      masterAgreement: masterPda,
      flightPolicy:    flightPda,
      oracleFeed:      oracleFeed,
    })
    .instruction();

  // ─── v0 트랜잭션 구성 (순서 필수: pullIx[0], check_oracle[1]) ────────────
  const allIxs = [pullIx, ourIx];
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
