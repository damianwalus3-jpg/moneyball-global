interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ODDSPAPI_API_KEY?: string;
  STRIKERAPI_API_KEY?: string;
  ODDS_PILOT_TOKEN?: string;
}

const APP_ORIGIN = "https://moneyball-global-rebuild.damianwalus3.workers.dev";
const OPENLIGA_API = "https://api.openligadb.de";
const ODDSPAPI_API = "https://api.oddspapi.io";
const STRIKER_API = "https://mcp.strikerapi.com";
const UPSTREAM_TIMEOUT_MS = 10_000;

function corsHeaders(origin?: string | null): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  if (origin === APP_ORIGIN) headers.set("Access-Control-Allow-Origin", APP_ORIGIN);
  return headers;
}

function json(data: unknown, status = 200, origin?: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers });
}

function decimalOdds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const decimal = value > 0 ? 1 + value / 100 : value < 0 ? 1 + 100 / Math.abs(value) : null;
  return decimal !== null && Number.isFinite(decimal) && decimal > 1 ? Number(decimal.toFixed(4)) : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index++) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  try { return JSON.parse(text); } catch { throw new Error("upstream_invalid_json"); }
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      if (url.pathname.startsWith("/api/odds/") && origin && origin !== APP_ORIGIN) {
        return new Response(null, { status: 403, headers: corsHeaders(null) });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const oddsHealth = url.pathname === "/api/odds/status";
    const oddsPilot = url.pathname === "/api/odds/pilot";
    if (oddsHealth || oddsPilot) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      const configured = {
        oddspapi: Boolean(env.ODDSPAPI_API_KEY),
        strikerapi: Boolean(env.STRIKERAPI_API_KEY),
      };
      if (oddsHealth) {
        return json({
          providers: configured,
          pilotEnabled: typeof env.ODDS_PILOT_TOKEN === "string" && env.ODDS_PILOT_TOKEN.length >= 32,
          note: "Only configuration presence is reported; secrets are never returned.",
        }, 200, origin);
      }

      // Fail closed: provider credits cannot be consumed until an owner-only token is configured.
      if (typeof env.ODDS_PILOT_TOKEN !== "string" || env.ODDS_PILOT_TOKEN.length < 32) return json({ error: "pilot_disabled", message: "Configure an ODDS_PILOT_TOKEN with at least 32 characters in Cloudflare Worker secrets." }, 503, origin);
      const authorization = request.headers.get("Authorization") ?? "";
      const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!constantTimeEqual(suppliedToken, env.ODDS_PILOT_TOKEN)) return json({ error: "unauthorized" }, 401, origin);

      const fixtureId = url.searchParams.get("fixtureId")?.trim();
      const strikerGameId = url.searchParams.get("strikerGameId")?.trim();
      const strikerDate = url.searchParams.get("strikerDate")?.trim();
      if (!fixtureId && !strikerGameId && !strikerDate) return json({ error: "fixtureId, strikerGameId or strikerDate is required" }, 400, origin);
      if (strikerGameId && strikerDate) return json({ error: "use either strikerGameId or strikerDate, not both" }, 400, origin);
      if ((fixtureId && !/^[a-zA-Z0-9_-]{3,100}$/.test(fixtureId)) || (strikerGameId && !/^[a-zA-Z0-9_-]{1,40}$/.test(strikerGameId)) || (strikerDate && (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(strikerDate) || !Number.isFinite(Date.parse(`${strikerDate}T00:00:00Z`)) || new Date(`${strikerDate}T00:00:00Z`).toISOString().slice(0,10) !== strikerDate))) {
        return json({ error: "invalid_fixture_identifier" }, 400, origin);
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
            apiUrl.searchParams.set("apiKey", env.ODDSPAPI_API_KEY);
            const response = await fetch(apiUrl, {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            });
            const payload = await readJson(response);
            results.oddspapi = { status: "ok", capturedAt: new Date().toISOString(), data: payload };
          } catch (error) {
            results.oddspapi = { status: "error", error: error instanceof Error ? error.message : "upstream_error" };
          }
        }
      }
      if (strikerGameId || strikerDate) {
        if (!env.STRIKERAPI_API_KEY) results.strikerapi = { status: "not_configured" };
        else {
          try {
            const response = await fetch(`${STRIKER_API}/v1/get_odds`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": env.STRIKERAPI_API_KEY },
              body: JSON.stringify(strikerGameId ? { game_id: strikerGameId } : { date: strikerDate }),
              signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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
                  complete1X2: [book.home_ml_close, book.draw_ml_close, book.away_ml_close].every((value) => decimalOdds(value) !== null),
                })),
              };
            });
            results.strikerapi = { status: "ok", lookup: strikerGameId ? "game" : "utc_date", capturedAt: new Date().toISOString(), games: normalized };
          } catch (error) {
            results.strikerapi = { status: "error", error: error instanceof Error ? error.message : "upstream_error" };
          }
        }
      }
      return json({
        mode: "provider-pilot",
        results,
        warning: "StrikerAPI date lookups use UTC; convert startsAt to Europe/Brussels before matching. Provider IDs must be matched independently. This endpoint does not write odds to Tracker or P/L.",
      }, 200, origin);
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

      const upstream = await fetch(`${OPENLIGA_API}${upstreamPath}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const headers = new Headers(upstream.headers);
      headers.set("Cache-Control", matches ? "public, max-age=900" : "public, max-age=28800");
      headers.set("X-MONEYBALL-SOURCE", "OpenLigaDB");
      const allowedCors = corsHeaders(origin);
      const allowOrigin = allowedCors.get("Access-Control-Allow-Origin");
      if (allowOrigin) headers.set("Access-Control-Allow-Origin", allowOrigin);
      else headers.delete("Access-Control-Allow-Origin");
      headers.set("Vary", "Origin");
      const response = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
      if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    return env.ASSETS.fetch(request);
  },
};
