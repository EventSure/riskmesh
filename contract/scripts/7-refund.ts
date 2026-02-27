/**
 * anchor run refund
 *
 * 만료된 정책에서 insurer1(index=0), insurer2(index=1)가 예치금을 환불받습니다.
 * Expired 상태에서만 호출 가능합니다.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  loadState, kp, makeProgram, RPC_URL,
  policyPub, uwPub, poolPub, STATE_NAMES,
} from "./common";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

async function main() {
  const s    = loadState();
  const leader  = kp(s.leaderKey);
  const ins1    = kp(s.ins1Key);
  const ins2    = kp(s.ins2Key);
  const mint    = new PublicKey(s.mint);
  const ins1Token = new PublicKey(s.ins1Token);
  const ins2Token = new PublicKey(s.ins2Token);
  const conn    = new Connection(RPC_URL, "confirmed");

  const policy = policyPub(leader.publicKey, s.policyId);
  const uw     = uwPub(policy);
  const pool   = poolPub(policy);
  const vault  = getAssociatedTokenAddressSync(mint, pool, true);

  const pg = makeProgram(leader);
  const pBefore = await pg.account.policy.fetch(policy);
  console.log("현재 상태:", STATE_NAMES[pBefore.state], `(${pBefore.state})`);

  if (pBefore.state !== 7) {
    console.error("오류: Expired(7) 상태여야 환불 가능합니다.");
    process.exit(1);
  }

  // 환불 전 vault 잔액
  const vaultBefore = await getAccount(conn, vault);
  console.log("환불 전 Vault 잔액:", vaultBefore.amount.toString(), "tokens\n");

  // insurer1 환불 (index=0)
  const pg1 = makeProgram(ins1);
  const tx1 = await pg1.methods
    .refundAfterExpiry(0)
    .accountsPartial({
      participant:      ins1.publicKey,
      policy, riskPool: pool,
      vault,
      participantToken: ins1Token,
      underwriting:     uw,
      tokenProgram:     TOKEN_PROGRAM_ID,
    })
    .signers([ins1])
    .rpc();
  console.log("insurer1 환불 완료 (index=0)");
  console.log("Tx:", tx1);

  // insurer2 환불 (index=1)
  const pg2 = makeProgram(ins2);
  const tx2 = await pg2.methods
    .refundAfterExpiry(1)
    .accountsPartial({
      participant:      ins2.publicKey,
      policy, riskPool: pool,
      vault,
      participantToken: ins2Token,
      underwriting:     uw,
      tokenProgram:     TOKEN_PROGRAM_ID,
    })
    .signers([ins2])
    .rpc();
  console.log("\ninsurer2 환불 완료 (index=1)");
  console.log("Tx:", tx2);

  // 결과 확인
  const vaultAfter = await getAccount(conn, vault);
  const ins1Info = await getAccount(conn, ins1Token);
  const ins2Info = await getAccount(conn, ins2Token);

  console.log("\n=== 환불 결과 ===");
  console.log("Vault 잔액       :", vaultAfter.amount.toString(), "tokens (0이어야 정상)");
  console.log("insurer1 잔액    :", ins1Info.amount.toString(), "tokens");
  console.log("insurer2 잔액    :", ins2Info.amount.toString(), "tokens");
  console.log("\n플로우 완료! 전체 보험 라이프사이클이 정상적으로 수행됐습니다.");
}

main().catch(e => { console.error(e); process.exit(1); });
