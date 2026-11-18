interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ODDSPAPI_API_KEY?: string;
  STRIKERAPI_API_KEY?: string;
  ODDS_PILOT_TOKEN?: string;
}

const APP_ORIGIN = "https://moneyball-global-rebuild.damianwalus3.workers.dev";
const OPENLIGA_API = "https://api.openligadb.de";
const ESPN_API = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";
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


const FOOTYNOMAD_COUNTRIES: Record<string, string> = {
  albania: "ALB", andorra: "AND", armenia: "ARM", austria: "AUT", azerbaijan: "AZE", belarus: "BLR",
  belgium: "BEL", bosnia: "BIH", "bosnia and herzegovina": "BIH", bulgaria: "BUL", croatia: "CRO",
  cyprus: "CYP", "czech republic": "CZE", czechia: "CZE", denmark: "DEN", england: "ENG",
  estonia: "EST", "faroe islands": "FRO", finland: "FIN", france: "FRA", georgia: "GEO",
  germany: "GER", gibraltar: "GIB", greece: "GRE", hungary: "HUN", iceland: "ISL", ireland: "IRE", "republic of ireland": "IRE", kazakhstan: "KAZ",
  italy: "ITA", israel: "ISR", kosovo: "KOS", latvia: "LVA", liechtenstein: "LIE", lithuania: "LTU",
  luxembourg: "LUX", malta: "MLT", moldova: "MDA", monaco: "MCO", montenegro: "MNE",
  netherlands: "NED", "north macedonia": "MKD", "northern ireland": "NIR", norway: "NOR",
  poland: "POL", portugal: "POR", romania: "ROU", russia: "RUS", "san marino": "SMR",
  scotland: "SCO", serbia: "SRB", slovakia: "SVK", slovenia: "SVN", spain: "ESP",
  sweden: "SWE", switzerland: "SUI", turkey: "TUR", turkiye: "TUR", ukraine: "UKR", wales: "WAL",
};
function footyHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ").trim();
}
export function parseFootyNomadFixtures(html: string, targetDate: string): { fixtures: Array<Record<string, unknown>>; pageMatches: number; skippedNoTimestamp: number } {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const fixtures: Array<Record<string, unknown>> = [];
  let pageMatches = 0;
  let skippedNoTimestamp = 0;
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const country = footyHtmlText(heading[1]).replace(/\s+\d+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const countryCode = FOOTYNOMAD_COUNTRIES[country];
    const sectionStart = (heading.index ?? 0) + heading[0].length;
    const sectionEnd = index + 1 < headings.length ? (headings[index + 1].index ?? html.length) : html.length;
    const section = html.slice(sectionStart, sectionEnd);
    const leagueBlocks = [...section.matchAll(/<details\b[^>]*class="[^"]*league-group[^"]*"[^>]*>([\s\S]*?)<\/details>/gi)];
    for (const leagueBlock of leagueBlocks) {
      const block = leagueBlock[1];
      const competition = footyHtmlText(block.match(/<a\b[^>]*href="\/league\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
      // World is a mixed global section: exclude other confederations before allowing UEFA events.
      const isNonUefaConfederation = /\b(?:CONCACAF|CONMEBOL|AFC|CAF|OFC)\b/i.test(competition);
      if (isNonUefaConfederation) continue;
      const isUefaWorldCompetition = /\bUEFA\b|European Championship|\bUEFA\s+Nations League\b/i.test(competition);
      if (!countryCode && !(country === "world" && isUefaWorldCompetition)) continue;
      const resolvedCountryCode = countryCode ?? "UEFA";
      const matches = [...block.matchAll(/<a\b[^>]*href="\/fixture\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      pageMatches += matches.length;
      for (const match of matches) {
        const card = match[2];
        const kickoff = card.match(/<time\b[^>]*datetime="([^"]+)"/i)?.[1];
        if (!kickoff || !Number.isFinite(Date.parse(kickoff))) {
          skippedNoTimestamp++;
          continue;
        }
        const local = new Date(kickoff);
        const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(local);
        const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
        const localDate = get("year") + "-" + get("month") + "-" + get("day");
        if (localDate !== targetDate) continue;
        const home = footyHtmlText(card.match(/<span\b[^>]*class="ticket-home"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
        const away = footyHtmlText(card.match(/<span\b[^>]*class="ticket-away(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
        if (!home || !away) continue;
        const statusText = footyHtmlText(card.match(/<small\b[^>]*class="ticket-sub"[^>]*>([\s\S]*?)<\/small>/i)?.[1] ?? "").toLowerCase();
        const cardClass = match[0].match(/\bclass="([^"]+)"/i)?.[1] ?? "";
        const status = /cancelled|abandoned/.test(statusText) ? "cancelled"
          : /postponed/.test(statusText) ? "postponed"
          : /live|^\d+['′]/.test(statusText) || /ticket-live/.test(cardClass) ? "live"
          : /full time|finished|ft/.test(statusText) ? "finished" : "scheduled";
        const id = match[1].split("-")[0];
        fixtures.push({
          id: "footynomad|" + id,
          providerId: id,
          competition: competition || "FootyNomad",
          countryCode: resolvedCountryCode,
          leagueFolder: "",
          leagueShortcut: /(?:UEFA\s+)?Nations\s+League/i.test(competition) ? "nla" : undefined,
          leagueSeason: /(?:UEFA\s+)?Nations\s+League/i.test(competition) ? targetDate.slice(0, 4) : undefined,
          date: localDate,
          time: get("hour") + ":" + get("minute"),
          home,
          away,
          status,
          source: "FootyNomad",
          sourceUpdatedAt: new Date().toISOString(),
        });
      }
    }
  }
  return { fixtures, pageMatches, skippedNoTimestamp };
}
const FLASH_SCORE_STATUS: Record<string, string> = { "1": "scheduled", "2": "live", "3": "finished" };
function flashscoreBrusselsParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return { date: get("year") + "-" + get("month") + "-" + get("day"), time: get("hour") + ":" + get("minute") };
}
export function parseFlashscoreFixtures(feed: string, targetDate: string): { fixtures: Array<Record<string, unknown>>; competitionsChecked: number; rawMatches: number; skippedNonEuropean: number; skippedWrongDate: number; timestampMissing: number } {
  if (!feed || !feed.includes("÷") || !feed.includes("~")) throw new Error("Flashscore: nieprawidłowy lub pusty feed");
  const records = feed.split("~").filter(Boolean).map(record => Object.fromEntries(
    record.split("¬").map(pair => {
      const separator = pair.indexOf("÷");
      return separator < 0 ? [pair, ""] : [pair.slice(0, separator), pair.slice(separator + 1)];
    }),
  ));
  let competition: { name: string; country: string; url: string } | null = null;
  const fixtures: Array<Record<string, unknown>> = [];
  const countryCodes = FOOTYNOMAD_COUNTRIES;
  let competitionsChecked = 0, rawMatches = 0, skippedNonEuropean = 0, skippedWrongDate = 0, timestampMissing = 0;
  for (const record of records) {
    if (record.ZA) {
      const display = String(record.ZA);
      const separator = display.indexOf(":");
      competition = {
        name: separator >= 0 ? display.slice(separator + 1).trim() : display,
        country: String(record.ZY || record.ZAF || (separator >= 0 ? display.slice(0, separator).trim() : "")),
        url: String(record.ZL || ""),
      };
      competitionsChecked++;
      continue;
    }
    if (!record.AA) continue;
    rawMatches++;
    const country = (competition?.country || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const name = competition?.name || "";
    if (/\b(?:CONCACAF|CONMEBOL|AFC|CAF|OFC)\b/i.test(name)) { skippedNonEuropean++; continue; }
    const countryCode = countryCodes[country];
    const worldCompetition = (country === "europe" || country === "world")
      && (/\bUEFA\b|European Championship|European Qualifiers/i.test(name)
        || (country === "europe" && /\b(?:Champions League|Europa League|Conference League)\b/i.test(name)));
    if (!countryCode && !worldCompetition) { skippedNonEuropean++; continue; }
    if (!record.AD || !Number.isFinite(Number(record.AD))) { timestampMissing++; continue; }
    const kickoff = flashscoreBrusselsParts(new Date(Number(record.AD) * 1000));
    if (kickoff.date !== targetDate) { skippedWrongDate++; continue; }
    const home = String(record.AE || "").trim();
    const away = String(record.AF || "").trim();
    if (!home || !away) continue;
    const isNationsLeague = /\bUEFA\s+Nations League\b/i.test(name);
    fixtures.push({
      id: "flashscore|" + String(record.AA),
      competition: name || "Flashscore",
      countryCode: countryCode || "UEFA",
      leagueFolder: "",
      leagueShortcut: isNationsLeague ? "nla" : undefined,
      leagueSeason: isNationsLeague ? targetDate.slice(0, 4) : undefined,
      date: kickoff.date,
      time: kickoff.time,
      home,
      away,
      status: FLASH_SCORE_STATUS[String(record.AB)] || "unknown",
      source: "Flashscore",
      sourceUpdatedAt: new Date().toISOString(),
      sourceUrl: "https://www.flashscore.com/match/" + String(record.AA) + "/",
    });
  }
  return { fixtures, competitionsChecked, rawMatches, skippedNonEuropean, skippedWrongDate, timestampMissing };
}

function previousUtcDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 86400000).toISOString().slice(0, 10);
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

    const flashscoreFixtures = url.pathname.match(/^\/api\/flashscore\/fixtures\/(\d{4}-\d{2}-\d{2})$/);
    if (flashscoreFixtures) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      const date = flashscoreFixtures[1];
      const year = Number(date.slice(0,4)), month = Number(date.slice(5,7)), day = Number(date.slice(8,10));
      const parsedDate = new Date(Date.UTC(year, month - 1, day));
      if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) return json({ error: "invalid_date" }, 400, origin);
      const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const currentDate = ["year", "month", "day"].map(key => dateParts.find(part => part.type === key)?.value ?? "").join("-");
      if (date !== currentDate) return json({ error: "flashscore_feed_supports_brussels_today_only", currentDate }, 400, origin);
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cache = (globalThis as unknown as { caches: { default: Cache } }).caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const zoneName = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Brussels", timeZoneName: "shortOffset" }).formatToParts(new Date()).find(part => part.type === "timeZoneName")?.value ?? "GMT+1";
        const timezoneOffset = Number(zoneName.replace(/^GMT/, "")) || 0;
        const feedUrl = "https://global.flashscore.ninja/2/x/feed/f_1_0_" + timezoneOffset + "_en_1";
        const upstream = await fetch(feedUrl, {
          headers: {
            Accept: "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.flashscore.com/",
            Origin: "https://www.flashscore.com",
            "x-fsign": "SW9D1eZo",
          },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        const feed = await upstream.text();
        if (!upstream.ok) return json({ error: "flashscore_upstream_http_" + upstream.status }, 502, origin);
        const result = parseFlashscoreFixtures(feed, date);
        const headers = corsHeaders(origin);
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=900");
        headers.set("X-MONEYBALL-SOURCE", "Flashscore");
        const response = new Response(JSON.stringify({ date, ...result, source: "Flashscore", timezoneOffset }), { status: 200, headers });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "flashscore_upstream_error" }, 502, origin);
      }
    }

    // Temporary read-only probe for testing whether the free Flashscore public feed
    // is reachable from Cloudflare Workers without a paid scraper or TLS impersonation.
    if (url.pathname === "/api/flashscore/probe") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      try {
        const headers = {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        };
        const homepage = await fetch("https://www.flashscore.com/football/", { headers, redirect: "follow", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
        const html = await homepage.text();
        const signature = html.match(/feed_sign\s*[:=]\s*["']([^"']+)["']/i)?.[1] || "SW9D1eZo";
        const feed = await fetch("https://global.flashscore.ninja/2/x/feed/f_1_0_1_en_1", {
          headers: {
            Accept: "*/*",
            "User-Agent": headers["User-Agent"],
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.flashscore.com/",
            Origin: "https://www.flashscore.com",
            "x-fsign": signature,
          },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        const body = await feed.text();
        const records = body.split("~").filter(Boolean).map(record => Object.fromEntries(
          record.split("¬").map(pair => {
            const separator = pair.indexOf("÷");
            return separator < 0 ? [pair, ""] : [pair.slice(0, separator), pair.slice(separator + 1)];
          }),
        ));
        let competition: { name: string; country: string; url: string } | null = null;
        const competitions: Array<{ name: string; country: string; url: string }> = [];
        const countryCounts: Record<string, number> = {};
        const matchSamples: Array<{ id: string; kickoff: string; home: string; away: string; status: string; competition: string; country: string }> = [];
        let matchCount = 0;
        let timestampMissing = 0;
        for (const record of records) {
          if (record.ZA) {
            const display = record.ZA;
            const split = display.indexOf(":");
            competition = {
              name: split >= 0 ? display.slice(split + 1).trim() : display,
              country: record.ZY || record.ZAF || (split >= 0 ? display.slice(0, split).trim() : ""),
              url: record.ZL || "",
            };
            competitions.push(competition);
          } else if (record.AA) {
            matchCount++;
            if (!record.AD || !Number.isFinite(Number(record.AD))) { timestampMissing++; continue; }
            const country = competition?.country || "Unknown";
            countryCounts[country] = (countryCounts[country] || 0) + 1;
            if (matchSamples.length < 25) matchSamples.push({
              id: record.AA,
              kickoff: new Date(Number(record.AD) * 1000).toISOString(),
              home: record.AE || "",
              away: record.AF || "",
              status: record.AB || "",
              competition: competition?.name || "",
              country,
            });
          }
        }
        return json({
          homepageStatus: homepage.status,
          homepageUrl: homepage.url,
          signatureFound: /feed_sign\s*[:=]/i.test(html),
          feedStatus: feed.status,
          feedLength: body.length,
          recordCount: records.length,
          competitionCount: competitions.length,
          matchCount,
          timestampMissing,
          countryCounts,
          competitions,
          matchSamples,
        }, 200, origin);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "flashscore_probe_failed" }, 502, origin);
      }
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

    const espnTeamForm = url.pathname === "/api/espn/team-form";
    if (espnTeamForm) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      const teamQuery = (url.searchParams.get("team") ?? "").trim();
      const before = url.searchParams.get("before") ?? "";
      if (teamQuery.length < 2 || teamQuery.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(before)) return json({ error: "invalid_team_or_date" }, 400, origin);
      const year = Number(before.slice(0,4)), month = Number(before.slice(5,7)), day = Number(before.slice(8,10));
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return json({ error: "invalid_date" }, 400, origin);
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cache = (globalThis as unknown as { caches: { default: Cache } }).caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const searchUrl = "https://site.api.espn.com/apis/common/v3/search?query=" + encodeURIComponent(teamQuery) + "&limit=10&type=team";
        const searchResponse = await fetch(searchUrl, { headers: { Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", Referer: "https://www.espn.com/soccer/scoreboard", Origin: "https://www.espn.com" }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
        if (!searchResponse.ok) throw new Error("espn_team_search_http_" + searchResponse.status);
        const searchPayload = await searchResponse.json() as { items?: Array<{ id?: string; displayName?: string; name?: string; sport?: string; defaultLeagueSlug?: string }> };
        const allowedLeaguePrefixes = ["uefa.", "eng.", "esp.", "ger.", "ita.", "fra.", "ned.", "por.", "bel.", "sco.", "aut.", "sui.", "gre.", "tur.", "pol.", "ukr.", "cro.", "srb.", "den.", "nor.", "swe.", "fin.", "cze.", "rou.", "bul.", "hun.", "irl.", "wal.", "isl.", "lux.", "mlt.", "cyp.", "kaz.", "aze.", "arm.", "geo.", "alb.", "mkd.", "mda.", "est.", "lat.", "ltu.", "blr.", "bih.", "svn.", "svk.", "and.", "lie.", "faro.", "nirl.", "uefa"];
        const candidates = (searchPayload.items ?? []).filter(item => item.sport === "soccer" && item.id && (item.displayName || item.name) && item.defaultLeagueSlug && allowedLeaguePrefixes.some(prefix => item.defaultLeagueSlug!.startsWith(prefix)));
        const exact = candidates.filter(item => normalize(item.displayName ?? item.name ?? "") === normalize(teamQuery));
        const selected = exact[0];
        if (!selected?.id || !selected.defaultLeagueSlug) return json({ error: "espn_team_not_found", team: teamQuery }, 404, origin);
        const scheduleUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer/" + encodeURIComponent(selected.defaultLeagueSlug) + "/teams/" + encodeURIComponent(selected.id) + "/schedule";
        const scheduleResponse = await fetch(scheduleUrl, { headers: { Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", Referer: "https://www.espn.com/soccer/scoreboard", Origin: "https://www.espn.com" }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
        if (!scheduleResponse.ok) throw new Error("espn_team_schedule_http_" + scheduleResponse.status);
        type EspnScheduleCompetitor = { homeAway?: string; team?: { displayName?: string; name?: string }; score?: { value?: number; displayValue?: string } | string };
        type EspnScheduleEvent = { id?: string; date?: string; competitions?: Array<{ competitors?: EspnScheduleCompetitor[]; status?: { type?: { completed?: boolean } } }> };
        const schedule = await scheduleResponse.json() as { timestamp?: string; events?: EspnScheduleEvent[] };
        const events = (schedule.events ?? []).flatMap(event => {
          const competition = event.competitions?.[0];
          if (!event.date || !competition?.status?.type?.completed) return [];
          const kickoff = new Date(event.date);
          if (!Number.isFinite(kickoff.getTime())) return [];
          const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(kickoff);
          const get = (key: string) => dateParts.find(part => part.type === key)?.value ?? "";
          const localDate = get("year") + "-" + get("month") + "-" + get("day");
          if (localDate >= before) return [];
          const competitors = competition.competitors ?? [];
          const home = competitors.find(item => item.homeAway === "home");
          const away = competitors.find(item => item.homeAway === "away");
          if (!home || !away) return [];
          const score = (item: EspnScheduleCompetitor): number => {
            const raw = typeof item.score === "object" && item.score ? Number(item.score.value) : typeof item.score === "string" ? Number(item.score) : NaN;
            return Number.isFinite(raw) ? raw : Number(typeof item.score === "object" && item.score ? item.score.displayValue : NaN);
          };
          const homeGoals = score(home), awayGoals = score(away);
          if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) return [];
          const teamName = selected.displayName ?? selected.name ?? teamQuery;
          const isHome = normalize(home.team?.displayName ?? home.team?.name ?? "") === normalize(teamName);
          const isAway = normalize(away.team?.displayName ?? away.team?.name ?? "") === normalize(teamName);
          if (!isHome && !isAway) return [];
          return [{ id: event.id ?? "", date: localDate, opponent: isHome ? away.team?.displayName ?? away.team?.name ?? "" : home.team?.displayName ?? home.team?.name ?? "", venue: isHome ? "H" : "A", goalsFor: isHome ? homeGoals : awayGoals, goalsAgainst: isHome ? awayGoals : homeGoals }];
        }).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10);
        const headers = corsHeaders(origin);
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=21600");
        headers.set("X-MONEYBALL-SOURCE", "ESPN team schedule");
        const response = new Response(JSON.stringify({ team: selected.displayName ?? selected.name ?? teamQuery, teamId: selected.id, league: selected.defaultLeagueSlug, generatedAt: schedule.timestamp ?? new Date().toISOString(), matches: events }), { status: 200, headers });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "espn_team_form_error" }, 502, origin);
      }
    }

    const espnScoreboard = url.pathname.match(/^\/api\/espn\/scoreboard\/(\d{8})$/);
    if (espnScoreboard) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      const date = espnScoreboard[1];
      const year = Number(date.slice(0,4)), month = Number(date.slice(4,6)), day = Number(date.slice(6,8));
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return json({ error: "invalid_date" }, 400, origin);
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cache = (globalThis as unknown as { caches: { default: Cache } }).caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const upstream = await fetch(`${ESPN_API}?dates=${date}&limit=1000`, { headers: { Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", Referer: "https://www.espn.com/soccer/scoreboard", Origin: "https://www.espn.com" }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
        const body = await upstream.text();
        if (!upstream.ok) return json({ error: "espn_upstream_http_" + upstream.status }, upstream.status, origin);
        try { JSON.parse(body); } catch { return json({ error: "espn_invalid_json" }, 502, origin); }
        const headers = corsHeaders(origin);
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=300");
        headers.set("X-MONEYBALL-SOURCE", "ESPN");
        const response = new Response(body, { status: 200, headers });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "espn_upstream_error" }, 502, origin);
      }
    }


    const footyNomadFixtures = url.pathname.match(/^\/api\/footynomad\/fixtures\/(\d{4}-\d{2}-\d{2})$/);
    if (footyNomadFixtures) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);
      const date = footyNomadFixtures[1];
      const year = Number(date.slice(0,4)), month = Number(date.slice(5,7)), day = Number(date.slice(8,10));
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return json({ error: "invalid_date" }, 400, origin);
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cache = (globalThis as unknown as { caches: { default: Cache } }).caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      try {
        const pageDates = [previousUtcDate(date), date];
        const pages = await Promise.all(pageDates.map(async pageDate => {
          const upstream = await fetch("https://footynomad.com/fixtures/" + pageDate, {
            headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Mozilla/5.0 (compatible; MONEYBALL-REBUILD/1.0; +https://moneyball-global-rebuild.damianwalus3.workers.dev)" },
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          });
          const html = await upstream.text();
          if (!upstream.ok) throw new Error("footynomad_upstream_http_" + upstream.status + " for " + pageDate);
          if (!html.includes("/fixture/") || !html.includes("<h1")) throw new Error("footynomad_invalid_html for " + pageDate);
          return parseFootyNomadFixtures(html, date);
        }));
        const byId = new Map<string, Record<string, unknown>>();
        for (const page of pages) for (const fixture of page.fixtures) byId.set(String(fixture.id), fixture);
        const headers = corsHeaders(origin);
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Cache-Control", "public, max-age=900");
        headers.set("X-MONEYBALL-SOURCE", "FootyNomad");
        const response = new Response(JSON.stringify({
          date, fixtures: [...byId.values()].sort((a,b) => String(a.time).localeCompare(String(b.time))),
          pagesRequested: pageDates.length, pagesChecked: pages.length,
          pageMatches: pages.reduce((sum, page) => sum + page.pageMatches, 0),
          skippedNoTimestamp: pages.reduce((sum, page) => sum + page.skippedNoTimestamp, 0),
          errors: [],
        }), { status: 200, headers });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "footynomad_upstream_error" }, 502, origin);
      }
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
      headers.set("Cache-Control", matches ? "public, max-age=3600" : "public, max-age=28800");
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
