use anyhow::{bail, Context, Result};
use serde::Deserialize;

const BASE_URL: &str = "http://api.aviationstack.com/v1/flights";

#[derive(Debug, Clone)]
pub struct FlightDelayResult {
    pub flight_iata: String,
    pub flight_date: String,
    pub departure_delay: u16, // minutes (0 if not delayed)
    pub cancelled: bool,
    pub status: String,
}

#[derive(Deserialize)]
struct ApiResponse {
    data: Option<Vec<FlightData>>,
    error: Option<ApiError>,
}

#[derive(Deserialize)]
struct ApiError {
    message: String,
}

#[derive(Deserialize)]
struct FlightData {
    flight_date: Option<String>,
    flight_status: Option<String>,
    departure: Option<DepartureInfo>,
    flight: Option<FlightInfo>,
}

#[derive(Deserialize)]
struct DepartureInfo {
    delay: Option<i32>,
}

#[derive(Deserialize)]
struct FlightInfo {
    iata: Option<String>,
}

/// AviationStack API에서 항공편 지연 정보를 조회한다.
/// 무료 플랜: flight_date 서버 필터 미지원 → 클라이언트에서 필터링.
pub async fn fetch_flight_delay(
    api_key: &str,
    flight_iata: &str,
    flight_date: Option<&str>, // "YYYY-MM-DD"
) -> Result<Option<FlightDelayResult>> {
    if api_key.is_empty() {
        bail!("AVIATIONSTACK_API_KEY가 설정되지 않았습니다.");
    }

    let url = format!(
        "{BASE_URL}?access_key={api_key}&flight_iata={flight_iata}&limit=10"
    );

    let resp: ApiResponse = reqwest::get(&url)
        .await
        .context("AviationStack API 호출 실패")?
        .json()
        .await
        .context("AviationStack 응답 파싱 실패")?;

    if let Some(err) = resp.error {
        bail!("AviationStack API 오류: {}", err.message);
    }

    let data = match resp.data {
        Some(d) if !d.is_empty() => d,
        _ => return Ok(None),
    };

    // 날짜 필터 (클라이언트 측)
    let entry = if let Some(date) = flight_date {
        let matched: Vec<_> = data
            .iter()
            .filter(|d| d.flight_date.as_deref() == Some(date))
            .collect();
        if matched.is_empty() {
            tracing::warn!(
                "[flight_api] {flight_iata}: {date} 날짜 데이터 없음 → 최근 데이터 사용"
            );
            &data[0]
        } else {
            matched[0]
        }
    } else {
        &data[0]
    };

    let status = entry
        .flight_status
        .clone()
        .unwrap_or_else(|| "unknown".to_string());
    let cancelled = status == "cancelled";

    let raw_delay = entry
        .departure
        .as_ref()
        .and_then(|d| d.delay)
        .unwrap_or(0);
    // 음수(조기 출발)는 0으로, 10분 단위로 내림
    let delay_minutes = if raw_delay <= 0 {
        0u16
    } else {
        let d = raw_delay as u16;
        (d / 10) * 10
    };

    let iata = entry
        .flight
        .as_ref()
        .and_then(|f| f.iata.clone())
        .unwrap_or_else(|| flight_iata.to_string());

    let date = entry
        .flight_date
        .clone()
        .unwrap_or_else(|| "unknown".to_string());

    Ok(Some(FlightDelayResult {
        flight_iata: iata,
        flight_date: date,
        departure_delay: delay_minutes,
        cancelled,
        status,
    }))
}
