export interface PitchApiTeamRef { id: string; name: string }
export interface PitchApiFixture {
  id: string;
  league: { id: string; name: string };
  home_team: PitchApiTeamRef;
  away_team: PitchApiTeamRef;
  time_utc: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
}
export interface PitchApiLeague {
  id: string;
  name: string;
  country_code?: string | null;
  season?: string | null;
}
export interface PitchApiLeagueMatch {
  id: string;
  time_utc: string;
  status: string;
  home_team: PitchApiTeamRef;
  away_team: PitchApiTeamRef;
  score_home: number | null;
  score_away: number | null;
}
export interface PitchApiTeamMatchStats {
  match_id: string;
  home_team?: PitchApiTeamRef;
  away_team?: PitchApiTeamRef;
  periods?: Array<{ period?: string; groups?: Array<{ items?: Array<{ key?: string; home?: string | null; away?: string | null }> }> }>;
}
export interface PitchApiXgObservation {
  matchId: string;
  date: string;
  isHome: boolean;
  xgFor: number;
  xgAgainst: number;
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number | null;
  shotsAgainst: number | null;
  shotsOnTargetFor: number | null;
  shotsOnTargetAgainst: number | null;
  bigChancesFor: number | null;
  bigChancesAgainst: number | null;
  xgOnTargetFor: number | null;
  xgOnTargetAgainst: number | null;
  xgNonPenaltyFor: number | null;
  xgNonPenaltyAgainst: number | null;
}
export interface PitchApiXgForm {
  team: string;
  matches: PitchApiXgObservation[];
  sampleSize: number;
  xgForPerMatch: number | null;
  xgAgainstPerMatch: number | null;
  shotsForPerMatch: number | null;
  shotsAgainstPerMatch: number | null;
  shotsOnTargetForPerMatch: number | null;
  shotsOnTargetAgainstPerMatch: number | null;
  bigChancesForPerMatch: number | null;
  bigChancesAgainstPerMatch: number | null;
  xgOnTargetForPerMatch: number | null;
  xgOnTargetAgainstPerMatch: number | null;
  source: "PitchAPI";
}
async function getData<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`PitchAPI HTTP ${response.status}: ${path}`);
  const payload = await response.json() as { data?: T; error?: { message?: string; code?: string } };
  if (!payload || !("data" in payload) || payload.data == null) {
    throw new Error(payload?.error?.code ?? payload?.error?.message ?? "PitchAPI: brak pola data");
  }
  return payload.data;
}
export function isPitchApiCountryEligible(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  // Match the application's strict European scan policy; transcontinental/Asian
  // associations are intentionally not inferred from a league display name.
  return new Set(["ALB","AND","AUT","BLR","BEL","BIH","BUL","CRO","CZE","DEN","ENG","EST","FRO","FIN","FRA","GER","GIB","GRE","HUN","ISL","IRE","ITA","KOS","LVA","LIE","LTU","LUX","MLT","MDA","MCO","MNE","NED","MKD","NIR","NOR","POL","POR","ROU","RUS","SMR","SCO","SRB","SVK","SVN","ESP","SWE","SUI","UKR","WAL","UEFA"]).has(countryCode.toUpperCase());
}
export function parsePitchApiXgStats(data: PitchApiTeamMatchStats, teamId: string, match: PitchApiLeagueMatch): PitchApiXgObservation | null {
  const period = data.periods?.find(item => item.period === "All") ?? data.periods?.[0];
  const items = period?.groups?.flatMap(group => group.items ?? []) ?? [];
  const find = (keys: string[], side: "home" | "away"): number | null => {
    const item = items.find(row => keys.includes(row.key ?? ""));
    if (!item) return null;
    const raw = item[side];
    if (raw == null || raw.trim() === "") return null;
    const value = Number.parseFloat(raw.replace(",", "."));
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  if (match.status !== "finished" || !Number.isInteger(match.score_home) || !Number.isInteger(match.score_away)) return null;
  const homeSide = data.home_team?.id === teamId || match.home_team.id === teamId;
  const awaySide = data.away_team?.id === teamId || match.away_team.id === teamId;
  if (homeSide === awaySide) return null;
  const homeXg = find(["expected_goals"], "home");
  const awayXg = find(["expected_goals"], "away");
  if (homeXg == null || awayXg == null) return null;
  const homeShots = find(["total_shots", "shots"], "home");
  const awayShots = find(["total_shots", "shots"], "away");
  const homeOnTarget = find(["ShotsOnTarget", "shots_on_target"], "home");
  const awayOnTarget = find(["ShotsOnTarget", "shots_on_target"], "away");
  const homeBig = find(["big_chance", "big_chances"], "home");
  const awayBig = find(["big_chance", "big_chances"], "away");
  const homeXgot = find(["expected_goals_on_target"], "home");
  const awayXgot = find(["expected_goals_on_target"], "away");
  const homeNpxg = find(["expected_goals_non_penalty"], "home");
  const awayNpxg = find(["expected_goals_non_penalty"], "away");
  const date = match.time_utc.slice(0, 10);
  return {
    matchId: match.id, date, isHome: homeSide,
    xgFor: homeSide ? homeXg : awayXg,
    xgAgainst: homeSide ? awayXg : homeXg,
    goalsFor: (homeSide ? match.score_home : match.score_away) as number,
    goalsAgainst: (homeSide ? match.score_away : match.score_home) as number,
    shotsFor: homeSide ? homeShots : awayShots,
    shotsAgainst: homeSide ? awayShots : homeShots,
    shotsOnTargetFor: homeSide ? homeOnTarget : awayOnTarget,
    shotsOnTargetAgainst: homeSide ? awayOnTarget : homeOnTarget,
    bigChancesFor: homeSide ? homeBig : awayBig,
    bigChancesAgainst: homeSide ? awayBig : homeBig,
    xgOnTargetFor: homeSide ? homeXgot : awayXgot,
    xgOnTargetAgainst: homeSide ? awayXgot : homeXgot,
    xgNonPenaltyFor: homeSide ? homeNpxg : awayNpxg,
    xgNonPenaltyAgainst: homeSide ? awayNpxg : homeNpxg,
  };
}
export function buildPitchApiXgForm(team: string, matches: PitchApiXgObservation[]): PitchApiXgForm {
  const ordered = [...matches].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  const average = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
    return valid.length ? valid.reduce((sum,value) => sum + value, 0) / valid.length : null;
  };
  return {
    team, matches: ordered, sampleSize: ordered.length,
    xgForPerMatch: average(ordered.map(row => row.xgFor)),
    xgAgainstPerMatch: average(ordered.map(row => row.xgAgainst)),
    shotsForPerMatch: average(ordered.map(row => row.shotsFor)),
    shotsAgainstPerMatch: average(ordered.map(row => row.shotsAgainst)),
    shotsOnTargetForPerMatch: average(ordered.map(row => row.shotsOnTargetFor)),
    shotsOnTargetAgainstPerMatch: average(ordered.map(row => row.shotsOnTargetAgainst)),
    bigChancesForPerMatch: average(ordered.map(row => row.bigChancesFor)),
    bigChancesAgainstPerMatch: average(ordered.map(row => row.bigChancesAgainst)),
    xgOnTargetForPerMatch: average(ordered.map(row => row.xgOnTargetFor)),
    xgOnTargetAgainstPerMatch: average(ordered.map(row => row.xgOnTargetAgainst)),
    source: "PitchAPI",
  };
}
export async function fetchPitchApiDate(date: string): Promise<PitchApiFixture[]> {
  const data = await getData<{ matches?: PitchApiFixture[] }>(`/api/pitchapi/date/${date}?status=all`);
  return Array.isArray(data.matches) ? data.matches : [];
}
export async function fetchPitchApiLeague(leagueId: string): Promise<PitchApiLeague> {
  return getData<PitchApiLeague>(`/api/pitchapi/leagues/${encodeURIComponent(leagueId)}`);
}
export async function fetchPitchApiLeagueMatches(leagueId: string, season?: string): Promise<PitchApiLeagueMatch[]> {
  const params = new URLSearchParams({ status: "played" });
  if (season) params.set("season", season);
  const data = await getData<{ matches?: PitchApiLeagueMatch[] }>(`/api/pitchapi/leagues/${encodeURIComponent(leagueId)}/matches?${params.toString()}`);
  return Array.isArray(data.matches) ? data.matches : [];
}
export async function fetchPitchApiMatchStats(matchId: string): Promise<PitchApiTeamMatchStats> {
  return getData<PitchApiTeamMatchStats>(`/api/pitchapi/matches/${encodeURIComponent(matchId)}/stats`);
}

