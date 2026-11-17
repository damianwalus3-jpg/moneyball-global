import { seasonCode } from "./season";
export interface FormMatch {
  date: string;
  opponent: string;
  venue: "H" | "A";
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  points: number;
}
export interface TeamForm {
  team: string;
  matches: FormMatch[];
  home: FormMatch[];
  away: FormMatch[];
  source: string;
  sourceUpdatedAt: string;
}
type CsvRow = Record<string, string>;
const ROOT = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master";
const CACHE_PREFIX = "moneyball.team-results.v2:";
const CACHE_TTL = 6 * 60 * 60 * 1000;

function parseLine(line: string): string[] {
  const values: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += ch;
  }
  values.push(value.trim());
  return values;
}
function parseResults(csv: string): CsvRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""]));
  });
}
const leagueRequests = new Map<string, Promise<{ rows: CsvRow[]; generatedAt: string }>>();
async function loadLeagueResults(folder: string, beforeDate: string): Promise<{ rows: CsvRow[]; generatedAt: string }> {
  const season = seasonCode(beforeDate);
  const key = `${CACHE_PREFIX}${folder}:${season}`;
  const existing = leagueRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached) as { rows: CsvRow[]; generatedAt: string; cachedAt: number };
        if (Date.now() - parsed.cachedAt < CACHE_TTL) return parsed;
      }
    } catch { /* ignore malformed cache */ }
    const indexResponse = await fetch(`${ROOT}/build_summary.json`);
    if (!indexResponse.ok) throw new Error(`Indeks wyników niedostępny (HTTP ${indexResponse.status})`);
    const index = await indexResponse.json() as { generated_utc: string };
    const response = await fetch(`${ROOT}/data/${folder}/results_${season}.csv`);
    if (!response.ok) throw new Error(`Brak pliku wyników dla ligi (HTTP ${response.status})`);
    const rows = parseResults(await response.text());
    const value = { rows, generatedAt: index.generated_utc, cachedAt: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* cache is optional */ }
    return value;
  })();
  leagueRequests.set(key, request);
  try { return await request; }
  finally { leagueRequests.delete(key); }
}
function mapMatch(row: CsvRow, team: string): FormMatch | null {
  if (row.ft_home?.trim() === "" || row.ft_away?.trim() === "") return null;
  const homeScore = Number(row.ft_home), awayScore = Number(row.ft_away);
  if (!row.date || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) return null;
  const isHome = row.home.toLocaleLowerCase() === team.toLocaleLowerCase();
  const isAway = row.away.toLocaleLowerCase() === team.toLocaleLowerCase();
  if (!isHome && !isAway) return null;
  const goalsFor = isHome ? homeScore : awayScore;
  const goalsAgainst = isHome ? awayScore : homeScore;
  const result = goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L";
  return {
    date: row.date,
    opponent: isHome ? row.away : row.home,
    venue: isHome ? "H" : "A",
    goalsFor,
    goalsAgainst,
    result,
    points: result === "W" ? 3 : result === "D" ? 1 : 0,
  };
}
export async function loadRecentTeamForm(folder: string, team: string, beforeDate: string): Promise<TeamForm> {
  if (!/^[A-Z]{3}_\d+_[a-z0-9-]+$/.test(folder)) throw new Error("Nieprawidłowy identyfikator ligi");
  const { rows, generatedAt } = await loadLeagueResults(folder, beforeDate);
  const matches = rows
    .filter(row => row.date < beforeDate)
    .map(row => mapMatch(row, team))
    .filter((row): row is FormMatch => row !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    team,
    matches: matches.slice(0, 5),
    home: matches.filter(row => row.venue === "H").slice(0, 5),
    away: matches.filter(row => row.venue === "A").slice(0, 5),
    source: `open-matchday results_${seasonCode(beforeDate)}.csv`,
    sourceUpdatedAt: generatedAt,
  };
}

