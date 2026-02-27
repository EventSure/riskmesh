/**
 * yarn demo:oracle-claim
 *
 * Track B — Switchboard On-Demand + Legacy Policy
 *
 * Switchboard oracle에서 서명된 update를 가져와 Legacy Policy에 대한
 * check_oracle_and_create_claim을 호출합니다.
 *
 * 트랜잭션 구조 (컨트랙트 필수 순서):
 *   [0] Ed25519 서명 검증 인스트럭션   ← Switchboard
 *   [1] verified_update 인스트럭션     ← Switchboard
 *   [2] check_oracle_and_create_claim  ← 우리 프로그램
 *
 * 사전 조건:
 *   - oracle-feed-create 실행 완료 (feedPubkey가 .state.json에 저장)
 *   - Policy가 Active 상태
 *   - Policy.oracle_feed == .state.json의 feedPubkey
 *
 * 환경변수:
 *   ANCHOR_PROVIDER_URL  RPC (기본값: http://localhost:8899)
 *   PROGRAM_ID           프로그램 ID override (선택)
 */
import * as anchor from "@coral-xyz/anchor";
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  PullFeed,
  ON_DEMAND_DEVNET_PID,
  ON_DEMAND_DEVNET_QUEUE,
  SPL_SYSVAR_SLOT_HASHES_ID,
  SPL_SYSVAR_INSTRUCTIONS_ID,
} from "@switchboard-xyz/on-demand";
import {
  loadState, kp, makeProgram, RPC_URL, PROGRAM_ID,
  policyPub, claimPub, STATE_NAMES,
} from "./common";

async function main() {
  const s = loadState();
  if (!s.feedPubkey) {
    throw new Error(
      ".state.json에 feedPubkey가 없습니다.\n" +
        "먼저 `yarn demo:oracle-feed-create`를 실행하세요."
    );
  }

  const leader = kp(s.leaderKey);
  const feedKey = new PublicKey(s.feedPubkey);
  const conn = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(leader), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const pg = makeProgram(leader);
  const policyKey = policyPub(leader.publicKey, s.policyId);

  // ─── Policy 상태 확인 ─────────────────────────────────────────────────────
  const policy = await pg.account.policy.fetch(policyKey);
  console.log("Policy 상태  :", STATE_NAMES[policy.state], `(${policy.state})`);

  if (policy.state !== 3) {
    throw new Error("Policy가 Active(3) 상태여야 합니다.");
  }
  if (!policy.oracleFeed.equals(feedKey)) {
    throw new Error(
      `Policy.oracle_feed 불일치\n` +
        `  Policy에 저장된 값: ${policy.oracleFeed.toBase58()}\n` +
        `  .state.json feedPubkey: ${feedKey.toBase58()}\n` +
        "  create_policy 시 feedPubkey를 oracleFeed로 지정해야 합니다."
    );
  }

  // ─── Switchboard 프로그램 & feed 로드 ────────────────────────────────────
  console.log("\nSwitchboard 프로그램 로드 중...");
  const sbIdl = await anchor.Program.fetchIdl(
    new PublicKey(ON_DEMAND_DEVNET_PID),
    provider
  );
  if (!sbIdl) throw new Error("Switchboard IDL 로드 실패");
  const sbProgram = new anchor.Program(sbIdl as any, provider);
  const pullFeed = new PullFeed(sbProgram as any, feedKey);

  // ─── Switchboard oracle update 인스트럭션 가져오기 ────────────────────────
  // fetchUpdateIx:
  //   반환값: [TransactionInstruction[], AddressLookupTableAccount[], OracleResponse[]]
  //   ixs[0] = Ed25519 서명 검증 (verifyInstruction_at(0)이 이것을 참조)
  //   ixs[1] = verified_update (oracle 데이터를 feed 계정에 기록)
  console.log("oracle update 요청 중 (Switchboard 네트워크)...");
  // 반환 순서: [ixs, responses, successCount, luts, logs]
  const [sbIxs, responses, , luts] = await pullFeed.fetchUpdateIx({
    // crossbarClient를 생략하면 SDK 내부 CrossbarClient.default() 사용
    numSignatures: 1,
  });

  if (!sbIxs || sbIxs.length < 2) {
    throw new Error(
      "Switchboard 인스트럭션 수신 실패.\n" +
        "  - feed 생성 직후라면 oracle 노드 처리까지 1~2분 대기하세요.\n" +
        "  - feed가 devnet 큐에 올바르게 등록됐는지 확인하세요.\n" +
        "  - Switchboard 상태: https://ondemand.switchboard.xyz"
    );
  }

  // oracle 응답에서 현재 값 미리 출력
  if (responses.length > 0) {
    const val = responses[0]?.value;
    console.log(`oracle 응답 값: ${val} 분`);
  }

  // ─── oracle_round 결정 ───────────────────────────────────────────────────
  // oracle_round는 Claim PDA의 seed로 사용되므로 유일한 값이어야 함.
  // 현재 확정된 슬롯을 사용하면 슬롯마다 유일한 Claim PDA가 생성됨.
  const currentSlot = await conn.getSlot("confirmed");
  const oracleRound = BigInt(currentSlot);
  const claimKey = claimPub(policyKey, oracleRound);

  console.log(`\noracle_round (slot): ${oracleRound}`);
  console.log(`Claim PDA          : ${claimKey.toBase58()}`);

  // ─── check_oracle_and_create_claim 인스트럭션 빌드 ────────────────────────
  const ourIx = await pg.methods
    .checkOracleAndCreateClaim(new BN(oracleRound.toString()))
    .accountsPartial({
      policy: policyKey,
      claim: claimKey,
      payer: leader.publicKey,
      oracleFeed: feedKey,
      queue: new PublicKey(ON_DEMAND_DEVNET_QUEUE),
      slotHashes: SPL_SYSVAR_SLOT_HASHES_ID,
      instructions: SPL_SYSVAR_INSTRUCTIONS_ID,
    })
    .instruction();

  // ─── 트랜잭션 구성 (순서 필수: Ed25519, verified_update, our ix) ──────────
  const allIxs = [...sbIxs, ourIx];
  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const msg = new TransactionMessage({
    payerKey: leader.publicKey,
    recentBlockhash: blockhash,
    instructions: allIxs,
  }).compileToV0Message(luts ?? []);

  const vtx = new VersionedTransaction(msg);
  vtx.sign([leader]);

  const sig = await conn.sendTransaction(vtx, { skipPreflight: false });
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  // ─── 결과 확인 ────────────────────────────────────────────────────────────
  const afterPolicy = await pg.account.policy.fetch(policyKey);
  console.log("\n=== check_oracle_and_create_claim 완료 ===");
  console.log("Tx              :", sig);
  console.log("Policy 상태     :", STATE_NAMES[afterPolicy.state], `(${afterPolicy.state})`);

  if (afterPolicy.state === 4) {
    // Claimable
    const claim = await pg.account.claim.fetch(claimKey);
    console.log("oracle_value    :", claim.oracleValue.toString(), "분");
    console.log("payout_amount   :", claim.payoutAmount.toString());
    console.log("\n→ Claimable 상태. 다음 단계:");
    console.log("  approve_claim  → settle_claim 순서로 실행하세요.");
  } else {
    console.log("\n→ oracle 값이 지연 기준(120분) 미만. Policy는 Active 유지.");
    console.log("  (oracle 값이 실제로 지연된 항공편의 데이터여야 합니다)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
