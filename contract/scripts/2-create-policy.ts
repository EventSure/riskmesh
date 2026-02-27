/**
 * anchor run create-policy
 *
 * 항공편 지연 보험 정책을 생성합니다. (Draft 상태)
 * 이 인스트럭션 하나로 Policy, Underwriting, RiskPool, Registry, Vault 계정이 초기화됩니다.
 */
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  loadState, kp, makeProgram, PAYOUT,
  policyPub, uwPub, poolPub, regPub, STATE_NAMES,
} from "./common";

async function main() {
  const s      = loadState();
  const leader = kp(s.leaderKey);
  const ins1   = kp(s.ins1Key);
  const ins2   = kp(s.ins2Key);
  const mint   = new PublicKey(s.mint);
  const pg     = makeProgram(leader);

  const policy = policyPub(leader.publicKey, s.policyId);
  const uw     = uwPub(policy);
  const pool   = poolPub(policy);
  const reg    = regPub(policy);
  const vault  = getAssociatedTokenAddressSync(mint, pool, true);

  const now = Math.floor(Date.now() / 1000);

  const tx = await pg.methods
    .createPolicy({
      policyId:          new BN(s.policyId),
      route:             "ICN-LAX",
      flightNo:          "KE017",
      departureDate:     new BN(now + 3600),
      delayThresholdMin: 120,
      payoutAmount:      PAYOUT,
      oracleFeed:        PublicKey.default,   // 데모용 더미 주소
      activeFrom:        new BN(now - 10),   // 이미 활성화 가능
      activeTo:          new BN(s.activeTo),
      participants: [
        { insurer: ins1.publicKey, ratioBps: 7000 },
        { insurer: ins2.publicKey, ratioBps: 3000 },
      ],
    })
    .accountsPartial({
      leader:                 leader.publicKey,
      currencyMint:           mint,
      policy, underwriting:   uw,
      riskPool:               pool,
      registry:               reg,
      vault,
      systemProgram:          SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram:           TOKEN_PROGRAM_ID,
    })
    .signers([leader])
    .rpc();

  const data = await pg.account.policy.fetch(policy);
  console.log("=== 정책 생성 완료 ===");
  console.log("Policy PDA :", policy.toBase58());
  console.log("Tx         :", tx);
  console.log("상태       :", STATE_NAMES[data.state], `(${data.state})`);
  console.log("경로       :", Buffer.from(data.route).toString());
  console.log("항공편     :", Buffer.from(data.flightNo).toString());
  console.log("다음 단계  : anchor run open-uw");
}

main().catch(e => { console.error(e); process.exit(1); });
