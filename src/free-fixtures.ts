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
const SOURCE = "FootyNomad + open-matchday + OpenLigaDB + openfootball + ESPN (publiczne terminarze)";
const EUROPE = new Set(["ENG","ESP","GER","ITA","FRA","NED","POR","BEL","SCO","AUT","SUI","TUR","GRE","DEN","SWE","NOR","ROU","RUS","IRE","POL","WAL","NIR","CRO","CZE","UKR","CYP","SVK","SVN","FIN","KAZ","ALB","SRB","BIH","BUL","HUN","ISL","LUX","MLT","EST","LVA","LTU","MDA","GEO","ARM","AZE","MKD","MNE","AND","FRO","GIB","ISR","KOS","BLR","LIE","SMR","MCO","VAT","UEFA"]);
const CACHE_KEY = "moneyball.free-fixtures.v10";
const CACHE_MS = 15 * 60 * 1000;
const COUNTRY_NAMES = [
  "england","scotland","wales","northern ireland","ireland","france","germany","italy","spain","portugal","netherlands","belgium","austria","switzerland","turkey","greece","denmark","sweden","norway","romania","poland","croatia","czech","ukraine","cyprus","slovakia","slovenia","finland","kazakhstan","albania","serbia","bosnia","bulgaria","hungary","iceland","luxembourg","malta","estonia","latvia","lithuania","moldova","georgia","armenia","azerbaijan","macedonia","montenegro","andorra","faroe","gibraltar","israel","kosovo","belarus","liechtenstein","san marino","monaco","vatican","uefa","deutschland","österreich"
];
const OPENLIGA_EXCLUDED_SHORTCUTS = new Set(["bl1test", "blclaude", "bl12026"]);
const EUROPEAN_COUNTRY_SHORTCUTS = new Set(["eng","esp","ita","fra","ned","por","bel","sco","aut","sui","tur","gre","den","swe","nor","rou","rus","irl","pol","wal","nir","cro","cze","ukr","cyp","svk","svn","fin","kaz","alb","srb","bih","bul","hun","isl","lux","mlt","est","lva","ltu","mda","geo","arm","aze","mkd","mne","and","fro","gib","isr","kos","blr","lie","smr","mco","vat","fr","nl","pt","gr","ch","cz","tr","at","dk","se","no","ro","ie","hr","ua","cy","sk","si","fi","hu","bg","rs","ba","is","lu","mt","ee","lv","lt","md","ge","am","az","mk","me","ad","fo","gi","il","ko","by","li","sm"]);
const EUROPEAN_SHORTCUT_PREFIXES = [
  "bl","dfb","rl","ol","vl","ll","kl","kreisliga","oberliga","landesliga","verbandsliga","bezirksliga",
  "uefa","ucl","uel","uecl","premierleague","laliga","ligue1","eredivisie","primeiraliga","championsleague","europaleague","conferenceleague","proleague","nofv","regio","thüli","ffb","ere","öbl","oh","pl","wsc","la1","nla","unl","u21dfb","fna","wcl"
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
  const countryCodeFeed = [...EUROPEAN_COUNTRY_SHORTCUTS].some(code => new RegExp("^" + code + "(?:[0-9]|[-_])").test(shortcut));
  const namedFeed = EUROPEAN_SHORTCUT_PREFIXES.some(prefix => shortcut === prefix || shortcut.startsWith(prefix));
  const startsWithCountryCode = [...EUROPEAN_COUNTRY_SHORTCUTS].some(code => shortcut.startsWith(code));
  if (startsWithCountryCode && !countryCodeFeed && !namedFeed) return false;
  return countryCodeFeed || namedFeed;
}
const OPENLIGA_COUNTRY_NAME_CODES: Array<[string, string]> = [
  ["northern ireland", "NIR"], ["bosnia and herzegovina", "BIH"], ["north macedonia", "MKD"],
  ["faroe islands", "FRO"], ["san marino", "SMR"], ["liechtenstein", "LIE"],
  ["netherlands", "NED"], ["england", "ENG"], ["scotland", "SCO"], ["wales", "WAL"],
  ["ireland", "IRE"], ["france", "FRA"], ["germany", "GER"], ["deutschland", "GER"], ["osterreich", "AUT"], ["italy", "ITA"],
  ["spain", "ESP"], ["portugal", "POR"], ["belgium", "BEL"], ["austria", "AUT"],
  ["switzerland", "SUI"], ["turkey", "TUR"], ["greece", "GRE"], ["denmark", "DEN"],
  ["sweden", "SWE"], ["norway", "NOR"], ["romania", "ROU"], ["poland", "POL"],
  ["croatia", "CRO"], ["czech republic", "CZE"], ["czechia", "CZE"], ["ukraine", "UKR"],
  ["cyprus", "CYP"], ["slovakia", "SVK"], ["slovenia", "SVN"], ["finland", "FIN"],
  ["kazakhstan", "KAZ"], ["albania", "ALB"], ["serbia", "SRB"], ["bosnia", "BIH"],
  ["bulgaria", "BUL"], ["hungary", "HUN"], ["iceland", "ISL"], ["luxembourg", "LUX"],
  ["malta", "MLT"], ["estonia", "EST"], ["latvia", "LVA"], ["lithuania", "LTU"],
  ["moldova", "MDA"], ["georgia", "GEO"], ["armenia", "ARM"], ["azerbaijan", "AZE"],
  ["montenegro", "MNE"], ["andorra", "AND"], ["gibraltar", "GIB"], ["israel", "ISR"],
  ["kosovo", "KOS"], ["belarus", "BLR"], ["monaco", "MCO"], ["vatican", "VAT"],
  ["russia", "RUS"], ["macedonia", "MKD"],
];
const OPENLIGA_SHORTCUT_COUNTRY_CODES: Record<string, string> = {
  eng: "ENG", esp: "ESP", ger: "GER", ita: "ITA", fra: "FRA", ned: "NED", por: "POR",
  bel: "BEL", sco: "SCO", aut: "AUT", sui: "SUI", tur: "TUR", gre: "GRE", den: "DEN",
  swe: "SWE", nor: "NOR", rou: "ROU", rus: "RUS", irl: "IRE", pol1: "POL", cro: "CRO",
  cze: "CZE", ukr: "UKR", cyp: "CYP", svk: "SVK", svn: "SVN", fin: "FIN", kaz: "KAZ",
  alb: "ALB", srb: "SRB", bih: "BIH", bul: "BUL", hun: "HUN", isl: "ISL", lux: "LUX",
  mlt: "MLT", est: "EST", lva: "LVA", ltu: "LTU", mda: "MDA", geo: "GEO", arm: "ARM",
  aze: "AZE", mkd: "MKD", mne: "MNE", and: "AND", fro: "FRO", gib: "GIB", isr: "ISR",
  kos: "KOS", blr: "BLR", lie: "LIE", smr: "SMR", fr: "FRA", nl: "NED", pt: "POR",
  gr: "GRE", ch: "SUI", cz: "CZE", tr: "TUR", at: "AUT", dk: "DEN", se: "SWE",
  no: "NOR", ro: "ROU", ie: "IRE", hr: "CRO", ua: "UKR", cy: "CYP", sk: "SVK",
  si: "SVN", fi: "FIN", hu: "HUN", bg: "BUL", rs: "SRB", ba: "BIH", is: "ISL",
  lu: "LUX", mt: "MLT", ee: "EST", lv: "LVA", lt: "LTU", md: "MDA", ge: "GEO",
  am: "ARM", az: "AZE", mk: "MKD", me: "MNE", ad: "AND", fo: "FRO", gi: "GIB",
  il: "ISR", ko: "KOS", by: "BLR", li: "LIE", sm: "SMR", pl1: "POL",
  bl: "GER", la1: "ESP", ere: "NED", obl: "AUT", wcl: "UEFA", ucl: "UEFA",
  uel: "UEFA", uecl: "UEFA", nla: "UEFA", unl: "UEFA", pl: "ENG",
  blo: "AUT", dfb: "GER", dfbf: "GER", dfbn: "GER", blsupercup: "GER", ffb1: "GER", ffb2: "GER",
  fna: "GER", wsc: "GER", u21dfb: "GER", nofvon: "GER", nofvos: "GER", rlno: "GER", rln: "GER",
  "regio-bayern": "GER", "rlw-frauen": "GER", "thuli-26": "GER", oh: "GER", ol1: "GER",
};
export function openLigaCountryCode(league: OpenLigaLeague): string {
  const name = (league.leagueName ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const [country, code] of OPENLIGA_COUNTRY_NAME_CODES) if (name.includes(country)) return code;
  const shortcut = (league.leagueShortcut ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (OPENLIGA_SHORTCUT_COUNTRY_CODES[shortcut]) return OPENLIGA_SHORTCUT_COUNTRY_CODES[shortcut];
  const prefix = shortcut.match(/^([a-z]{2,3})(?=\d|[-_])/i)?.[1];
  return prefix ? OPENLIGA_SHORTCUT_COUNTRY_CODES[prefix] ?? "EU" : "EU";
}

export function fixtureKey(date: string, home: string, away: string, competition = ""): string {
  const genderText = `${competition} ${home} ${away}`.toLowerCase();
  const gender = /\b(women|woman|womens|frauen|femmes|femenina|feminine|ladies|girls|wsl|wcl|w)\b/.test(genderText) ? "women" : "open";
  const aliases: Record<string, string> = {
    "oud heverlee leuven": "oh leuven",
    "inter milan": "inter",
    "internazionale": "inter",
  };
  const normalize = (value: string) => {
    const base = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/\((?:women|woman|womens)\)/g, " ")
      .replace(/\b(?:women|woman|womens|frauen|femmes|femenina|feminine|ladies|girls|w)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
      .replace(/\b(?:fc|f c|afc|a f c|cf|c f|sc|s c)$/g, "").trim();
    return aliases[base] ?? base;
  };
  return `${date}|${gender}|${normalize(home)}|${normalize(away)}`;
}
const ESPN_COUNTRIES: Record<string, string> = {
albania:"ALB", andorra:"AND", armenia:"ARM", austria:"AUT", azerbaijan:"AZE", belarus:"BLR", belgium:"BEL",
"bosnia and herzegovina":"BIH", bosnia:"BIH", bulgaria:"BUL", croatia:"CRO", cyprus:"CYP", "czech republic":"CZE", czechia:"CZE",
denmark:"DEN", england:"ENG", estonia:"EST", "faroe islands":"FRO", finland:"FIN", france:"FRA", georgia:"GEO", germany:"GER",
gibraltar:"GIB", greece:"GRE", hungary:"HUN", iceland:"ISL", ireland:"IRE", italy:"ITA", kosovo:"KOS", latvia:"LVA",
liechtenstein:"LIE", lithuania:"LTU", luxembourg:"LUX", malta:"MLT", moldova:"MDA", monaco:"MCO", montenegro:"MNE",
netherlands:"NED", "north macedonia":"MKD", "northern ireland":"NIR", norway:"NOR", poland:"POL", portugal:"POR",
romania:"ROU", russia:"RUS", "san marino":"SMR", scotland:"SCO", serbia:"SRB", slovakia:"SVK", slovenia:"SVN",
spain:"ESP", sweden:"SWE", switzerland:"SUI", turkey:"TUR", turkiye:"TUR", israel:"ISR", kazakhstan:"KAZ", "republic of ireland":"IRE", ukraine:"UKR", wales:"WAL",
};
interface ESPNCompetitor { homeAway?: string; team?: { displayName?: string; name?: string } }
interface ESPNEvent { id?: string | number; date?: string; competitions?: Array<{ altGameNote?: string; venue?: { address?: { country?: string } }; notes?: Array<{ headline?: string }>; competitors?: ESPNCompetitor[] }> }
export function espnScoreboardDatesForBrusselsDay(date: string): string[] {
  const [year, month, day] = date.split("-").map(Number);
  const previousUtcDate = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [previousUtcDate.replace(/-/g, ""), date.replace(/-/g, "")];
}
export function parseEspnEuropeanFixtures(payload: unknown, targetDate: string): FreeFixture[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { events?: unknown }).events)) throw new Error("ESPN scoreboard: nieprawidłowa odpowiedź lub brak tablicy events");
  const events = (payload as { events: ESPNEvent[] }).events;
  const output: FreeFixture[] = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    const country = (competition?.venue?.address?.country ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const countryCode = ESPN_COUNTRIES[country];
    const note = competition?.altGameNote?.trim() || competition?.notes?.find(item => item.headline?.trim())?.headline?.trim() || "";
    const europeanTournament = /\bUEFA\b|European Championship/i.test(note);
    if (!countryCode && !europeanTournament) continue;
    if (!event.date || !Number.isFinite(Date.parse(event.date))) continue;
    const kickoff = brusselsParts(new Date(event.date));
    if (kickoff.date !== targetDate) continue;
    const competitors = competition?.competitors ?? [];
    const home = competitors.find(item => item.homeAway === "home")?.team?.displayName?.trim();
    const away = competitors.find(item => item.homeAway === "away")?.team?.displayName?.trim();
    if (!home || !away) continue;
    output.push({ id: "espn|" + String(event.id ?? [targetDate, home, away].join("|")), competition: note || ("ESPN Soccer · " + (countryCode ?? "UEFA")), countryCode: countryCode ?? "UEFA", leagueFolder: "", date: kickoff.date, time: kickoff.time, home, away, source: "ESPN", sourceUpdatedAt: new Date().toISOString() });
  }
  return output;
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
    espn: { scoreboardsChecked: number; fixtures: number; errors: number };
    footyNomad: { pagesChecked: number; pageMatches: number; fixtures: number; skippedNoTimestamp: number; errors: number };
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
  let espnChecked = 0;
  let espnFixturesFound = 0;
  let footyNomadPagesChecked = 0;
  let footyNomadPageMatches = 0;
  let footyNomadFixturesFound = 0;
  let footyNomadSkippedNoTimestamp = 0;

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
      for (const fixture of response.fixtures) byKey.set(fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition), fixture);
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
            countryCode: openLigaCountryCode(league),
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
        const key = fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition);
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
      const key = fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition);
      const existing = byKey.get(key);
      if (existing) {
        existing.source = `${existing.source} + openfootball`;
        existing.openFootballFeedId = fixture.feedId;
      } else byKey.set(key, { ...fixture, leagueFolder: "", openFootballFeedId: fixture.feedId });
    }
  } catch (error) {
    errors.push(`openfootball · ${error instanceof Error ? error.message : "katalog niedostępny"}`);
  }

  // Source 4: ESPN public all-soccer daily scoreboard. Geographic venue filtering keeps Europe only.
  try {
    const scoreboardDates = espnScoreboardDatesForBrusselsDay(date);
    const scoreboardResults = await Promise.all(scoreboardDates.map(async sourceDate => {
      try {
        const payload = await fetchJson<unknown>(`/api/espn/scoreboard/${sourceDate}`);
        if (!payload || typeof payload !== "object" || !Array.isArray((payload as { events?: unknown }).events)) throw new Error("nieprawidłowa odpowiedź ESPN");
        return { payload: payload as { events: ESPNEvent[] }, error: "" };
      } catch (error) {
        return { payload: null, error: `ESPN ${sourceDate}: ${error instanceof Error ? error.message : "błąd źródła"}` };
      }
    }));
    espnChecked = scoreboardResults.filter(result => result.payload).length;
    errors.push(...scoreboardResults.map(result => result.error).filter(Boolean));
    const availableScoreboards = scoreboardResults.flatMap(result => result.payload ? [result.payload] : []);
    if (!availableScoreboards.length) throw new Error("żaden z dwóch dziennych scoreboardów nie odpowiedział poprawnie");
    const combinedEvents = availableScoreboards.flatMap(payload => payload.events);
    const espnFixtures = parseEspnEuropeanFixtures({ events: combinedEvents }, date);
    espnFixturesFound = espnFixtures.length;
    for (const fixture of espnFixtures) {
      const key = fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition);
      const existing = byKey.get(key);
      if (existing) existing.source = `${existing.source} + ESPN`;
      else byKey.set(key, fixture);
    }
  } catch (error) {
    errors.push(`ESPN · ${error instanceof Error ? error.message : "scoreboard niedostępny"}`);
  }

  // Source 5: FootyNomad public date pages. The Worker reads previous and current UTC pages,
  // then filters kickoffs to the Europe/Brussels day. Only public /fixtures/ pages are used.
  try {
    const footyNomad = await fetchJson<{ fixtures?: FreeFixture[]; pagesChecked?: number; pageMatches?: number; skippedNoTimestamp?: number; errors?: string[] }>("/api/footynomad/fixtures/" + date);
    footyNomadPagesChecked = Number(footyNomad.pagesChecked ?? 0);
    footyNomadPageMatches = Number(footyNomad.pageMatches ?? 0);
    footyNomadSkippedNoTimestamp = Number(footyNomad.skippedNoTimestamp ?? 0);
    const fixtures = Array.isArray(footyNomad.fixtures) ? footyNomad.fixtures : [];
    footyNomadFixturesFound = fixtures.length;
    errors.push(...(Array.isArray(footyNomad.errors) ? footyNomad.errors.map(error => "FootyNomad · " + error) : []));
    for (const fixture of fixtures) {
      const key = fixtureKey(fixture.date, fixture.home, fixture.away, fixture.competition);
      const existing = byKey.get(key);
      if (existing) existing.source = existing.source + " + FootyNomad";
      else byKey.set(key, fixture);
    }
  } catch (error) {
    errors.push("FootyNomad · " + (error instanceof Error ? error.message : "źródło niedostępne"));
  }
  const fixtures = [...byKey.values()].sort((a,b) => a.time.localeCompare(b.time) || a.competition.localeCompare(b.competition));
  const result: FixtureScan = {
    date,
    generatedAt,
    fixtures,
    leaguesChecked: openMatchdayChecked + openLigaChecked + openFootballChecked + espnChecked + footyNomadPagesChecked,
    leaguesFailed: errors,
    source: SOURCE,
    cache: false,
    coverage: {
      openMatchday: { cataloguesChecked: openMatchdayChecked, fixtures: openMatchdayFixturesFound, errors: errors.filter(error => error.startsWith("open-matchday ·")).length },
      openLigaDB: { competitionsChecked: openLigaChecked, fixtures: openLigaFixturesFound, errors: errors.filter(error => error.startsWith("OpenLigaDB ·")).length },
      openFootball: { feedsChecked: openFootballChecked, fixtures: openFootballFixturesFound, errors: errors.filter(error => error.startsWith("openfootball ·")).length },
      espn: { scoreboardsChecked: espnChecked, fixtures: espnFixturesFound, errors: errors.filter(error => error.startsWith("ESPN ·")).length },
      footyNomad: { pagesChecked: footyNomadPagesChecked, pageMatches: footyNomadPageMatches, fixtures: footyNomadFixturesFound, skippedNoTimestamp: footyNomadSkippedNoTimestamp, errors: errors.filter(error => error.startsWith("FootyNomad ·")).length },
    },
  };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, cachedAt: Date.now() })); } catch { /* storage may be full */ }
  return result;
}
