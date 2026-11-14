import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://xwrgfaarmwnguymresjy.supabase.co";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_E27tyjResjElwC4AWbmILw_wbtibXhX";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIKER_API_KEY = Deno.env.get("STRIKER_API_KEY") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
let requestBearer = "";
let requestCronToken = "";

function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function norm(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/\b(fc|cf|sc|afc|club|football|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function americanToDecimal(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  const result = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  return Number.isFinite(result) && result > 1 && result < 1000 ? Number(result.toFixed(3)) : null;
}
async function db(path: string, method = "GET", body?: unknown, prefer = "return=representation") {
  const bearer = requestBearer;
  if (!ANON_KEY || !bearer) throw new Error("Supabase authorization missing");
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: "Bearer " + bearer,
      ...(requestCronToken ? { "x-cron-token": requestCronToken } : {}),
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error("Supabase " + response.status + ": " + (data?.message || raw));
  return data;
}
async function authenticate(req: Request, body: any): Promise<string> {
  const cronToken = req.headers.get("x-cron-token") || "";
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (cronToken) {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/moneyball_cron_token_valid", {
      method: "POST",
      headers: { apikey: SERVICE_KEY || ANON_KEY, Authorization: "Bearer " + (SERVICE_KEY || bearer || ANON_KEY), "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: cronToken }),
    });
    if (!response.ok || (await response.json()) !== true) throw new Error("Invalid scheduled-task token");
    requestBearer = bearer || ANON_KEY;
    requestCronToken = cronToken;
    const ownerId = String(body.owner_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("Missing valid owner_id for scheduled sync");
    return ownerId;
  }
  if (!bearer) throw new Error("Login required");
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: ANON_KEY, Authorization: "Bearer " + bearer },
  });
  if (!response.ok) throw new Error("Invalid login session");
  const user = await response.json();
  if (typeof user.id !== "string") throw new Error("Cannot identify account");
  requestBearer = bearer;
  requestCronToken = "";
  return user.id;
}
function matchDate(value: unknown) {
  const stamp = Date.parse(String(value || ""));
  return Number.isFinite(stamp) ? stamp : NaN;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    let body: any = {};
    if (req.method === "POST") body = await req.json().catch(() => ({}));
    const ownerId = await authenticate(req, body);

    // The free StrikerAPI key is optional. No requests or credits are consumed until it is configured.
    if (!STRIKER_API_KEY) {
      return out({ ok: true, skipped: true, configured: false, provider: "StrikerAPI", reason: "STRIKER_API_KEY is not configured; no API call was made." });
    }

    const days = 4; // StrikerAPI documents hourly odds refreshes for the next four days.
    const apiResponse = await fetch("https://mcp.strikerapi.com/v1/get_schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": STRIKER_API_KEY },
      body: JSON.stringify({ days, league: "soccer" }),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await apiResponse.text();
    let payload: any;
    try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new Error("StrikerAPI returned invalid JSON"); }
    if (!apiResponse.ok) {
      const detail = payload?.error || payload?.message || ("HTTP " + apiResponse.status);
      if (apiResponse.status === 402) throw new Error("StrikerAPI free monthly credits exhausted: " + detail);
      throw new Error("StrikerAPI " + apiResponse.status + ": " + detail);
    }
    const data = payload?.data || payload;
    const games = Array.isArray(data?.games) ? data.games : [];
    const now = new Date();
    const nowMs = now.getTime();
    const until = nowMs + days * 24 * 60 * 60 * 1000;
    const isoNow = now.toISOString();

    const matches = await db(
      "matches?select=id,owner_id,external_id,source,home_team,away_team,kickoff_at,kickoff_date,status,competition,league,country" +
      "&owner_id=eq." + encodeURIComponent(ownerId) +
      "&kickoff_at=gte." + encodeURIComponent(isoNow) +
      "&kickoff_at=lte." + encodeURIComponent(new Date(until).toISOString()) +
      "&status=in.(scheduled,unknown)&order=kickoff_at.asc&limit=1000",
    );
    const byTeams = new Map<string, any[]>();
    for (const match of matches || []) {
      const key = norm(match.home_team) + "|" + norm(match.away_team);
      const rows = byTeams.get(key) || [];
      rows.push(match);
      byTeams.set(key, rows);
    }

    const oddsRows: any[] = [];
    let gamesWithLines = 0, matchesMapped = 0, unmatched = 0, staleOrInvalid = 0;
    for (const game of games) {
      const start = matchDate(game?.starts_at);
      if (!Number.isFinite(start) || start <= nowMs || start > until) continue;
      const line = game?.line;
      if (!line || Number(line.books || 0) < 1) { staleOrInvalid++; continue; }
      const home = norm(game?.home?.name), away = norm(game?.away?.name);
      if (!home || !away) { unmatched++; continue; }
      const candidates = byTeams.get(home + "|" + away) || [];
      const close = candidates.filter((m: any) => {
        const kickoff = matchDate(m.kickoff_at);
        return Number.isFinite(kickoff) && Math.abs(kickoff - start) <= 6 * 60 * 60 * 1000;
      });
      if (close.length !== 1) { unmatched++; continue; }
      const match = close[0];
      const selections = [
        { id: "home", label: "Gospodarze", side: "home", mapped: "1", price: americanToDecimal(line.home_ml) },
        { id: "draw", label: "Remis", side: "draw", mapped: "X", price: americanToDecimal(line.draw_ml) },
        { id: "away", label: "Goście", side: "away", mapped: "2", price: americanToDecimal(line.away_ml) },
      ];
      const valid = selections.filter((x: any) => x.price !== null);
      if (valid.length !== 3) { staleOrInvalid++; continue; }
      gamesWithLines++;
      matchesMapped++;
      for (const selection of valid) {
        oddsRows.push({
          owner_id: ownerId,
          match_id: match.id,
          provider: "StrikerAPI",
          provider_fixture_id: String(game.game_id),
          bookmaker: "StrikerAPI median",
          sport: "soccer",
          market_group_id: "moneyline",
          market_id: "1x2",
          market_name: "Wynik meczu 1X2 — mediana bukmacherów",
          selection_id: selection.id,
          selection_label: selection.label,
          selection_side: selection.side,
          odds: selection.price,
          suspended: false,
          phase: "prematch",
          price_timestamp: isoNow,
          provider_polled_at: isoNow,
          captured_at: isoNow,
          raw_quote: { provider: "StrikerAPI", provider_game_id: String(game.game_id), books: Number(line.books), american_price: line[selection.side + "_ml"], fetched_at: isoNow, source: "get_schedule", raw_line: line },
          mapped_market: "1X2",
          mapped_selection: selection.mapped,
        });
      }
    }

    for (let i = 0; i < oddsRows.length; i += 100) {
      await db(
        "provider_odds?on_conflict=provider,provider_fixture_id,market_group_id,market_id,selection_id",
        "POST",
        oddsRows.slice(i, i + 100),
        "resolution=merge-duplicates,return=minimal",
      );
    }

    return out({
      ok: true,
      configured: true,
      provider: "StrikerAPI",
      fetched_at: isoNow,
      request_cost_credits: 2,
      monthly_free_credits: 500,
      days,
      games_returned: games.length,
      games_with_lines: gamesWithLines,
      matches_mapped: matchesMapped,
      odds_rows_upserted: oddsRows.length,
      unmatched_games: unmatched,
      skipped_invalid_or_missing_lines: staleOrInvalid,
      note: "Prices are median pre-match 1X2 odds across reported sportsbooks, not a guaranteed Bwin quote. The endpoint's documented odds refresh is hourly for fixtures within four days.",
    });
  } catch (error) {
    const message = String(error);
    const status = /login|unauthorized|invalid scheduled|owner_id/i.test(message) ? 401 : 502;
    return out({ ok: false, error: message }, status);
  }
});
