/**
 * Cloudflare Worker — AviationStack HTTPS proxy for Switchboard oracle nodes
 *
 * Switchboard oracle nodes enforce HTTPS-only for httpTask.
 * AviationStack free plan is HTTP-only.
 * This Worker normalizes the response so Switchboard always gets a parseable value.
 *
 * Environment variables:
 *   AVIATIONSTACK_API_KEY  — AviationStack access key (set via `wrangler secret put`)
 *   DELAY_OVERRIDE         — If set to a numeric string, bypass AviationStack and return
 *                            this value as the delay (useful for demo/testing when API quota
 *                            is exceeded). Example: wrangler secret put DELAY_OVERRIDE → "45"
 *
 * Request:
 *   GET https://<worker>.workers.dev?flight_iata=KE017
 *
 * Response (always 200):
 *   {"delay": <minutes>, "found": <bool>, "source": "aviationstack"|"override"}
 *   delay = actual departure delay minutes, or 0 if no flight data / no delay
 *   found = true if AviationStack returned at least one flight record, false otherwise
 *   source = data origin (Switchboard jsonParseTask reads only $.delay)
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      });
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const flightIata = url.searchParams.get("flight_iata");
    if (!flightIata) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: flight_iata" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // ── DELAY_OVERRIDE: demo/testing fallback when AviationStack quota is exceeded ──
    if (env.DELAY_OVERRIDE !== undefined && env.DELAY_OVERRIDE !== "") {
      const overrideDelay = parseInt(env.DELAY_OVERRIDE, 10);
      if (!isNaN(overrideDelay)) {
        return new Response(
          JSON.stringify({ delay: overrideDelay, found: true, source: "override" }),
          { status: 200, headers: JSON_HEADERS }
        );
      }
    }

    const apiKey = env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AVIATIONSTACK_API_KEY not configured" }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const upstream = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(flightIata)}`;

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstream);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }),
        { status: 502, headers: JSON_HEADERS }
      );
    }

    let aviationData;
    try {
      aviationData = await upstreamResponse.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON from upstream" }),
        { status: 502, headers: JSON_HEADERS }
      );
    }

    // Surface AviationStack API errors (quota exceeded, invalid key, etc.)
    if (aviationData.error) {
      return new Response(
        JSON.stringify({
          delay: 0,
          found: false,
          source: "aviationstack",
          aviationstack_error: aviationData.error,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    // Normalize: always return {"delay": N, "found": bool} so Switchboard jsonParseTask never fails
    // data[0].departure.delay is null when flight is on-time or not yet departed
    const flights = aviationData.data;
    const found = Array.isArray(flights) && flights.length > 0;
    const rawDelay = found ? flights[0]?.departure?.delay : null;
    const delay = typeof rawDelay === "number" ? rawDelay : 0;

    return new Response(JSON.stringify({ delay, found, source: "aviationstack" }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  },
};
