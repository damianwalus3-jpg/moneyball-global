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
async function loadLeagueResults(folder: string, beforeDate: string): Promise<{ rows: CsvRow[]; generatedAt: string }> {
  const season = seasonCode(beforeDate);
  const key = `${CACHE_PREFIX}${folder}:${season}`;
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
