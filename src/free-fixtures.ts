import { scanOpenFootball } from "./openfootball";
import { cacheOpenLigaTeamForms } from "./team-form";
import { seasonCode } from "./season";
export interface FreeFixture {
  id: string;
  competition: string;
  countryCode: string;
  leagueFolder: string;
  leagueShortcut?: string;
  leagueSeason?: string;
  openFootballFeedId?: string;
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
interface OpenLigaLeague {
  leagueId: number;
  leagueName?: string | null;
  leagueShortcut?: string | null;
  leagueSeason?: string | null;
  sport?: { sportName?: string | null; sportId?: number };
}
interface OpenLigaMatch {
  matchID?: number;
  matchDateTime?: string | null;
  matchDateTimeUTC?: string | null;
  matchIsFinished?: boolean;
  lastUpdateDateTime?: string | null;
  matchResults?: Array<{ resultTypeID?: number; resultName?: string | null; resultOrderID?: number; pointsTeam1?: number; pointsTeam2?: number }> | null;
  leagueName?: string | null;
  leagueShortcut?: string | null;
  team1?: { teamName?: string | null };
  team2?: { teamName?: string | null };
}
const ROOT = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master";
const OPENLIGA = "/api/openligadb";
const SOURCE = "open-matchday + OpenLigaDB + openfootball (darmowe źródła publiczne)";
const EUROPE = new Set(["ENG","ESP","GER","ITA","FRA","NED","POR","BEL","SCO","AUT","SUI","TUR","GRE","DEN","SWE","NOR","ROU","RUS","IRE","POL","WAL","NIR","CRO","CZE","UKR","CYP","SVK","SVN","FIN","KAZ","ALB","SRB","BIH","BUL","HUN","ISL","LUX","MLT","EST","LVA","LTU","MDA","GEO","ARM","AZE","MKD","MNE","AND","FRO","GIB","ISR","KOS","BLR","LIE","SMR","MCO","VAT","UEFA"]);
const CACHE_KEY = "moneyball.free-fixtures.v7";
const CACHE_MS = 15 * 60 * 1000;
const COUNTRY_NAMES = [
  "england","scotland","wales","northern ireland","ireland","france","germany","italy","spain","portugal","netherlands","belgium","austria","switzerland","turkey","greece","denmark","sweden","norway","romania","poland","croatia","czech","ukraine","cyprus","slovakia","slovenia","finland","kazakhstan","albania","serbia","bosnia","bulgaria","hungary","iceland","luxembourg","malta","estonia","latvia","lithuania","moldova","georgia","armenia","azerbaijan","macedonia","montenegro","andorra","faroe","gibraltar","israel","kosovo","belarus","liechtenstein","san marino","monaco","vatican","uefa","deutschland","österreich"
];
const OPENLIGA_EXCLUDED_SHORTCUTS = new Set(["bl1test", "blclaude", "bl12026"]);
const EUROPEAN_TWO_LETTER_SHORTCUTS = new Set(["fr","nl","pt","gr","ch","cz","tr","at","dk","se","no","ro","ie","hr","ua","cy","sk","si","fi","hu","bg","rs","ba","is","lu","mt","ee","lv","lt","md","ge","am","az","mk","me","ad","fo","gi","il","ko","by","li","sm"]);
const EUROPEAN_SHORTCUT_PREFIXES = [
  "bl","dfb","rl","ol","vl","ll","kl","kreisliga","oberliga","landesliga","verbandsliga","bezirksliga",
  "eng","esp","ita","fra","ned","por","bel","sco","aut","sui","tur","gre","den","swe","nor","rou","rus","irl","pol","wal","nir","cro","cze","ukr","cyp","svk","svn","fin","kaz","alb","srb","bih","bul","hun","isl","lux","mlt","est","lva","ltu","mda","geo","arm","aze","mkd","mne","and","fro","gib","isr","kos","blr","lie","smr","mco","vat","uefa","ucl","uel","uecl","premierleague","laliga","ligue1","eredivisie","primeiraliga","championsleague","europaleague","conferenceleague","proleague","nofv","regio","thüli","ffb","ere","öbl","oh","pl","wsc","la1","nla","unl","u21dfb","fna","wcl"
];

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
function brusselsParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
function brusselsDate(now = new Date()): string { return brusselsParts(now).date; }
async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url.split("/").slice(-2).join("/")}`);
  return response.text();
}
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: OpenLigaDB`);
  return response.json() as Promise<T>;
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
export function openLigaSeasonYears(date: string): number[] {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month < 7 ? [year, year - 1] : [year];
}

export function isEuropeanCompetitionFolder(folder: string): boolean {
  const name = folder.split("/").pop() ?? folder;
  return EUROPE.has(name.split("_")[0]);
}

