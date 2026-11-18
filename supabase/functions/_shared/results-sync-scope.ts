import { isEligibleDomesticSeniorLeague, isEligibleDomesticTopTwoLeague, isEligibleOpenMatchdayTier } from "./domestic-league-scope.ts";
import { isExcludedSeniorTeam, isWomensTeam, teamHistoryKey } from "./team-normalization.ts";

export function isEligibleResultsSyncMatch(match: {
  country?: unknown;
  competition?: unknown;
  league?: unknown;
  gender?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  source?: unknown;
  external_id?: unknown;
}): boolean {
  const gender = String(match.gender ?? "").trim().toLowerCase();
  if (gender && gender !== "men") return false;
  const source = String(match.source ?? "").trim().toLowerCase();
  const competition = match.competition ?? match.league;
  const competitionEligible = source === "openmatchday"
    ? isEligibleDomesticTopTwoLeague(match.country, competition) && isEligibleOpenMatchdayTier(match.external_id)
    : isEligibleDomesticSeniorLeague(match.country, competition);
  return competitionEligible
    && !isWomensTeam(match.home_team) && !isWomensTeam(match.away_team)
    && !isExcludedSeniorTeam(match.home_team) && !isExcludedSeniorTeam(match.away_team);
}

export type ResultsSyncMatchLike = {
  id?: unknown;
  country?: unknown;
  competition?: unknown;
  league?: unknown;
  gender?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  source?: unknown;
  external_id?: unknown;
  kickoff_at?: unknown;
  kickoff_date?: unknown;
  updated_at?: unknown;
};

function brusselsMatchDay(match: ResultsSyncMatchLike): string {
  if (match.kickoff_at) {
    const date = new Date(String(match.kickoff_at));
    if (Number.isFinite(date.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(date);
    }
  }
  return String(match.kickoff_date ?? "");
}

/** Keep one canonical DB row per Brussels date + ordered team pair. */
export function dedupeResultsSyncMatches<T extends ResultsSyncMatchLike>(rows: T[]): T[] {
  const chosen = new Map<string, { row: T; score: string }>();
  for (const row of rows) {
    const day = brusselsMatchDay(row);
    const home = teamHistoryKey(row.home_team);
    const away = teamHistoryKey(row.away_team);
    if (!day || !home || !away) continue;
    const key = `${day}|${home}|${away}`;
    const source = String(row.source ?? "").toLowerCase();
    const priority = source === "footynomad" ? 2 : source === "openmatchday" ? 1 : 0;
    const score = [
      String(priority).padStart(2, "0"),
      row.kickoff_at ? "1" : "0",
      String(row.updated_at ?? ""),
      String(row.id ?? ""),
    ].join("|");
    const current = chosen.get(key);
    if (!current || score > current.score) chosen.set(key, { row, score });
  }
  return [...chosen.values()].map((item) => item.row);
}
