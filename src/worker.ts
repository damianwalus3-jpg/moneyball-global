interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ODDSPAPI_API_KEY?: string;
  STRIKERAPI_API_KEY?: string;
}

const OPENLIGA_API = "https://api.openligadb.de";
const ODDSPAPI_API = "https://api.oddspapi.io";
const STRIKER_API = "https://mcp.strikerapi.com";

function json(data: unknown, status = 200, origin = "*"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

function decimalOdds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const decimal = value > 0 ? 1 + value / 100 : value < 0 ? 1 + 100 / Math.abs(value) : null;
  return decimal !== null && Number.isFinite(decimal) && decimal > 1 ? Number(decimal.toFixed(4)) : null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  try { return JSON.parse(text); } catch { throw new Error("upstream_invalid_json"); }
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": url.origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    } });

    const oddsHealth = url.pathname === "/api/odds/status";
    const oddsPilot = url.pathname === "/api/odds/pilot";
    if (oddsHealth || oddsPilot) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, url.origin);
      const configured = { oddspapi: Boolean(env.ODDSPAPI_API_KEY), strikerapi: Boolean(env.STRIKERAPI_API_KEY) };
      if (oddsHealth) return json({ providers: configured, note: "Only configuration presence is reported; secrets are never returned." }, 200, url.origin);

      const fixtureId = url.searchParams.get("fixtureId")?.trim();
      const strikerGameId = url.searchParams.get("strikerGameId")?.trim();
      if (!fixtureId && !strikerGameId) return json({ error: "fixtureId or strikerGameId is required" }, 400, url.origin);
      if ((fixtureId && !/^[a-zA-Z0-9_-]{3,100}$/.test(fixtureId)) || (strikerGameId && !/^[a-zA-Z0-9_-]{1,40}$/.test(strikerGameId))) {
        return json({ error: "invalid_fixture_identifier" }, 400, url.origin);
      }

      const results: Record<string, unknown> = {};
      if (fixtureId) {
        if (!env.ODDSPAPI_API_KEY) results.oddspapi = { status: "not_configured" };
        else {
          try {
            const apiUrl = new URL("/v4/odds", ODDSPAPI_API);
            apiUrl.searchParams.set("fixtureId", fixtureId);
            apiUrl.searchParams.set("language", "en");
            apiUrl.searchParams.set("verbosity", "3");
            const response = await fetch(apiUrl, { headers: { Accept: "application/json", "x-api-key": env.ODDSPAPI_API_KEY } });
            const payload = await readJson(response);
            results.oddspapi = { status: "ok", capturedAt: new Date().toISOString(), data: payload };
          } catch (error) {
            results.oddspapi = { status: "error", error: error instanceof Error ? error.message : "upstream_error" };
          }
        }
      }
      if (strikerGameId) {
        if (!env.STRIKERAPI_API_KEY) results.strikerapi = { status: "not_configured" };
        else {
          try {
            const response = await fetch(`${STRIKER_API}/v1/get_odds`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": env.STRIKERAPI_API_KEY },
              body: JSON.stringify({ game_id: strikerGameId }),
            });
            const payload = await readJson(response) as { data?: { games?: Array<Record<string, unknown>> }; games?: Array<Record<string, unknown>> };
            const games = payload && typeof payload === "object" ? (payload.data?.games ?? payload.games ?? []) : [];
            const normalized = games.map((game) => {
              const books = Array.isArray(game.books) ? game.books as Array<Record<string, unknown>> : [];
              return {
                gameId: game.game_id,
                home: (game.home as { name?: string } | undefined)?.name ?? null,
                away: (game.away as { name?: string } | undefined)?.name ?? null,
                startsAt: game.starts_at ?? null,
                bookmakers: books.map((book) => ({
                  name: book.provider ?? null,
                  source: book.source ?? null,
                  capturedAt: book.captured_at ?? null,
                  odds1: decimalOdds(book.home_ml_close),
                  oddsX: decimalOdds(book.draw_ml_close),
                  odds2: decimalOdds(book.away_ml_close),
                  complete1X2: [book.home_ml_close, book.draw_ml_close, book.away_ml_close].every((v) => decimalOdds(v) !== null),
                })),
              };
            });
            results.strikerapi = { status: "ok", capturedAt: new Date().toISOString(), games: normalized };
          } catch (error) {
            results.strikerapi = { status: "error", error: error instanceof Error ? error.message : "upstream_error" };
          }
        }
      }
      return json({ mode: "provider-pilot", results, warning: "Provider IDs must be matched to the same fixture independently. This endpoint does not write odds to Tracker or P/L." }, 200, url.origin);
    }

    const leagues = url.pathname.match(/^\/api\/openligadb\/leagues\/(\d{4})$/);
    const matches = url.pathname.match(/^\/api\/openligadb\/matches\/((?:[a-z0-9._-]|%[0-9a-f]{2})+)\/(\d{4})$/i);
    const teamMatches = url.pathname.match(/^\/api\/openligadb\/team-matches\/((?:[a-z0-9._-]|%[0-9a-f]{2})+)\/(\d{4})\/([^/]+)$/i);

    if (leagues || matches || teamMatches) {
      const upstreamPath = leagues
        ? `/getavailableleagues/${leagues[1]}`
        : teamMatches
          ? `/getmatchdata/${encodeURIComponent(decodeURIComponent(teamMatches[1]))}/${teamMatches[2]}/${encodeURIComponent(decodeURIComponent(teamMatches[3]))}`
          : `/getmatchdata/${encodeURIComponent(decodeURIComponent(matches![1]))}/${matches![2]}`;
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cache = (globalThis as unknown as { caches: { default: Cache } }).caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const upstream = await fetch(`${OPENLIGA_API}${upstreamPath}`, { headers: { Accept: "application/json" } });
      const headers = new Headers(upstream.headers);
      headers.set("Cache-Control", matches ? "public, max-age=900" : "public, max-age=28800");
      headers.set("X-MONEYBALL-SOURCE", "OpenLigaDB");
      headers.set("Access-Control-Allow-Origin", url.origin);
      const response = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
      if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
