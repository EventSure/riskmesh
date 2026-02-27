/**
 * anchor run accept-shares
 *
 * insurer1 (70%), insurer2 (30%) 순서로 담보 토큰을 예치합니다.
 * 모두 accept하면 Underwriting이 Finalized되고 Policy가 Funded 상태가 됩니다.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  loadState, kp, makeProgram, RPC_URL,
  policyPub, uwPub, poolPub, STATE_NAMES,
} from "./common";

async function main() {
  const s    = loadState();
  const leader  = kp(s.leaderKey);
  const ins1    = kp(s.ins1Key);
  const ins2    = kp(s.ins2Key);
  const mint    = new PublicKey(s.mint);
  const ins1Token = new PublicKey(s.ins1Token);
  const ins2Token = new PublicKey(s.ins2Token);

  const policy = policyPub(leader.publicKey, s.policyId);
  const uw     = uwPub(policy);
  const pool   = poolPub(policy);
  const vault  = getAssociatedTokenAddressSync(mint, pool, true);

  // insurer1: index=0, 70% → 700,000 tokens
  const pg1 = makeProgram(ins1);
  const tx1 = await pg1.methods
    .acceptShare(0, new BN(700_000))
    .accountsPartial({
      participant:    ins1.publicKey,
      policy, underwriting: uw, riskPool: pool,
      participantToken: ins1Token, vault,
      tokenProgram:   TOKEN_PROGRAM_ID,
    })
    .signers([ins1])
    .rpc();
  console.log("insurer1 accept 완료 (70% / 700,000 tokens)");
  console.log("Tx:", tx1);

  // insurer2: index=1, 30% → 300,000 tokens
  const pg2 = makeProgram(ins2);
  const tx2 = await pg2.methods
    .acceptShare(1, new BN(300_000))
    .accountsPartial({
      participant:    ins2.publicKey,
      policy, underwriting: uw, riskPool: pool,
      participantToken: ins2Token, vault,
      tokenProgram:   TOKEN_PROGRAM_ID,
    })
    .signers([ins2])
    .rpc();
  console.log("insurer2 accept 완료 (30% / 300,000 tokens)");
  console.log("Tx:", tx2);

  // 결과 확인
  const pg = makeProgram(leader);
  const pData = await pg.account.policy.fetch(policy);
  const uData = await pg.account.underwriting.fetch(uw);
  const conn = new Connection(RPC_URL, "confirmed");
  const vaultInfo = await getAccount(conn, vault);

  console.log("\n=== Accept 결과 ===");
  console.log("Policy 상태   :", STATE_NAMES[pData.state], `(${pData.state})`);
  console.log("Underwriting  :", uData.status, "(2=Finalized)");
  console.log("Vault 잔액    :", vaultInfo.amount.toString(), "tokens");
  console.log("다음 단계     : anchor run activate");
}

main().catch(e => { console.error(e); process.exit(1); });