interface OpenLigaResultRow {
  resultTypeID?: number;
  resultName?: string | null;
  resultOrderID?: number;
  pointsTeam1?: number;
  pointsTeam2?: number;
}
interface OpenLigaHistoryMatch {
  matchDateTime?: string | null;
  matchDateTimeUTC?: string | null;
  matchIsFinished?: boolean;
  lastUpdateDateTime?: string | null;
  team1?: { teamName?: string | null };
  team2?: { teamName?: string | null };
  matchResults?: OpenLigaResultRow[] | null;
}
function brusselsDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (key: string) => parts.find(part => part.type === key)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function finalOpenLigaScore(results: OpenLigaResultRow[] | null | undefined): OpenLigaResultRow | undefined {
  // OpenLigaDB may expose halftime, regular-time and penalty results separately.
  // Never infer a final score from the last arbitrary result row.
  return results?.find(row => row.resultTypeID === 2 || /endresult|endergebnis|final/i.test(row.resultName ?? ""));
}
function normalizeTeam(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function mapOpenLigaTeamForm(matches: OpenLigaHistoryMatch[], team: string, beforeDate: string, sourceUpdatedAt = new Date().toISOString()): TeamForm {
  const target = normalizeTeam(team);
  const mapped = matches.flatMap(match => {
    if (match.matchIsFinished !== true) return [];
    const kickoff = match.matchDateTimeUTC || match.matchDateTime;
    const date = kickoff ? brusselsDate(kickoff) : "";
    const home = match.team1?.teamName?.trim() ?? "";
    const away = match.team2?.teamName?.trim() ?? "";
    if (!date || date >= beforeDate || !home || !away) return [];
    const isHome = normalizeTeam(home) === target;
    const isAway = normalizeTeam(away) === target;
    if (!isHome && !isAway) return [];
    const results = match.matchResults ?? [];
    const finalResult = finalOpenLigaScore(results);
    if (!finalResult || !Number.isInteger(finalResult.pointsTeam1) || !Number.isInteger(finalResult.pointsTeam2)) return [];
    const homeScore = finalResult.pointsTeam1 as number;
    const awayScore = finalResult.pointsTeam2 as number;
    if (homeScore < 0 || awayScore < 0) return [];
    const goalsFor = isHome ? homeScore : awayScore;
    const goalsAgainst = isHome ? awayScore : homeScore;
    const result: FormMatch["result"] = goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L";
    return [{
      date,
      opponent: isHome ? away : home,
      venue: isHome ? "H" as const : "A" as const,
      goalsFor,
      goalsAgainst,
      result,
      points: result === "W" ? 3 : result === "D" ? 1 : 0,
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const updated = matches.map(match => match.lastUpdateDateTime).filter((value): value is string => Boolean(value)).sort().at(-1) ?? sourceUpdatedAt;
  return {
    team,
    matches: mapped.slice(0, 5),
    home: mapped.filter(match => match.venue === "H").slice(0, 5),
    away: mapped.filter(match => match.venue === "A").slice(0, 5),
    source: "OpenLigaDB",
    sourceUpdatedAt: updated,
  };
}
export function cacheOpenLigaTeamForms(matches: OpenLigaHistoryMatch[], teams: string[], shortcut: string, season: string, beforeDate: string): void {
  for (const team of new Set(teams.map(value => value.trim()).filter(Boolean))) {
    const key = `moneyball.openliga-form.v1:${shortcut}:${season}:${normalizeTeam(team)}:${beforeDate}`;
    const form = mapOpenLigaTeamForm(matches, team, beforeDate);
    try { localStorage.setItem(key, JSON.stringify({ ...form, cachedAt: Date.now() })); } catch { /* cache is optional */ }
  }
}
export async function loadOpenLigaRecentTeamForm(shortcut: string, season: string, team: string, beforeDate: string): Promise<TeamForm> {
  if (!/^[a-z0-9._-]+$/i.test(shortcut) || !/^\d{4}$/.test(season) || !team.trim()) throw new Error("Nieprawidłowe parametry historii OpenLigaDB");
  const key = `moneyball.openliga-form.v1:${shortcut}:${season}:${normalizeTeam(team)}:${beforeDate}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached) as TeamForm & { cachedAt: number };
      if (Date.now() - parsed.cachedAt < CACHE_TTL) return parsed;
    }
  } catch { /* ignore malformed cache */ }
  const response = await fetch(`/api/openligadb/team-matches/${encodeURIComponent(shortcut)}/${encodeURIComponent(season)}/${encodeURIComponent(team)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`OpenLigaDB historia niedostępna (HTTP ${response.status})`);
  const matches = await response.json() as OpenLigaHistoryMatch[];
  const form = mapOpenLigaTeamForm(matches, team, beforeDate);
  try { localStorage.setItem(key, JSON.stringify({ ...form, cachedAt: Date.now() })); } catch { /* cache is optional */ }
  return form;
}

export interface VerifiedFixtureResult {
  actual: "1" | "X" | "2";
  homeGoals: number;
  awayGoals: number;
  date: string;
  source: string;
}
function normalizedName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export async function findOpenMatchdayResult(folder: string, home: string, away: string, date: string): Promise<VerifiedFixtureResult | null> {
  if (!/^[A-Z]{3}_\d+_[a-z0-9-]+$/.test(folder)) throw new Error("Nieprawidłowy identyfikator ligi");
  const { rows } = await loadLeagueResults(folder, date);
  const row = rows.find(item => item.date === date && normalizedName(item.home) === normalizedName(home) && normalizedName(item.away) === normalizedName(away));
  if (!row || row.ft_home?.trim() === "" || row.ft_away?.trim() === "") return null;
  const homeGoals = Number(row.ft_home), awayGoals = Number(row.ft_away);
  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0) return null;
  return { actual: homeGoals > awayGoals ? "1" : homeGoals === awayGoals ? "X" : "2", homeGoals, awayGoals, date, source: "open-matchday results CSV" };
}
const openLigaResultRequests = new Map<string, Promise<OpenLigaHistoryMatch[]>>();
async function loadOpenLigaSeasonMatches(shortcut: string, season: string): Promise<OpenLigaHistoryMatch[]> {
  const key = `${shortcut}:${season}`;
  const existing = openLigaResultRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`/api/openligadb/matches/${encodeURIComponent(shortcut)}/${encodeURIComponent(season)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`OpenLigaDB wyniki niedostępne (HTTP ${response.status})`);
    return await response.json() as OpenLigaHistoryMatch[];
  })();
  openLigaResultRequests.set(key, request);
  try { return await request; } finally { openLigaResultRequests.delete(key); }
}
export async function findOpenLigaFixtureResult(shortcut: string, season: string, home: string, away: string, date: string): Promise<VerifiedFixtureResult | null> {
  if (!/^[a-z0-9._-]+$/i.test(shortcut) || !/^\d{4}$/.test(season)) throw new Error("Nieprawidłowe parametry OpenLigaDB");
  const matches = await loadOpenLigaSeasonMatches(shortcut, season);
  const match = matches.find(item => {
    const kickoff = item.matchDateTimeUTC || item.matchDateTime;
    return item.matchIsFinished === true && kickoff && brusselsDate(kickoff) === date
      && normalizedName(item.team1?.teamName ?? "") === normalizedName(home)
      && normalizedName(item.team2?.teamName ?? "") === normalizedName(away);
  });
  if (!match) return null;
  const finalResult = finalOpenLigaScore(match.matchResults);
  const homeGoals = finalResult?.pointsTeam1, awayGoals = finalResult?.pointsTeam2;
  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || (homeGoals as number) < 0 || (awayGoals as number) < 0) return null;
  return { actual: (homeGoals as number) > (awayGoals as number) ? "1" : homeGoals === awayGoals ? "X" : "2", homeGoals: homeGoals as number, awayGoals: awayGoals as number, date, source: "OpenLigaDB" };
}
