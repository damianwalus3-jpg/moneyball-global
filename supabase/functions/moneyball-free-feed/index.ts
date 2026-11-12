import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "https://gzgeklcukrclgwbsmbsp.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}



const EUROPE_ISO3 = new Set(["ALB","AND","ARM","AUT","AZE","BLR","BEL","BIH","BUL","CRO","CYP","CZE","DNK","ENG","EST","FRO","FIN","FRA","GEO","DEU","GER","GIB","GRC","GRE","HUN","ISL","IRL","ITA","KAZ","KOS","LVA","LIE","LTU","LUX","MLT","MDA","MNE","NLD","MKD","NIR","NOR","POL","PRT","POR","ROU","RUS","SMR","SCO","SRB","SVK","SVN","ESP","SWE","CHE","SUI","TUR","UKR","WAL","GBR","UK"]);
const EUROPE_COUNTRIES = new Set(["albania","andorra","armenia","austria","azerbaijan","belarus","belgium","bosnia and herzegovina","bulgaria","croatia","cyprus","czechia","czech republic","denmark","england","estonia","faroe islands","finland","france","georgia","germany","gibraltar","greece","hungary","iceland","ireland","isle of man","italy","kazakhstan","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","northern ireland","norway","poland","portugal","romania","russia","san marino","scotland","serbia","slovakia","slovenia","spain","sweden","switzerland","turkey","türkiye","ukraine","wales","united kingdom","uk","europe","uefa"]);
function isEuropeanFixture(country: unknown, competition: unknown, home?: unknown, away?: unknown): boolean {
 const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const c=norm(country), comp=norm(competition), teams=norm(String(home??"")+" "+String(away??""));
 const countryParts=c.split(/[\\/,;|]+/).map((x:string)=>x.trim()).filter(Boolean);
 if(EUROPE_COUNTRIES.has(c)||countryParts.some((x:string)=>EUROPE_COUNTRIES.has(x)||EUROPE_ISO3.has(x.toUpperCase()))||EUROPE_ISO3.has(String(country??"").trim().toUpperCase()))return true;
 if(/\buefa\b|european (championship|qualif|league)|uefa nations|uefa champions|uefa europa|uefa conference/.test(comp))return true;
 if(/\bu20 elite league\b/.test(comp) && /\b(england|italy|portugal|czech republic|germany|france|spain|netherlands|belgium|sweden|norway|denmark|finland|iceland|poland|croatia|serbia|austria|switzerland|scotland|wales|ireland)\b/.test(teams))return true;
 return false;
}

