/**
 * yarn demo:simulate
 *
 * Switchboard Crossbar v2 simulate API 직접 호출
 * 웹사이트 Simulate 버튼과 동일한 Receipt 응답을 터미널에서 확인.
 *
 * 응답 구조:
 *   results[]  — Job별 최종 숫자값 (PRECISION=18 적용된 i128)
 *   receipts[] — Task별 중간 실행 결과 (HttpTask → JsonParseTask → ...)
 */
import { CrossbarClient } from "@switchboard-xyz/common";
import { loadState } from "./common";

async function main() {
  const s = loadState();
  const feedId = s.feedHash;

  if (!feedId) {
    throw new Error(".state.json에 feedHash가 없습니다. yarn demo:2-feed-create 먼저 실행하세요.");
  }

  const crossbar = (CrossbarClient as any).default();
  crossbar.setNetwork("devnet");

  console.log(`Feed Simulate 호출 중...`);
  console.log(`feedId  : ${feedId}`);
  console.log(`feedPub : ${s.feedPubkey ?? "(없음)"}\n`);

  const result = await (crossbar as any).simulateFeed(feedId, /* includeReceipts */ true);

  // ─── 최종 결과 출력 ─────────────────────────────────────────────────────────
  // simulate 결과는 실제 값 float 문자열 (e.g. "45.00"), oracle Ed25519 데이터의 i128과 다름
  if (result.results) {
    console.log("=== Results ===");
    (result.results as unknown[]).forEach((r, i) => {
      console.log(`  Job ${i}: ${r} 분`);
    });
  }

  // ─── Receipt 출력 ───────────────────────────────────────────────────────────
  if (result.receipts) {
    console.log("\n=== Receipts ===");
    console.log(JSON.stringify(result.receipts, null, 2));
  }

  if (result.error) {
    console.error("\nSimulate 에러:", result.error);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
