/**
 * scripts/lib/flight-api.ts
 *
 * AviationStack REST API 래퍼
 * 실시간 항공편 지연 데이터를 가져옵니다.
 *
 * 무료 플랜: https://aviationstack.com (100 req/month, HTTP only)
 * 유료 플랜: HTTPS 지원, 더 많은 쿼리 허용
 *
 * 환경변수: AVIATIONSTACK_API_KEY
 */

export interface FlightDelayResult {
  /** 항공편 IATA 코드 (예: "KE017") */
  flightIata: string;
  /** 조회 기준 날짜 "YYYY-MM-DD" */
  flightDate: string;
  /** 출발 지연 시간 (분). 정시 출발이면 0. */
  departureDelay: number;
  /** 결항 여부 */
  cancelled: boolean;
  /** 원시 status 문자열 ("scheduled" | "active" | "landed" | "cancelled" | ...) */
  status: string;
  /** 예정 출발 시각 (ISO 8601) */
  scheduledDeparture: string;
  /** 예상 출발 시각 (null = 아직 미배정) */
  estimatedDeparture: string | null;
  /** 실제 출발 시각 (null = 미출발) */
  actualDeparture: string | null;
}

/**
 * AviationStack에서 특정 항공편의 지연 정보를 가져옵니다.
 *
 * @param apiKey  AVIATIONSTACK_API_KEY 환경변수 값
 * @param flightIata  항공편 IATA 코드 (예: "KE017")
 * @param flightDate  날짜 "YYYY-MM-DD". 생략 시 오늘 날짜 사용.
 * @returns FlightDelayResult, 또는 데이터 없으면 null
 */
export async function fetchFlightDelay(
  apiKey: string,
  flightIata: string,
  flightDate?: string
): Promise<FlightDelayResult | null> {
  const date = flightDate ?? new Date().toISOString().slice(0, 10);

  // 무료 플랜은 HTTP만 지원. flight_date는 유료 플랜 전용 파라미터이므로
  // URL에 포함하지 않고 응답 데이터에서 클라이언트 측 필터링으로 처리합니다.
  const url = new URL("http://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("flight_iata", flightIata.toUpperCase());
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`AviationStack HTTP error: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as any;

  // 에러 응답 처리
  if (body.error) {
    const msg = body.error.info ?? body.error.type ?? JSON.stringify(body.error);
    throw new Error(`AviationStack API error: ${msg}`);
  }

  if (!body.data || body.data.length === 0) {
    return null;
  }

  // 날짜 기준 클라이언트 필터링 (무료 플랜은 서버 side flight_date 미지원)
  const matched = body.data.filter(
    (d: any) => !d.flight_date || d.flight_date === date
  );
  if (matched.length === 0) {
    // 날짜 일치 없으면 가장 최근 항목 사용 (실시간 모니터링)
    console.warn(`[flight-api] ${date} 날짜 일치 없음 → 최근 데이터 사용`);
  }
  const f = (matched.length > 0 ? matched : body.data)[0];
  const rawDelay: number = f.departure?.delay ?? 0;

  return {
    flightIata: flightIata.toUpperCase(),
    flightDate: date,
    departureDelay: Math.max(0, rawDelay),
    cancelled: (f.flight_status ?? "") === "cancelled",
    status: f.flight_status ?? "unknown",
    scheduledDeparture: f.departure?.scheduled ?? "",
    estimatedDeparture: f.departure?.estimated ?? null,
    actualDeparture: f.departure?.actual ?? null,
  };
}

/** AviationStack API 키가 환경변수에 설정되어 있는지 확인하고 반환합니다. */
export function requireApiKey(): string {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) {
    throw new Error(
      "AVIATIONSTACK_API_KEY 환경변수를 설정하세요.\n" +
        "  무료 가입: https://aviationstack.com\n" +
        "  실행 예시: AVIATIONSTACK_API_KEY=xxx yarn demo:oracle-resolve"
    );
  }
  return key;
}
