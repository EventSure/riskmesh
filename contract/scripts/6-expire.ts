/**
 * anchor run expire
 *
 * activeTo 시각까지 대기한 후 expirePolicy를 호출합니다.
 * 누구나 호출 가능 (Leader 불필요) — leader 키페어로 수수료만 지불합니다.
 */
import { loadState, kp, makeProgram, policyPub, STATE_NAMES } from "./common";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const s      = loadState();
  const leader = kp(s.leaderKey);   // 수수료 지불용 (권한 불필요)
  const pg     = makeProgram(leader);
  const policy = policyPub(leader.publicKey, s.policyId);

  const before = await pg.account.policy.fetch(policy);
  console.log("현재 상태:", STATE_NAMES[before.state], `(${before.state})`);

  if (before.state !== 3) {
    console.error("오류: Active(3) 상태여야 expire 가능합니다.");
    process.exit(1);
  }

  // activeTo까지 대기
  const now = Math.floor(Date.now() / 1000);
  const remaining = s.activeTo - now;

  if (remaining > 0) {
    console.log(`\nactiveTo까지 ${remaining}초 대기 중...`);
    for (let i = remaining; i > 0; i--) {
      process.stdout.write(`\r남은 시간: ${i}초   `);
      await sleep(1000);
    }
    process.stdout.write("\r만료 시각 도달!          \n");
    // 블록 확정 여유 시간 1초 추가
    await sleep(1000);
  } else {
    console.log("이미 activeTo를 경과했습니다. 바로 실행합니다.");
  }

  const tx = await pg.methods
    .expirePolicy()
    .accountsPartial({ policy })
    .rpc();

  const after = await pg.account.policy.fetch(policy);
  console.log("\n=== 정책 만료 완료 ===");
  console.log("Tx         :", tx);
  console.log("Policy 상태:", STATE_NAMES[after.state], `(${after.state})`);
  console.log("다음 단계  : anchor run refund");
}

main().catch(e => { console.error(e); process.exit(1); });
