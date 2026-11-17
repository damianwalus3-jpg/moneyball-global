export interface FreeFixture {
  id: string;
  competition: string;
  countryCode: string;
  date: string;
  time: string;
  home: string;
  away: string;
  source: string;
  sourceUpdatedAt: string;
}
interface LeagueIndex {
  generated_utc: string;
  leagues: Array<{ league: string; folder: string; fixtures: number; errors?: string[] }>;
}
const ROOT = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master";
const SOURCE = "open-matchday (public CSV; non-commercial terms)";
const EUROPE = new Set(["ENG","ESP","GER","ITA","FRA","NED","POR","BEL","SCO","AUT","SUI","TUR","GRE","DEN","SWE","NOR","ROU","RUS","IRE","POL","WAL","NIR","CRO","CZE","UKR","CYP","SVK","SVN","FIN","KAZ","ALB","SRB","BIH","BUL","HUN","ISL","LUX","MLT","EST","LVA","LTU","MDA","GEO","ARM","AZE","MKD","MNE","AND","FRO","GIB","UEFA"]);
const CACHE_KEY = "moneyball.free-fixtures.v1";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { out.push(value.trim()); value = ""; }
    else value += char;
  }
  out.push(value.trim());
  return out;
}
function parseCsv(text: string): Array<Record<string,string>> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
  });
}
function brusselsDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`Źródło zwróciło HTTP ${response.status}: ${url.split("/").slice(-2).join("/")}`);
  return response.text();
}
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}
export interface FixtureScan {
  date: string;
  generatedAt: string;
  fixtures: FreeFixture[];
  leaguesChecked: number;
  leaguesFailed: string[];
  source: string;
  cache: boolean;
}
export async function scanTodayEuropeanFixtures(force = false): Promise<FixtureScan> {
  const date = brusselsDate();
  if (!force) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as FixtureScan & { cachedAt: number };
        if (data.date === date && Date.now() - data.cachedAt < 30 * 60 * 1000) return { ...data, cache: true };
      }
    } catch { /* ignore invalid cache */ }
  }
  const index = JSON.parse(await fetchText(`${ROOT}/build_summary.json`)) as LeagueIndex;
  const leagues = index.leagues.filter(league => {
    const code = league.folder.split("/").pop()?.split("_")[0] ?? "";
    const isDomesticLeague = !league.folder.includes("_CUP_") && !league.folder.includes("_U21_") && code !== "UEFA";
    return EUROPE.has(code) && isDomesticLeague && league.fixtures > 0;
  });
  const responses = await pooled(leagues, 8, async league => {
    const folder = league.folder.replace(/^data\//, "");
    try {
      const csv = await fetchText(`${ROOT}/${league.folder}/fixtures_2627.csv`);
      const fixtures = parseCsv(csv).filter(row => row.date === date).map(row => ({
        id: `${folder}|${row.gw}|${row.date}|${row.time}|${row.home}|${row.away}`,
        competition: league.league,
        countryCode: folder.split("_")[0],
        date: row.date,
        time: row.time,
        home: row.home,
        away: row.away,
        source: SOURCE,
        sourceUpdatedAt: index.generated_utc,
      }));
      return { fixtures, error: "" };
    } catch (error) {
      return { fixtures: [] as FreeFixture[], error: `${league.league}: ${error instanceof Error ? error.message : "błąd źródła"}` };
    }
  });
  const fixtures = responses.flatMap(row => row.fixtures).sort((a,b) => a.time.localeCompare(b.time) || a.competition.localeCompare(b.competition));
  const failed = responses.flatMap(row => row.error ? [row.error] : []);
  const result: FixtureScan = { date, generatedAt: index.generated_utc, fixtures, leaguesChecked: leagues.length, leaguesFailed: failed, source: SOURCE, cache: false };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, cachedAt: Date.now() })); } catch { /* storage may be full */ }
  return result;
}
