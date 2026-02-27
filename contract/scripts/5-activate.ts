/**
 * anchor run activate
 *
 * Leader가 Funded 상태의 정책을 Active로 전환합니다.
 * active_from 시각이 지난 후에만 호출 가능합니다.
 */
import { loadState, kp, makeProgram, policyPub, STATE_NAMES } from "./common";

async function main() {
  const s      = loadState();
  const leader = kp(s.leaderKey);
  const pg     = makeProgram(leader);
  const policy = policyPub(leader.publicKey, s.policyId);

  const before = await pg.account.policy.fetch(policy);
  console.log("현재 상태:", STATE_NAMES[before.state], `(${before.state})`);

  if (before.state !== 2) {
    console.error("오류: Funded(2) 상태여야 activate 가능합니다.");
    process.exit(1);
  }

  const tx = await pg.methods
    .activatePolicy()
    .accountsPartial({ policy, leader: leader.publicKey })
    .signers([leader])
    .rpc();

  const after = await pg.account.policy.fetch(policy);
  console.log("\n=== 정책 활성화 완료 ===");
  console.log("Tx         :", tx);
  console.log("Policy 상태:", STATE_NAMES[after.state], `(${after.state})`);
  console.log("activeTo   :", new Date(s.activeTo * 1000).toLocaleTimeString(), "(만료 시각)");
  console.log("다음 단계  : anchor run expire  (activeTo 이후 실행)");
}

main().catch(e => { console.error(e); process.exit(1); });