function textOf(s: string) {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

async function readFixtures(date: string) {
  const response = await fetch("https://footynomad.com/fixtures/" + date, {
    headers: { "User-Agent": "Mozilla/5.0 MONEYBALL-GLOBAL/1.0" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error("FootyNomad HTTP " + response.status);
  const html = await response.text();
  const re = /<a\b([^>]*\bhref=["'](?:https?:\/\/footynomad\.com)?\/fixture\/[^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const fixtures: any[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const href = (attrs.match(/href=["']([^"']+)/i) || [])[1] || "";
    const rawExternalId = (href.match(/\/fixture\/([^/?#]+)/) || [])[1] || "";
    const externalId = (rawExternalId.match(/^(\d+)/) || [])[1] || rawExternalId;
    const home = textOf((body.match(/<span[^>]*class=["'][^"']*ticket-home[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || "");
    const away = textOf((body.match(/<span[^>]*class=["'][^"']*ticket-away[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1] || "");
    const time = (body.match(/<time[^>]*datetime=["']([^"']+)/i) || [])[1] || null;
    if (!externalId || !home || !away || seen.has(externalId)) continue;
    seen.add(externalId);

    const groupStart = html.lastIndexOf('<details class="league-group', match.index);
    const summaryEnd = groupStart >= 0 ? html.indexOf("</summary>", groupStart) : -1;
    const summary = groupStart >= 0 && summaryEnd > groupStart ? html.slice(groupStart, summaryEnd) : "";
    const competition = textOf((summary.match(/href=["']\/league\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i) || [])[1] || "") || null;
    const sectionStart = html.lastIndexOf('<h2 class="section-title', match.index);
    const sectionEnd = sectionStart >= 0 ? html.indexOf("</h2>", sectionStart) : -1;
    const country = sectionStart >= 0 && sectionEnd > sectionStart
      ? textOf(html.slice(sectionStart, sectionEnd)).replace(/\s+\d+$/, "").trim() || null
      : null;
    if (!isEuropeanFixture(country,competition,home,away)) continue;
    const cls = (attrs.match(/class=["']([^"']+)/i) || [])[1] || "";
    const status = cls.includes("ticket-live") ? "live"
      : cls.includes("ticket-ft") ? "finished"
      : cls.includes("ticket-pst") ? "postponed"
      : cls.includes("ticket-canc") ? "cancelled" : "scheduled";
    const homeScore = (body.match(/class=["'][^"']*ticket-hs[^"']*["'][^>]*>([0-9]+)</i) || [])[1];
    const awayScore = (body.match(/class=["'][^"']*ticket-as[^"']*["'][^>]*>([0-9]+)</i) || [])[1];
    const groupText = home + " " + away + " " + (competition || "");
    const gender = /\bW\b|Women/i.test(groupText) ? "women"
      : /U\d{1,2}|Res\./i.test(home + " " + away) ? "unknown" : "men";

    fixtures.push({
      external_id: externalId,
      source: "FootyNomad",
      competition,
      country,
      gender,
      home_team: home,
      away_team: away,
      kickoff_at: time ? new Date(time).toISOString() : null,
      status,
      home_score: homeScore == null ? null : Number(homeScore),
      away_score: awayScore == null ? null : Number(awayScore),
    });
  }

  const reportedTotal = fixtures.length;
  return { reportedTotal, fixtures };
}

async function db(path: string, method = "GET", body?: unknown, prefer = "return=representation") {
  const response = await fetch(PROJECT_URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data: any;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error((data?.message || data?.details || raw || "Supabase error") + " [" + response.status + "]");
  return data;
}

async function authorized(token: string) {
  if (!SERVICE_KEY || !token) return false;
  const response = await fetch(PROJECT_URL + "/rest/v1/rpc/moneyball_cron_token_valid", {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token }),
  });
  if (!response.ok) return false;
  return (await response.json()) === true;
}

function brusselsDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function brusselsHour() {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", hourCycle: "h23",
  }).format(new Date()));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method === "GET") {
    try {
      const url = new URL(request.url);
      const date = String(url.searchParams.get("date") || brusselsDate());
      if (date.length !== 10 || date[4] !== "-" || date[7] !== "-") return json({ error: "Nieprawidłowa data." }, 400);
      const allFixtures = await db("moneyball_global_fixture_feed?select=scan_date,external_id,source,competition,country,gender,home_team,away_team,kickoff_at,status,home_score,away_score,fetched_at&scan_date=eq." + date + "&order=kickoff_at.asc");
      const fixtures = (allFixtures || []).filter((f:any) => isEuropeanFixture(f.country,f.competition,f.home_team,f.away_team));
      return json({ ok: true, service: "MONEYBALL free FootyNomad feed", date, fetched_at: fixtures[0]?.fetched_at || null, fixtures_count: fixtures.length, fixtures });
    } catch (error) {
      return json({ ok: false, error: String(error) }, 500);
    }
  }
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const token = request.headers.get("x-cron-token") || "";
    if (!(await authorized(token))) return json({ error: "Unauthorized" }, 401);

    const body = await request.json().catch(() => ({}));
    const trigger = String(body.trigger || "scheduled");
    const hour = brusselsHour();
    // Scheduled refresh runs every 15 minutes; manual runs remain available.

    const date = String(body.date || brusselsDate());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Nieprawidłowa data.");
    const result = await readFixtures(date);
    if (!result.fixtures.length && result.reportedTotal > 0) {
      throw new Error("Źródło zgłasza mecze, ale parser nie zwrócił żadnego rekordu. Zachowano poprzedni feed.");
    }

    const run = await db("moneyball_global_scan_runs", "POST", {
      scan_date: date,
      source: "FootyNomad",
      status: "started",
      matches_reported: result.reportedTotal,
      fixtures_count: result.fixtures.length,
      duplicates_removed: 0,
      fetched_at: new Date().toISOString(),
      notes: "Darmowy automatyczny feed; dane publiczne, bez płatnego scrapera.",
    });
    const runId = run?.[0]?.id;
    if (!runId) throw new Error("Nie udało się utworzyć rekordu historii skanu.");

    try {
      const ids = result.fixtures.map((f) => f.external_id);
      const existing = ids.length
        ? await db("moneyball_global_fixture_feed?select=external_id&scan_date=eq." + date + "&external_id=in.(" + ids.join(",") + ")")
        : [];
      const existingIds = new Set((existing || []).map((x: any) => String(x.external_id)));
      const rows = result.fixtures.map((f) => ({ ...f, scan_date: date, fetched_at: new Date().toISOString(), raw: f }));
      for (let i = 0; i < rows.length; i += 100) {
        await db(
          "moneyball_global_fixture_feed?on_conflict=scan_date,external_id",
          "POST",
          rows.slice(i, i + 100),
          "resolution=merge-duplicates,return=minimal",
        );
      }
      const inserted = ids.filter((id) => !existingIds.has(String(id))).length;
      const updated = ids.length - inserted;
      // Purge non-European fixtures from this date's disposable feed cache.
      // Historical matches/predictions in the main registry are intentionally untouched.
      const cachedRows = await db("moneyball_global_fixture_feed?select=external_id,country,competition,home_team,away_team&scan_date=eq." + date);
      const outsideEurope = (cachedRows || []).filter((f: any) => !isEuropeanFixture(f.country, f.competition, f.home_team, f.away_team));
      for (const f of outsideEurope) {
        await db("moneyball_global_fixture_feed?scan_date=eq." + date + "&external_id=eq." + encodeURIComponent(String(f.external_id)), "DELETE");
      }
      await db("moneyball_global_scan_runs?id=eq." + runId, "PATCH", {
        status: "completed",
        fixtures_count: result.fixtures.length,
        duplicates_removed: 0,
        fetched_at: new Date().toISOString(),
        notes: "Pobrano " + result.fixtures.length + " europejskich meczów; nowe: " + inserted + "; aktualizacje: " + updated + "; usunięto z cache spoza Europy: " + outsideEurope.length + ".",
      });
      return json({
        ok: true, date, source: "FootyNomad", reported_total: result.reportedTotal,
        fixtures_count: result.fixtures.length, inserted, updated, scan_run_id: runId,
        schedule: "08:00 i 15:00 Europe/Brussels",
      });
    } catch (error) {
      await db("moneyball_global_scan_runs?id=eq." + runId, "PATCH", {
        status: "failed", fetched_at: new Date().toISOString(), notes: String(error),
      }).catch(() => null);
      throw error;
    }
  } catch (error) {
    return json({ ok: false, error: String(error) }, 400);
  }
});
