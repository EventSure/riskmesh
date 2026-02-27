/**
 * yarn demo:oracle-resolve
 *
 * Track A — Trusted Resolver (직접 API 연동)
 *
 * 실시간 항공편 데이터를 AviationStack API에서 가져온 뒤,
 * resolve_flight_delay 인스트럭션을 호출해 FlightPolicy 상태를 갱신합니다.
 *
 * 사전 조건:
 *   - anchor deploy 완료
 *   - Master Policy가 Active 상태
 *   - FlightPolicy 계정이 존재해야 함 (create_flight_policy_from_master 완료)
 *
 * 환경변수:
 *   AVIATIONSTACK_API_KEY  (필수) AviationStack API 키
 *   FLIGHT_NO              (선택) 항공편 코드 override, 예: "KE017"
 *   FLIGHT_DATE            (선택) 날짜 override "YYYY-MM-DD"
 *   CHILD_POLICY_ID        (선택) FlightPolicy ID override
 */
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  loadState, kp, makeProgram, saveState,
  masterPolicyPub, flightPolicyPub,
} from "./common";
import { fetchFlightDelay, requireApiKey } from "./lib/flight-api";

// 10분 단위로 내림 (컨트랙트가 10분 단위 오라클 값을 기대하므로)
function floorTo10(minutes: number): number {
  return Math.floor(minutes / 10) * 10;
}

async function main() {
  const apiKey = requireApiKey();
  const s = loadState();

  if (!s.masterId || !s.masterPda || !s.flightPolicies?.length) {
    throw new Error(
      ".state.json에 masterId / masterPda / flightPolicies가 없습니다.\n" +
        "Master Policy와 FlightPolicy를 먼저 생성하세요."
    );
  }

  // 처리할 FlightPolicy 선택 (환경변수 CHILD_POLICY_ID 또는 마지막 항목)
  const targetId = process.env.CHILD_POLICY_ID
    ? parseInt(process.env.CHILD_POLICY_ID)
    : s.flightPolicies[s.flightPolicies.length - 1].childId;

  const fpMeta = s.flightPolicies.find((f) => f.childId === targetId);
  if (!fpMeta) {
    throw new Error(`childId=${targetId}인 FlightPolicy를 찾을 수 없습니다.`);
  }

  const flightNo = process.env.FLIGHT_NO ?? fpMeta.flightNo;
  const flightDate =
    process.env.FLIGHT_DATE ??
    new Date(fpMeta.departureTs * 1000).toISOString().slice(0, 10);

  console.log(`\n항공편 조회 중: ${flightNo} / ${flightDate}`);
  console.log("데이터 소스: AviationStack API");

  const result = await fetchFlightDelay(apiKey, flightNo, flightDate);

  if (!result) {
    console.error(
      `[오류] ${flightNo} (${flightDate}) 데이터를 찾을 수 없습니다.\n` +
        "  - 운항이 완료된 과거 항공편이어야 합니다.\n" +
        "  - AviationStack 무료 플랜은 실시간 데이터만 제공합니다."
    );
    process.exit(1);
  }

  console.log("\n=== 항공편 데이터 ===");
  console.log("상태           :", result.status);
  console.log("결항 여부      :", result.cancelled ? "결항" : "운항");
  console.log("원시 지연(분)  :", result.departureDelay);
  console.log("10분 단위 지연 :", floorTo10(result.departureDelay), "분");
  console.log("예정 출발      :", result.scheduledDeparture);
  console.log("실제 출발      :", result.actualDeparture ?? "(미출발)");

  const delayMinutes10 = floorTo10(result.departureDelay);

  // 온체인 호출
  const leader = kp(s.leaderKey);
  const pg = makeProgram(leader);
  const masterPda = new PublicKey(s.masterPda);
  const flightPda = flightPolicyPub(masterPda, fpMeta.childId);

  const before = await pg.account.flightPolicy.fetch(flightPda);
  console.log(`\nFlightPolicy (${flightPda.toBase58().slice(0, 8)}...)`);
  console.log("현재 status    :", before.status);

  const tx = await pg.methods
    .resolveFlightDelay(delayMinutes10, result.cancelled)
    .accountsPartial({
      resolver: leader.publicKey,
      masterPolicy: masterPda,
      flightPolicy: flightPda,
    })
    .signers([leader])
    .rpc();

  const after = await pg.account.flightPolicy.fetch(flightPda);

  console.log("\n=== resolve_flight_delay 완료 ===");
  console.log("Tx             :", tx);
  console.log("지연(온체인)   :", after.delayMinutes, "분");
  console.log("결항(온체인)   :", after.cancelled);
  console.log("payout_amount  :", after.payoutAmount.toString());
  console.log("status         :", after.status, "(2=Claimable, 4=NoClaim)");

  if (after.status === 2) {
    console.log("\n→ 지급 조건 충족. settle_flight_claim을 실행하세요.");
  } else {
    console.log("\n→ 지급 조건 미충족 (NoClaim). settle_flight_no_claim을 실행하세요.");
  }

  // .state.json 업데이트 (지연 분 기록)
  const updated = s.flightPolicies.map((f) =>
    f.childId === fpMeta.childId ? { ...f, resolvedDelay: delayMinutes10 } : f
  );
  saveState({ ...s, flightPolicies: updated as any });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
