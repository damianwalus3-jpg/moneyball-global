import { fetchAll, insertRow, insertRows, updateRow } from "./db";
import { settleMatch } from "./settlement";
import type { Coupon, CouponLeg, Match, MatchResult, Prediction } from "./types";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/**
 * ESPN's public scoreboard feed is an undocumented, keyless source.
 * This catalogue is intentionally explicit: it is NOT a claim of worldwide
 * coverage. Missing competitions must be reported rather than fabricated.
 */
export const PUBLIC_SOCCER_LEAGUES = [
  { slug: "eng.1", name: "Premier League", country: "Anglia" },
  { slug: "eng.2", name: "Championship", country: "Anglia" },
  { slug: "eng.3", name: "League One", country: "Anglia" },
  { slug: "esp.1", name: "La Liga", country: "Hiszpania" },
  { slug: "esp.2", name: "La Liga 2", country: "Hiszpania" },
  { slug: "ger.1", name: "Bundesliga", country: "Niemcy" },
  { slug: "ger.2", name: "2. Bundesliga", country: "Niemcy" },
  { slug: "ita.1", name: "Serie A", country: "Włochy" },
  { slug: "ita.2", name: "Serie B", country: "Włochy" },
  { slug: "fra.1", name: "Ligue 1", country: "Francja" },
  { slug: "fra.2", name: "Ligue 2", country: "Francja" },
  { slug: "ned.1", name: "Eredivisie", country: "Holandia" },
  { slug: "por.1", name: "Primeira Liga", country: "Portugalia" },
  { slug: "bel.1", name: "Belgian Pro League", country: "Belgia" },
  { slug: "sco.1", name: "Scottish Premiership", country: "Szkocja" },
  { slug: "usa.1", name: "MLS", country: "USA" },
  { slug: "mex.1", name: "Liga MX", country: "Meksyk" },
  { slug: "bra.1", name: "Brasileirão", country: "Brazylia" },
  { slug: "arg.1", name: "Liga Profesional", country: "Argentyna" },
  { slug: "uefa.champions", name: "Liga Mistrzów UEFA", country: "Europa" },
  { slug: "uefa.europa", name: "Liga Europy UEFA", country: "Europa" },
  { slug: "uefa.europa.conf", name: "Liga Konferencji UEFA", country: "Europa" },
  { slug: "uefa.wchampions", name: "Liga Mistrzyń UEFA", country: "Europa · kobiety" },
  { slug: "usa.nwsl", name: "NWSL", country: "USA · kobiety" },
  { slug: "fifa.world", name: "Mistrzostwa Świata", country: "Międzynarodowe" },
  { slug: "fifa.wwc", name: "Mistrzostwa Świata kobiet", country: "Międzynarodowe · kobiety" },
] as const;

export type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  status?: { type?: { state?: string; completed?: boolean; description?: string } };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string;
      team?: { displayName?: string; name?: string; location?: string };
    }>;
  }>;
};

type EspnScoreboard = { events?: EspnEvent[] };

export interface PublicFixture {
  external_id: string;
  kickoff_at: string;
  league: string;
  country: string;
  home_team: string;
  away_team: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  home_goals: number | null;
  away_goals: number | null;
}

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}${values.month}${values.day}`;
}

function naturalMatchKey(kickoff: string | null, home: string | null, away: string | null) {
  if (!kickoff || !home || !away) return null;
  const minute = new Date(kickoff);
  if (Number.isNaN(minute.getTime())) return null;
  return `${minute.toISOString().slice(0, 16)}|${home.trim().toLocaleLowerCase()}|${away.trim().toLocaleLowerCase()}`;
}

export function eventToFixture(event: EspnEvent, league: (typeof PUBLIC_SOCCER_LEAGUES)[number]): PublicFixture | null {
  const kickoff = event.date ? new Date(event.date) : null;
  const competitors = event.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((x) => x.homeAway === "home");
  const away = competitors.find((x) => x.homeAway === "away");
  const homeName = home?.team?.displayName ?? home?.team?.name;
  const awayName = away?.team?.displayName ?? away?.team?.name;
  if (!event.id || !kickoff || Number.isNaN(kickoff.getTime()) || !homeName || !awayName) return null;

  const state = event.status?.type?.state;
  const status: PublicFixture["status"] =
    state === "in" ? "live" :
    state === "post" ? "finished" :
    /postponed|delayed/i.test(event.status?.type?.description ?? "") ? "postponed" :
    /cancelled|canceled/i.test(event.status?.type?.description ?? "") ? "cancelled" :
    "scheduled";
  const homeScore = home?.score == null ? null : Number(home.score);
  const awayScore = away?.score == null ? null : Number(away.score);
  return {
    external_id: `espn:${league.slug}:${event.id}`,
    kickoff_at: kickoff.toISOString(),
    league: league.name,
    country: league.country,
    home_team: homeName,
    away_team: awayName,
    status,
    home_goals: Number.isFinite(homeScore) ? homeScore : null,
    away_goals: Number.isFinite(awayScore) ? awayScore : null,
  };
}

async function fetchLeague(league: (typeof PUBLIC_SOCCER_LEAGUES)[number], from: Date, to: Date): Promise<PublicFixture[]> {
  const url = new URL(`${ESPN_BASE}/${league.slug}/scoreboard`);
  url.searchParams.set("dates", `${dateKey(from)}-${dateKey(to)}`);
  url.searchParams.set("limit", "500");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${league.name}: HTTP ${response.status}`);
  const json = await response.json() as EspnScoreboard;
  return (json.events ?? []).map((event) => eventToFixture(event, league)).filter((x): x is PublicFixture => x !== null);
}

