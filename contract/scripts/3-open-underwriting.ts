/**
 * anchor run open-uw
 *
 * Leader가 Underwriting을 오픈합니다. (Draft → Open)
 * 이 이후부터 각 insurer가 accept/reject 할 수 있습니다.
 */
import { loadState, kp, makeProgram, policyPub, uwPub, STATE_NAMES } from "./common";

async function main() {
  const s      = loadState();
  const leader = kp(s.leaderKey);
  const pg     = makeProgram(leader);

  const policy = policyPub(leader.publicKey, s.policyId);
  const uw     = uwPub(policy);

  const tx = await pg.methods
    .openUnderwriting()
    .accountsPartial({ policy, underwriting: uw, leader: leader.publicKey })
    .signers([leader])
    .rpc();

  const data = await pg.account.policy.fetch(policy);
  const uwData = await pg.account.underwriting.fetch(uw);
  console.log("=== Underwriting 오픈 완료 ===");
  console.log("Tx         :", tx);
  console.log("Policy 상태:", STATE_NAMES[data.state], `(${data.state})`);
  console.log("UW 상태    :", uwData.status, "(1=Open)");
  console.log("참여자 수  :", uwData.participants.length);
  console.log("다음 단계  : anchor run accept-shares");
}

main().catch(e => { console.error(e); process.exit(1); });