function brusselsDate(utc: string): string {
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return get("year") + "-" + get("month") + "-" + get("day");
}
export async function fetchPitchApiXgFormsForFixture(input: {
  leagueId: string; season?: string; homeTeamId: string; awayTeamId: string; beforeDate: string;
}): Promise<{ home: PitchApiXgForm; away: PitchApiXgForm }> {
  const leagueMatches = await fetchPitchApiLeagueMatches(input.leagueId, input.season);
  const eligible = leagueMatches.filter(match => match.status === "finished"
    && brusselsDate(match.time_utc) < input.beforeDate
    && Number.isInteger(match.score_home) && Number.isInteger(match.score_away));
  const homeMatches = eligible.filter(match => match.home_team.id === input.homeTeamId || match.away_team.id === input.homeTeamId)
    .sort((a,b) => b.time_utc.localeCompare(a.time_utc)).slice(0,5);
  const awayMatches = eligible.filter(match => match.home_team.id === input.awayTeamId || match.away_team.id === input.awayTeamId)
    .sort((a,b) => b.time_utc.localeCompare(a.time_utc)).slice(0,5);
  const selected = [...new Map([...homeMatches, ...awayMatches].map(match => [match.id, match])).values()];
  const statsByMatch = new Map<string, PitchApiTeamMatchStats>();
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
    while (cursor < selected.length) {
      const match = selected[cursor++];
      try { statsByMatch.set(match.id, await fetchPitchApiMatchStats(match.id)); } catch { /* missing match analytics stays missing */ }
    }
  }));
  const homeRows = homeMatches.flatMap(match => {
    const stats = statsByMatch.get(match.id);
    const row = stats ? parsePitchApiXgStats(stats, input.homeTeamId, match) : null;
    return row ? [row] : [];
  });
  const awayRows = awayMatches.flatMap(match => {
    const stats = statsByMatch.get(match.id);
    const row = stats ? parsePitchApiXgStats(stats, input.awayTeamId, match) : null;
    return row ? [row] : [];
  });
  return {
    home: buildPitchApiXgForm(homeMatches[0]?.home_team.id === input.homeTeamId ? homeMatches[0].home_team.name : homeMatches[0]?.away_team.name ?? input.homeTeamId, homeRows),
    away: buildPitchApiXgForm(awayMatches[0]?.home_team.id === input.awayTeamId ? awayMatches[0].home_team.name : awayMatches[0]?.away_team.name ?? input.awayTeamId, awayRows),
  };
}