export interface PublicScanResult {
  source: string;
  requestedLeagues: number;
  successfulLeagues: number;
  failedLeagues: string[];
  fetched: number;
  inserted: number;
  updated: number;
  duplicates: number;
  settledResults: number;
  settlementErrors: string[];
  from: string;
  to: string;
}

/** Pulls a bounded date range with throttled parallelism and imports fixtures/results metadata. */
export async function scanPublicFootball(options: { daysBack?: number; daysForward?: number } = {}): Promise<PublicScanResult> {
  const now = new Date();
  const from = new Date(now.getTime() - (options.daysBack ?? 3) * 86400000);
  const to = new Date(now.getTime() + (options.daysForward ?? 10) * 86400000);
  const fixtures: PublicFixture[] = [];
  const failedLeagues: string[] = [];
  let successfulLeagues = 0;

  // Four concurrent leagues avoids hammering an undocumented public endpoint.
  for (let i = 0; i < PUBLIC_SOCCER_LEAGUES.length; i += 4) {
    const batch = PUBLIC_SOCCER_LEAGUES.slice(i, i + 4);
    const results = await Promise.all(batch.map(async (league) => {
      try { return { league, data: await fetchLeague(league, from, to) }; }
      catch (error) { return { league, error: error instanceof Error ? error.message : String(error) }; }
    }));
    for (const result of results) {
      if ("data" in result) { successfulLeagues++; fixtures.push(...result.data); }
      else failedLeagues.push(result.error);
    }
  }

  const unique = new Map<string, PublicFixture>();
  for (const fixture of fixtures) unique.set(fixture.external_id, fixture);
  const deduped = [...unique.values()];
  const scan = await insertRow("scan_runs", {
    started_at: now.toISOString(),
    source: "ESPN public soccer scoreboard (no API key)",
    matches_count: deduped.length,
    notes: `Zakres ${dateKey(from)}–${dateKey(to)}; ligi pobrane ${successfulLeagues}/${PUBLIC_SOCCER_LEAGUES.length}; błędy: ${failedLeagues.length}`,
  });

  const [existing, predictions, couponLegs, coupons, results] = await Promise.all([
    fetchAll("matches"), fetchAll("predictions"), fetchAll("coupon_legs"), fetchAll("coupons"), fetchAll("match_results"),
  ]);
  const byExternal = new Map(existing.filter((m) => m.external_id).map((m) => [m.external_id!, m]));
  const byNatural = new Map(existing.map((m) => [naturalMatchKey(m.kickoff_at, m.home_team, m.away_team), m]).filter((entry): entry is [string, Match] => entry[0] !== null));
  const resolved = new Map<string, Match>();
  const toInsert = deduped.filter((f) => {
    const found = byExternal.get(f.external_id) ?? byNatural.get(naturalMatchKey(f.kickoff_at, f.home_team, f.away_team) ?? "");
    if (found) { resolved.set(f.external_id, found); return false; }
    return true;
  });
  const inserted = await insertRows("matches", toInsert.map((f) => ({
    scan_run_id: scan.id,
    external_id: f.external_id,
    kickoff_at: f.kickoff_at,
    league: f.league,
    country: f.country,
    home_team: f.home_team,
    away_team: f.away_team,
    status: f.status,
    notes: "Źródło: ESPN public scoreboard. Prognoza nie została automatycznie wygenerowana.",
  })));

  let updated = 0;
  for (const fixture of deduped) {
    const old = resolved.get(fixture.external_id) ?? byExternal.get(fixture.external_id);
    if (!old) continue;
    const patch: Record<string, unknown> = {};
    if (!old.external_id) patch.external_id = fixture.external_id;
    if (old.status !== fixture.status) patch.status = fixture.status;
    if (old.kickoff_at !== fixture.kickoff_at) patch.kickoff_at = fixture.kickoff_at;
    if (Object.keys(patch).length) { await updateRow("matches", old.id, patch); updated++; }
  }

  const matchByExternal = new Map(existing.filter((m) => m.external_id).map((m) => [m.external_id!, m]));
  for (const [externalId, match] of resolved) matchByExternal.set(externalId, match);
  for (const m of inserted) if (m.external_id) matchByExternal.set(m.external_id, m);
  let settledResults = 0;
  const settlementErrors: string[] = [];
  for (const fixture of deduped) {
    const match = matchByExternal.get(fixture.external_id);
    if (!match) continue;
    try {
      if (fixture.status === "finished" && fixture.home_goals != null && fixture.away_goals != null) {
        const existingResult = results.find((r) => r.match_id === match.id);
        await settleMatch({ match, existingResult, predictions: predictions as Prediction[], legs: couponLegs as CouponLeg[], coupons: coupons as Coupon[] }, {
          kind: "score", home: fixture.home_goals, away: fixture.away_goals, source: "ESPN public scoreboard",
        });
        settledResults++;
      } else if (fixture.status === "postponed" || fixture.status === "cancelled") {
        await settleMatch({ match, existingResult: results.find((r) => r.match_id === match.id), predictions: predictions as Prediction[], legs: couponLegs as CouponLeg[], coupons: coupons as Coupon[] }, {
          kind: "void", status: fixture.status,
        });
      }
    } catch (error) {
      settlementErrors.push(`${fixture.league}: ${fixture.home_team} – ${fixture.away_team}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    source: "ESPN public soccer scoreboard",
    requestedLeagues: PUBLIC_SOCCER_LEAGUES.length,
    successfulLeagues,
    failedLeagues,
    fetched: deduped.length,
    inserted: inserted.length,
    updated,
    duplicates: fixtures.length - deduped.length,
    settledResults,
    settlementErrors,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
