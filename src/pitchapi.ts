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
  home: PitchApiTeamRef;
  away: PitchApiTeamRef;
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
}
export interface PitchApiXgForm {
  team: string;
  matches: PitchApiXgObservation[];
  sampleSize: number;
  xgForPerMatch: number | null;
  xgAgainstPerMatch: number | null;
  shotsForPerMatch: number | null;
  shotsAgainstPerMatch: number | null;
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
  const homeSide = data.home_team?.id === teamId || match.home.id === teamId;
  const awaySide = data.away_team?.id === teamId || match.away.id === teamId;
  if (homeSide === awaySide) return null;
  const homeXg = find(["expected_goals"], "home");
  const awayXg = find(["expected_goals"], "away");
  if (homeXg == null || awayXg == null) return null;
  const homeShots = find(["total_shots", "shots"], "home");
  const awayShots = find(["total_shots", "shots"], "away");
  const date = match.time_utc.slice(0, 10);
  return {
    matchId: match.id, date, isHome: homeSide,
    xgFor: homeSide ? homeXg : awayXg,
    xgAgainst: homeSide ? awayXg : homeXg,
    goalsFor: (homeSide ? match.score_home : match.score_away) as number,
    goalsAgainst: (homeSide ? match.score_away : match.score_home) as number,
    shotsFor: homeSide ? homeShots : awayShots,
    shotsAgainst: homeSide ? awayShots : homeShots,
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
  const data = await getData<PitchApiLeagueMatch[]>(`/api/pitchapi/leagues/${encodeURIComponent(leagueId)}/matches?${params.toString()}`);
  return Array.isArray(data) ? data : [];
}
export async function fetchPitchApiMatchStats(matchId: string): Promise<PitchApiTeamMatchStats> {
  return getData<PitchApiTeamMatchStats>(`/api/pitchapi/matches/${encodeURIComponent(matchId)}/stats`);
}
