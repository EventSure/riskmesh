/**
 * yarn demo:6-settle
 *
 * FlightPolicy 상태에 따라 정산 실행:
 *   Claimable(2) → settle_flight_claim    → leaderPool → leaderDeposit
 *   NoClaim(4)   → settle_flight_no_claim → leaderDeposit → leaderAta
 *
 * 환경변수:
 *   CHILD_POLICY_ID  처리할 FlightPolicy ID (기본: 마지막 항목)
 */
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { kp, loadState, makeProgram, flightPolicyPub } from "./common";

async function main() {
  const s = loadState() as any;
  if (!s.masterId || !s.masterPda || !s.flightPolicies?.length) {
    throw new Error("masterId / flightPolicies 없음. 이전 단계를 먼저 실행하세요.");
  }
  if (!s.leaderDepositWallet || !s.reinsurerPoolWallet || !s.leaderPoolWallet || !s.leaderAta) {
    throw new Error("토큰 계정 정보 없음. yarn demo:3-master-setup 먼저 실행하세요.");
  }
  if (!s.participantAPoolWallet || !s.participantBPoolWallet) {
    throw new Error("참여사 pool wallet 없음. yarn demo:3-master-setup 먼저 실행하세요.");
  }

  const leader    = kp(s.leaderKey);
  const pg        = makeProgram(leader);
  const masterPda = new PublicKey(s.masterPda);
  const existing  = s.flightPolicies as any[];

  const targetId = process.env.CHILD_POLICY_ID
    ? parseInt(process.env.CHILD_POLICY_ID)
    : existing[existing.length - 1].childId;

  const fpMeta = existing.find((f: any) => f.childId === targetId);
  if (!fpMeta) throw new Error(`childId=${targetId} FlightPolicy를 찾을 수 없습니다.`);

  const flightPda = flightPolicyPub(masterPda, targetId);
  const fp        = await pg.account.flightPolicy.fetch(flightPda);

  const STATUS = { 0:"Issued", 1:"AwaitingOracle", 2:"Claimable", 3:"Paid", 4:"NoClaim", 5:"Expired" };

  console.log(`\nFlightPolicy (${flightPda.toBase58().slice(0, 8)}...)`);
  console.log(`  flightNo      : ${fp.flightNo}`);
  console.log(`  status        : ${fp.status} (${STATUS[fp.status as keyof typeof STATUS] ?? "?"})`);
  console.log(`  delayMinutes  : ${fp.delayMinutes}`);
  console.log(`  cancelled     : ${fp.cancelled}`);
  console.log(`  payoutAmount  : ${fp.payoutAmount.toString()}`);

  if (fp.status === 2) {
    // ── Claimable → settle_flight_claim ──────────────────────────────────────
    console.log("\n→ Claimable: settle_flight_claim 실행 중...");
    console.log("  leaderPool → leaderDeposit 이체");
    const tx = await pg.methods
      .settleFlightClaim()
      .accountsPartial({
        executor:            leader.publicKey,
        masterPolicy:        masterPda,
        flightPolicy:        flightPda,
        leaderDepositToken:  new PublicKey(s.leaderDepositWallet),
        leaderPoolToken:     new PublicKey(s.leaderPoolWallet),
        reinsurerPoolToken:  new PublicKey(s.reinsurerPoolWallet),
        tokenProgram:        TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        // participants 순서대로: A, B 각 pool_wallet
        { pubkey: new PublicKey(s.participantAPoolWallet!), isWritable: true, isSigner: false },
        { pubkey: new PublicKey(s.participantBPoolWallet!), isWritable: true, isSigner: false },
      ])
      .signers([leader])
      .rpc();

    const after = await pg.account.flightPolicy.fetch(flightPda);
    console.log(`\n✓ settle_flight_claim 완료`);
    console.log(`  Tx     : ${tx}`);
    console.log(`  status : ${after.status} (3=Paid)`);
    console.log(`  payout : ${fp.payoutAmount.toString()} 토큰이 leaderDepositWallet에 수령됨`);

  } else if (fp.status === 4) {
    // ── NoClaim → settle_flight_no_claim ─────────────────────────────────────
    console.log("\n→ NoClaim: settle_flight_no_claim 실행 중...");
    console.log("  leaderDeposit → leaderAta(premium) 이체");
    const tx = await pg.methods
      .settleFlightNoClaim()
      .accountsPartial({
        executor:               leader.publicKey,
        masterPolicy:           masterPda,
        flightPolicy:           flightPda,
        leaderPoolToken:        new PublicKey(s.leaderPoolWallet),
        leaderDepositToken:     new PublicKey(s.leaderDepositWallet),
        reinsurerDepositToken:  new PublicKey(s.reinsurerDepositWallet ?? s.leaderPoolWallet),
        tokenProgram:           TOKEN_PROGRAM_ID,
      })
      .remainingAccounts([
        // participants 순서대로: A, B 각 deposit_wallet
        { pubkey: new PublicKey(s.participantADepositWallet!),       isWritable: true, isSigner: false },
        { pubkey: new PublicKey(s.participantBDepositWallet!),       isWritable: true, isSigner: false },
      ])
      .signers([leader])
      .rpc();

    const after = await pg.account.flightPolicy.fetch(flightPda);
    console.log(`\n✓ settle_flight_no_claim 완료`);
    console.log(`  Tx     : ${tx}`);
    console.log(`  status : ${after.status} (5=Expired)`);
    console.log(`  premium: ${fp.premiumPaid.toString()} 토큰이 leaderAta로 반환됨`);

  } else {
    console.log(`\n⚠ 정산 불가 (현재 status=${fp.status})`);
    if (fp.status === 1) {
      console.log("  → oracle-resolve 또는 백엔드 데몬으로 먼저 오라클 결과를 기록하세요.");
    } else if (fp.status === 3 || fp.status === 5) {
      console.log("  → 이미 정산 완료된 FlightPolicy입니다.");
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
