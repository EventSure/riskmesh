/**
 * yarn demo:flight-create
 *
 * FlightPolicy 생성 (create_flight_policy_from_master)
 * 프리미엄(1 USDC)이 리더 ATA → leaderDepositWallet(PDA 소유)으로 이체됩니다.
 *
 * 환경변수:
 *   FLIGHT_NO       항공편 코드 (기본: "KE017")
 *   ROUTE           노선 (기본: "ICN-NRT")
 *   DEPARTURE_TS    출발 Unix timestamp (기본: 2시간 전 — 데몬이 즉시 처리)
 *   SUBSCRIBER_REF  가입자 참조 ID (기본: "DEMO-001")
 */
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { kp, loadState, makeProgram, flightPolicyPub, saveState } from "./common";

async function main() {
  const s = loadState() as any;
  if (!s.masterId || !s.masterPda || !s.leaderAta || !s.leaderDepositWallet) {
    throw new Error("master-setup 데이터 없음. yarn demo:master-setup 먼저 실행하세요.");
  }

  const leader = kp(s.leaderKey);
  const pg = makeProgram(leader);

  const masterPda = new PublicKey(s.masterPda);
  const existing  = (s.flightPolicies as any[] ?? []);
  const childId   = existing.length > 0
    ? existing[existing.length - 1].childId + 1
    : 1;

  const flightNo     = process.env.FLIGHT_NO      ?? "KE017";
  const route        = process.env.ROUTE          ?? "ICN-NRT";
  const subscriberRef = process.env.SUBSCRIBER_REF ?? "DEMO-001";
  // 기본 departure_ts: 2시간 전 (이미 출발한 상태 → 데몬이 oracle 체크 진행)
  const departureTs  = process.env.DEPARTURE_TS
    ? parseInt(process.env.DEPARTURE_TS)
    : Math.floor(Date.now() / 1000) - 2 * 3600;

  const flightPda = flightPolicyPub(masterPda, childId);

  console.log(`\nFlightPolicy 생성 중...`);
  console.log(`  childId       : ${childId}`);
  console.log(`  flightNo      : ${flightNo}`);
  console.log(`  route         : ${route}`);
  console.log(`  departureTs   : ${new Date(departureTs * 1000).toISOString()}`);
  console.log(`  flightPda     : ${flightPda.toBase58()}`);

  const tx = await pg.methods
    .createFlightPolicyFromMaster({
      childPolicyId: new BN(childId),
      subscriberRef,
      flightNo,
      route,
      departureTs:   new BN(departureTs),
    })
    .accounts({
      creator:            leader.publicKey,
      masterPolicy:       masterPda,
      flightPolicy:       flightPda,
      payerToken:         new PublicKey(s.leaderAta),
      leaderDepositToken: new PublicKey(s.leaderDepositWallet),
    })
    .signers([leader])
    .rpc();

  const fp = await pg.account.flightPolicy.fetch(flightPda);
  console.log(`\n✓ create_flight_policy_from_master 완료`);
  console.log(`  Tx             : ${tx}`);
  console.log(`  status         : ${fp.status} (1=AwaitingOracle)`);
  console.log(`  premium_paid   : ${fp.premiumPaid.toString()}`);

  const updated = [...existing, { childId, pda: flightPda.toBase58(), flightNo, departureTs }];
  saveState({ ...s, flightPolicies: updated });
  console.log("✓ .state.json 업데이트 완료");
  console.log("\n다음 단계: 백엔드 데몬 실행 또는 yarn demo:oracle-resolve");
}

main().catch(e => { console.error(e); process.exit(1); });
