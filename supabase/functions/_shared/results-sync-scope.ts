import { isEligibleDomesticTopTwoLeague, isEligibleOpenMatchdayTier } from "./domestic-league-scope.ts";
import { isExcludedSeniorTeam, isWomensTeam } from "./team-normalization.ts";

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
  return isEligibleDomesticTopTwoLeague(match.country, match.competition ?? match.league)
    && isEligibleOpenMatchdayTier(match.source, match.external_id)
    && !isWomensTeam(match.home_team) && !isWomensTeam(match.away_team)
    && !isExcludedSeniorTeam(match.home_team) && !isExcludedSeniorTeam(match.away_team);
}