export function isEuropeanOpenLiga(league: OpenLigaLeague): boolean {
  const shortcut = (league.leagueShortcut ?? "").toLowerCase();
  if (OPENLIGA_EXCLUDED_SHORTCUTS.has(shortcut)) return false;
  const name = (league.leagueName ?? "").toLowerCase();
  if (league.sport?.sportName && !league.sport.sportName.toLowerCase().includes("football") && !league.sport.sportName.toLowerCase().includes("fußball") && !league.sport.sportName.toLowerCase().includes("fussball")) return false;
  if (COUNTRY_NAMES.some(country => name.includes(country))) return true;
  const countryCodeFeed = [...EUROPEAN_TWO_LETTER_SHORTCUTS].some(code => new RegExp("^" + code + "[0-9]").test(shortcut));
  return countryCodeFeed || EUROPEAN_SHORTCUT_PREFIXES.some(prefix => shortcut === prefix || shortcut.startsWith(prefix));
}
export function fixtureKey(date: string, home: string, away: string): string {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${date}|${normalize(home)}|${normalize(away)}`;
}
export interface FixtureScan {
  date: string;
  generatedAt: string;
  fixtures: FreeFixture[];
  leaguesChecked: number;
  leaguesFailed: string[];
  source: string;
  cache: boolean;
  coverage: {
    openMatchday: { cataloguesChecked: number; fixtures: number; errors: number };
    openLigaDB: { competitionsChecked: number; fixtures: number; errors: number };
    openFootball: { feedsChecked: number; fixtures: number; errors: number };
  };
}
export async function scanTodayEuropeanFixtures(force = false): Promise<FixtureScan> {
  const date = brusselsDate();
  if (!force) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as FixtureScan & { cachedAt: number };
        if (data.date === date && Date.now() - data.cachedAt < CACHE_MS) return { ...data, cache: true };
      }
    } catch { /* ignore invalid cache */ }
  }

  const errors: string[] = [];
  const byKey = new Map<string, FreeFixture>();
  let generatedAt = new Date().toISOString();
  let openMatchdayChecked = 0;
  let openLigaChecked = 0;
  let openFootballChecked = 0;
  let openMatchdayFixturesFound = 0;
  let openLigaFixturesFound = 0;
  let openFootballFixturesFound = 0;

  // Source 1: every European folder in open-matchday, including cups and youth competitions.
  try {
    const index = JSON.parse(await fetchText(`${ROOT}/build_summary.json`)) as LeagueIndex;
    generatedAt = index.generated_utc;
    const leagues = index.leagues.filter(league => {
      return isEuropeanCompetitionFolder(league.folder) && league.fixtures > 0;
    });
    openMatchdayChecked = leagues.length;
    const responses = await pooled(leagues, 8, async league => {
      const folder = league.folder.replace(/^data\//, "");
      try {
        const csv = await fetchText(`${ROOT}/${league.folder}/fixtures_${seasonCode(date)}.csv`);
        const fixtures = parseCsv(csv).filter(row => row.date === date && row.home && row.away).map(row => ({
          id: `open-matchday|${folder}|${row.gw}|${row.date}|${row.time}|${row.home}|${row.away}`,
          competition: league.league,
          countryCode: folder.split("_")[0],
          leagueFolder: folder,
          date: row.date,
          time: row.time || "—",
          home: row.home,
          away: row.away,
          source: "open-matchday",
          sourceUpdatedAt: index.generated_utc,
        } satisfies FreeFixture));
        return { fixtures, error: "" };
      } catch (error) {
        return { fixtures: [] as FreeFixture[], error: `open-matchday · ${league.league}: ${error instanceof Error ? error.message : "błąd źródła"}` };
      }
    });
    for (const response of responses) {
      if (response.error) errors.push(response.error);
      openMatchdayFixturesFound += response.fixtures.length;
      for (const fixture of response.fixtures) byKey.set(fixtureKey(fixture.date, fixture.home, fixture.away), fixture);
    }
  } catch (error) {
    errors.push(`open-matchday · ${error instanceof Error ? error.message : "indeks niedostępny"}`);
  }

  // Source 2: OpenLigaDB's season catalogue and match feeds. Respect its 60 req/min fair-use limit.
  try {
    const seasonYears = openLigaSeasonYears(date);
    const catalogues = await Promise.all(seasonYears.map(async seasonYear => {
      try { return await fetchJson<OpenLigaLeague[]>(`${OPENLIGA}/leagues/${seasonYear}`); }
      catch (error) {
        errors.push(`OpenLigaDB · katalog ${seasonYear}: ${error instanceof Error ? error.message : "błąd źródła"}`);
        return [];
      }
    }));
    const leagueMap = new Map<string, OpenLigaLeague>();
    for (const league of catalogues.flat().filter(isEuropeanOpenLiga)) {
      const key = `${league.leagueShortcut ?? ""}|${league.leagueSeason ?? ""}`;
      if (key !== "|") leagueMap.set(key, league);
    }
    const leagues = [...leagueMap.values()];
    if (seasonYears.every((_, index) => catalogues[index].length === 0)) throw new Error("Brak dostępnego katalogu sezonów");
    let nextRequestAt = 0;
    const throttledMatches = await pooled(leagues, 4, async league => {
      const wait = Math.max(0, nextRequestAt - Date.now());
      nextRequestAt = Math.max(Date.now(), nextRequestAt) + 1050;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      const shortcut = league.leagueShortcut ?? "";
      const season = league.leagueSeason ?? String(seasonYears[0]);
      try {
        const matches = await fetchJson<OpenLigaMatch[]>(`${OPENLIGA}/matches/${encodeURIComponent(shortcut)}/${encodeURIComponent(season)}`);
        const fixtures = matches.flatMap(match => {
          const kickoff = match.matchDateTimeUTC || match.matchDateTime;
          const home = match.team1?.teamName?.trim();
          const away = match.team2?.teamName?.trim();
          if (!kickoff || !home || !away) return [];
          const local = brusselsParts(new Date(kickoff));
          if (local.date !== date) return [];
          return [{
            id: `openligadb|${match.matchID ?? shortcut + "|" + kickoff + "|" + home + "|" + away}`,
            competition: match.leagueName || league.leagueName || shortcut,
            countryCode: "EU",
            leagueFolder: "",
            leagueShortcut: shortcut,
            leagueSeason: season,
            date: local.date,
            time: local.time,
            home,
            away,
            source: "OpenLigaDB",
            sourceUpdatedAt: match.lastUpdateDateTime || "not provided by OpenLigaDB",
          } satisfies FreeFixture];
        });
        cacheOpenLigaTeamForms(matches, fixtures.flatMap(fixture => [fixture.home, fixture.away]), shortcut, season, date);
        return { fixtures, error: "" };
      } catch (error) {
        return { fixtures: [] as FreeFixture[], error: `OpenLigaDB · ${league.leagueName || shortcut}: ${error instanceof Error ? error.message : "błąd źródła"}` };
      }
    });
    openLigaChecked = leagues.length;
    for (const response of throttledMatches) {
      if (response.error) errors.push(response.error);
      openLigaFixturesFound += response.fixtures.length;
      for (const fixture of response.fixtures) {
        const key = fixtureKey(fixture.date, fixture.home, fixture.away);
        const existing = byKey.get(key);
        if (existing) existing.source = `${existing.source} + OpenLigaDB`;
        else byKey.set(key, fixture);
      }
    }
  } catch (error) {
    errors.push(`OpenLigaDB · ${error instanceof Error ? error.message : "katalog niedostępny"}`);
  }

  // Source 3: OpenFootball public-domain current-season datasets across additional European countries.
  try {
    const openFootball = await scanOpenFootball(date, force);
    openFootballChecked = openFootball.checked;
    openFootballFixturesFound = openFootball.fixtures.length;
    errors.push(...openFootball.failed.map(error => `openfootball · ${error}`));
    for (const fixture of openFootball.fixtures) {
      const key = fixtureKey(fixture.date, fixture.home, fixture.away);
      const existing = byKey.get(key);
      if (existing) {
        existing.source = `${existing.source} + openfootball`;
        existing.openFootballFeedId = fixture.feedId;
      } else byKey.set(key, { ...fixture, leagueFolder: "", openFootballFeedId: fixture.feedId });
    }
  } catch (error) {
    errors.push(`openfootball · ${error instanceof Error ? error.message : "katalog niedostępny"}`);
  }

  const fixtures = [...byKey.values()].sort((a,b) => a.time.localeCompare(b.time) || a.competition.localeCompare(b.competition));
  const result: FixtureScan = {
    date,
    generatedAt,
    fixtures,
    leaguesChecked: openMatchdayChecked + openLigaChecked + openFootballChecked,
    leaguesFailed: errors,
    source: SOURCE,
    cache: false,
    coverage: {
      openMatchday: { cataloguesChecked: openMatchdayChecked, fixtures: openMatchdayFixturesFound, errors: errors.filter(error => error.startsWith("open-matchday ·")).length },
      openLigaDB: { competitionsChecked: openLigaChecked, fixtures: openLigaFixturesFound, errors: errors.filter(error => error.startsWith("OpenLigaDB ·")).length },
      openFootball: { feedsChecked: openFootballChecked, fixtures: openFootballFixturesFound, errors: errors.filter(error => error.startsWith("openfootball ·")).length },
    },
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, cachedAt: Date.now() })); } catch { /* storage may be full */ }
  return result;
}
