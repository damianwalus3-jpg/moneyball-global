export interface OpenFootballFeed {
  id: string;
  countryCode: string;
  competition: string;
  urlForSeason: (seasonFolder: string) => string;
  timeZone: string;
}
export interface OpenFootballFixture {
  id: string;
  feedId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  competition: string;
  countryCode: string;
  date: string;
  time: string;
  home: string;
  away: string;
  source: string;
  sourceUpdatedAt: string;
}
const FEEDS: OpenFootballFeed[] = [
  { id:"europe-france-1", countryCode:"FRA", competition:"France · Ligue 1", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/france/${s}_fr1.txt`, timeZone:"Europe/Paris" },
  { id:"europe-greece-1", countryCode:"GRE", competition:"Greece · Super League", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/greece/${s}_gr1.txt`, timeZone:"Europe/Athens" },
  { id:"europe-netherlands-1", countryCode:"NED", competition:"Netherlands · Eredivisie", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/netherlands/${s}_nl1.txt`, timeZone:"Europe/Amsterdam" },
  { id:"europe-portugal-1", countryCode:"POR", competition:"Portugal · Primeira Liga", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/portugal/${s}_pt1.txt`, timeZone:"Europe/Lisbon" },
  { id:"europe-scotland-1", countryCode:"SCO", competition:"Scotland · Premiership", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/scotland/${s}_sco1.txt`, timeZone:"Europe/London" },
  { id:"europe-switzerland-1", countryCode:"SUI", competition:"Switzerland · Super League", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/switzerland/${s}_ch1.txt`, timeZone:"Europe/Zurich" },
  { id:"europe-turkey-1", countryCode:"TUR", competition:"Turkey · Süper Lig", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/turkey/${s}_tr1.txt`, timeZone:"Europe/Istanbul" },
  { id:"europe-czech-1", countryCode:"CZE", competition:"Czech Republic · First League", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/europe/master/czech-republic/${s}_cz1.txt`, timeZone:"Europe/Prague" },
  { id:"austria-1", countryCode:"AUT", competition:"Austria · Bundesliga", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/austria/master/${s}/1-bundesliga.txt`, timeZone:"Europe/Vienna" },
  { id:"england-1", countryCode:"ENG", competition:"England · Premier League", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/england/master/${s}/1-premierleague.txt`, timeZone:"Europe/London" },
  { id:"england-2", countryCode:"ENG", competition:"England · Championship", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/england/master/${s}/2-championship.txt`, timeZone:"Europe/London" },
  { id:"germany-1", countryCode:"GER", competition:"Germany · Bundesliga", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/deutschland/master/${s}/1-bundesliga.txt`, timeZone:"Europe/Berlin" },
  { id:"germany-2", countryCode:"GER", competition:"Germany · 2. Bundesliga", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/deutschland/master/openliga/${s}_de.2.txt`, timeZone:"Europe/Berlin" },
  { id:"germany-3", countryCode:"GER", competition:"Germany · 3. Liga", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/deutschland/master/openliga/${s}_de.3.txt`, timeZone:"Europe/Berlin" },
  { id:"germany-cup", countryCode:"GER", competition:"Germany · DFB-Pokal", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/deutschland/master/openliga/${s}_de.cup.txt`, timeZone:"Europe/Berlin" },
  { id:"spain-1", countryCode:"ESP", competition:"Spain · Primera División", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/espana/master/${s}/1-liga.txt`, timeZone:"Europe/Madrid" },
  { id:"italy-1", countryCode:"ITA", competition:"Italy · Serie A", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/italy/master/${s}/1-seriea.txt`, timeZone:"Europe/Rome" },
  { id:"belgium-1", countryCode:"BEL", competition:"Belgium · Pro League", urlForSeason:s=>`https://raw.githubusercontent.com/openfootball/belgium/master/${s}/be1.txt`, timeZone:"Europe/Brussels" },
];
const EUROPEAN_COUNTRIES: Record<string, { code: string; label: string; timeZone: string }> = {
belgium:{code:"BEL",label:"Belgium",timeZone:"Europe/Brussels"},
england:{code:"ENG",label:"England",timeZone:"Europe/London"},
germany:{code:"GER",label:"Germany",timeZone:"Europe/Berlin"},
italy:{code:"ITA",label:"Italy",timeZone:"Europe/Rome"},
spain:{code:"ESP",label:"Spain",timeZone:"Europe/Madrid"},
albania:{code:"ALB",label:"Albania",timeZone:"Europe/Tirane"},
andorra:{code:"AND",label:"Andorra",timeZone:"Europe/Andorra"},
armenia:{code:"ARM",label:"Armenia",timeZone:"Asia/Yerevan"},
azerbaijan:{code:"AZE",label:"Azerbaijan",timeZone:"Asia/Baku"},
belarus:{code:"BLR",label:"Belarus",timeZone:"Europe/Minsk"},
"bosnia-herzegovina":{code:"BIH",label:"Bosnia and Herzegovina",timeZone:"Europe/Sarajevo"},
bulgaria:{code:"BUL",label:"Bulgaria",timeZone:"Europe/Sofia"},
croatia:{code:"CRO",label:"Croatia",timeZone:"Europe/Zagreb"},
cyprus:{code:"CYP",label:"Cyprus",timeZone:"Asia/Nicosia"},
"czech-republic":{code:"CZE",label:"Czech Republic",timeZone:"Europe/Prague"},
denmark:{code:"DEN",label:"Denmark",timeZone:"Europe/Copenhagen"},
estonia:{code:"EST",label:"Estonia",timeZone:"Europe/Tallinn"},
"faroe-islands":{code:"FRO",label:"Faroe Islands",timeZone:"Atlantic/Faroe"},
finland:{code:"FIN",label:"Finland",timeZone:"Europe/Helsinki"},
france:{code:"FRA",label:"France",timeZone:"Europe/Paris"},
georgia:{code:"GEO",label:"Georgia",timeZone:"Asia/Tbilisi"},
greece:{code:"GRE",label:"Greece",timeZone:"Europe/Athens"},
gibraltar:{code:"GIB",label:"Gibraltar",timeZone:"Europe/Gibraltar"},
hungary:{code:"HUN",label:"Hungary",timeZone:"Europe/Budapest"},
iceland:{code:"ISL",label:"Iceland",timeZone:"Atlantic/Reykjavik"},
ireland:{code:"IRE",label:"Ireland",timeZone:"Europe/Dublin"},
kosovo:{code:"KOS",label:"Kosovo",timeZone:"Europe/Belgrade"},
latvia:{code:"LVA",label:"Latvia",timeZone:"Europe/Riga"},
liechtenstein:{code:"LIE",label:"Liechtenstein",timeZone:"Europe/Vaduz"},
lithuania:{code:"LTU",label:"Lithuania",timeZone:"Europe/Vilnius"},
luxembourg:{code:"LUX",label:"Luxembourg",timeZone:"Europe/Luxembourg"},
malta:{code:"MLT",label:"Malta",timeZone:"Europe/Malta"},
moldova:{code:"MDA",label:"Moldova",timeZone:"Europe/Chisinau"},
montenegro:{code:"MNE",label:"Montenegro",timeZone:"Europe/Podgorica"},
netherlands:{code:"NED",label:"Netherlands",timeZone:"Europe/Amsterdam"},
"north-macedonia":{code:"MKD",label:"North Macedonia",timeZone:"Europe/Skopje"},
"northern-ireland":{code:"NIR",label:"Northern Ireland",timeZone:"Europe/London"},
norway:{code:"NOR",label:"Norway",timeZone:"Europe/Oslo"},
poland:{code:"POL",label:"Poland",timeZone:"Europe/Warsaw"},
portugal:{code:"POR",label:"Portugal",timeZone:"Europe/Lisbon"},
romania:{code:"ROU",label:"Romania",timeZone:"Europe/Bucharest"},
russia:{code:"RUS",label:"Russia",timeZone:"Europe/Moscow"},
"san-marino":{code:"SMR",label:"San Marino",timeZone:"Europe/Rome"},
scotland:{code:"SCO",label:"Scotland",timeZone:"Europe/London"},
serbia:{code:"SRB",label:"Serbia",timeZone:"Europe/Belgrade"},
slovakia:{code:"SVK",label:"Slovakia",timeZone:"Europe/Bratislava"},
slovenia:{code:"SVN",label:"Slovenia",timeZone:"Europe/Ljubljana"},
sweden:{code:"SWE",label:"Sweden",timeZone:"Europe/Stockholm"},
switzerland:{code:"SUI",label:"Switzerland",timeZone:"Europe/Zurich"},
turkey:{code:"TUR",label:"Turkey",timeZone:"Europe/Istanbul"},
ukraine:{code:"UKR",label:"Ukraine",timeZone:"Europe/Kyiv"},
wales:{code:"WAL",label:"Wales",timeZone:"Europe/London"},
};
interface OpenFootballTreeEntry { path: string; type: string }
interface OpenFootballTree { tree?: OpenFootballTreeEntry[]; truncated?: boolean }
const discoveredFeedRegistry = new Map<string, OpenFootballFeed>();
let discoveredCatalogueCache: { season: string; cachedAt: number; feeds: OpenFootballFeed[] } | null = null;
let discoveredCatalogueFailures: string[] = [];

export function mergeOpenFootballCatalogueResults(
  results: Array<{ repository: string; feeds: OpenFootballFeed[] } | { repository: string; error: string }>,
): { feeds: OpenFootballFeed[]; failed: string[] } {
  const feeds = new Map<string, OpenFootballFeed>();
  const failed: string[] = [];
  for (const result of results) {
    if ("error" in result) {
      failed.push(result.repository + " catalogue: " + result.error);
      continue;
    }
    for (const feed of result.feeds) feeds.set(feed.id, feed);
  }
  return { feeds: [...feeds.values()], failed };
}

export function buildEuropeanOpenFootballFeeds(paths: string[], date: string): OpenFootballFeed[] {
  const season = openFootballSeasonFolder(date);
  const calendarYear = date.slice(0,4);
  const output: OpenFootballFeed[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    if (parts.length !== 2 || !path.endsWith(".txt")) continue;
    const country = EUROPEAN_COUNTRIES[parts[0]];
    if (!country) continue;
    const filename = parts[1];
    const prefix = filename.startsWith(season + "_") ? season + "_" : filename.startsWith(calendarYear + "_") ? calendarYear + "_" : "";
    if (!prefix) continue;
    const competitionCode = filename.slice(prefix.length, -4);
    if (!/^[a-z0-9-]+$/i.test(competitionCode)) continue;
    const id = "openfootball-europe-" + parts[0] + "-" + filename.replace(/[^a-z0-9]+/gi,"-").toLowerCase();
    output.push({
      id, countryCode: country.code, competition: country.label + " · " + competitionCode.toUpperCase(),
      urlForSeason: () => "https://raw.githubusercontent.com/openfootball/europe/master/" + path,
      timeZone: country.timeZone,
    });
  }
  return output;
}

const NATIONAL_OPENFOOTBALL_REPOSITORIES: Record<string, { code: string; label: string; timeZone: string }> = {
  england: { code: "ENG", label: "England", timeZone: "Europe/London" },
  deutschland: { code: "GER", label: "Germany", timeZone: "Europe/Berlin" },
  italy: { code: "ITA", label: "Italy", timeZone: "Europe/Rome" },
  espana: { code: "ESP", label: "Spain", timeZone: "Europe/Madrid" },
  belgium: { code: "BEL", label: "Belgium", timeZone: "Europe/Brussels" },
  austria: { code: "AUT", label: "Austria", timeZone: "Europe/Vienna" },
};

export function buildNationalOpenFootballFeeds(repository: string, paths: string[], date: string): OpenFootballFeed[] {
  const country = NATIONAL_OPENFOOTBALL_REPOSITORIES[repository];
  if (!country) return [];
  const season = openFootballSeasonFolder(date);
  return paths.flatMap(path => {
    if (!path.startsWith(season + "/") || !path.endsWith(".txt")) return [];
    const relative = path.slice(season.length + 1);
    if (!relative || relative.startsWith("rsssf/") || relative.includes("/rsssf/")) return [];
    const competitionPath = relative.slice(0, -4);
    if (!/^[a-z0-9_/-]+$/i.test(competitionPath)) return [];
    const competition = competitionPath.split("/").map(part => part.replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase())).join(" · ");
    const id = "openfootball-national-" + repository + "-" + competitionPath.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return [{
      id,
      countryCode: country.code,
      competition: country.label + " · " + competition,
      urlForSeason: () => "https://raw.githubusercontent.com/openfootball/" + repository + "/master/" + path,
      timeZone: country.timeZone,
    }];
  });
}

async function discoverEuropeanOpenFootballFeeds(date: string): Promise<OpenFootballFeed[]> {
  const season = openFootballSeasonFolder(date);
  if (discoveredCatalogueCache?.season === season && Date.now() - discoveredCatalogueCache.cachedAt < CACHE_MS) return discoveredCatalogueCache.feeds;
  const repositories = ["europe", ...Object.keys(NATIONAL_OPENFOOTBALL_REPOSITORIES)];
  const settled = await Promise.allSettled(repositories.map(async repository => {
    const response = await fetch("https://api.github.com/repos/openfootball/" + repository + "/git/trees/master?recursive=1", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "MONEYBALL-REBUILT/1.0 (+https://moneyball-global-rebuild.damianwalus3.workers.dev)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = await response.json() as { message?: string };
        detail = typeof payload.message === "string" ? payload.message.slice(0, 240) : "";
      } catch { /* response body is diagnostic only */ }
      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = response.headers.get("x-ratelimit-reset");
      const resetHint = remaining === "0" && reset ? " (rate limit reset " + new Date(Number(reset) * 1000).toISOString() + ")" : "";
      throw new Error("HTTP " + response.status + (detail ? ": " + detail : "") + resetHint);
    }
    const tree = await response.json() as OpenFootballTree;
    if (!Array.isArray(tree.tree) || tree.truncated) throw new Error("catalogue is incomplete");
    const paths = tree.tree.filter(entry => entry.type === "blob").map(entry => entry.path);
    return { repository, feeds: repository === "europe" ? buildEuropeanOpenFootballFeeds(paths, date) : buildNationalOpenFootballFeeds(repository, paths, date) };
  }));
  const results = settled.map((result, index) => result.status === "fulfilled"
    ? result.value
    : { repository: repositories[index], error: result.reason instanceof Error ? result.reason.message : "request failed" });
  const merged = mergeOpenFootballCatalogueResults(results);
  if (merged.failed.length && merged.feeds.length === 0) throw new Error(merged.failed.join("; "));
  discoveredCatalogueFailures = merged.failed;
  const feeds = merged.feeds;
  for (const feed of feeds) discoveredFeedRegistry.set(feed.id, feed);
  discoveredCatalogueCache = { season, cachedAt: Date.now(), feeds };
  return feeds;
}
const MONTHS: Record<string, number> = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_KEY = "moneyball.openfootball.v2:";
const CACHE_MS = 15 * 60 * 1000;

function seasonStart(date: string): number {
  const year = Number(date.slice(0,4)), month = Number(date.slice(5,7));
  return month >= 7 ? year : year - 1;
}
export function openFootballSeasonFolder(date: string): string {
  const start = seasonStart(date);
  return `${start}-${String((start + 1) % 100).padStart(2,"0")}`;
}
function brusselsParts(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const get=(key:string)=>parts.find(part=>part.type===key)?.value ?? "";
  return { date:`${get("year")}-${get("month")}-${get("day")}`, time:`${get("hour")}:${get("minute")}` };
}
function localKickoffToBrussels(date: string, time: string, timeZone: string): { date: string; time: string } {
  if (!/^\d{2}:\d{2}$/.test(time)) return { date, time:"—" };
  const [year,month,day]=date.split("-").map(Number);
  const [hour,minute]=time.split(":").map(Number);
  const naive=Date.UTC(year,month-1,day,hour,minute);
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,timeZoneName:"shortOffset",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date(naive));
  const label=parts.find(part=>part.type==="timeZoneName")?.value ?? "GMT";
  const match=label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offset=match ? (match[1]==="-"?-1:1)*(Number(match[2])*60+Number(match[3]??0)) : 0;
  return brusselsParts(new Date(naive-offset*60000));
}
function dateFromLine(line: string, seasonStartYear: number): string | null {
  const match=line.trim().match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (!match) return null;
  const month=MONTHS[match[1]];
  const year=match[3] ? Number(match[3]) : month>=7 ? seasonStartYear : seasonStartYear+1;
  return `${year}-${String(month).padStart(2,"0")}-${String(Number(match[2])).padStart(2,"0")}`;
}
export function parseOpenFootballMatches(text: string, feed: OpenFootballFeed, targetDate?: string, seasonReferenceDate?: string): OpenFootballFixture[] {
  const seasonYear=seasonStart(seasonReferenceDate ?? targetDate ?? brusselsParts(new Date()).date);
  let currentDate="";
  const output: OpenFootballFixture[]=[];
  for (const raw of text.replace(/^\uFEFF/,"").split(/\r?\n/)) {
    const parsedDate=dateFromLine(raw,seasonYear);
    if (parsedDate) { currentDate=parsedDate; continue; }
    if (!currentDate || (targetDate && currentDate!==targetDate)) continue;
    const line=raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("=") || line.startsWith("▪") || line.startsWith("(")) continue;
    let time="—", home="", away="", homeGoals:number|null=null, awayGoals:number|null=null;
    const withV=line.match(/^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)(?:\s{2,}(\d+)-(\d+)(?:\s+\([^)]+\))?.*)?$/);
    const withScore=line.match(/^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+(\d+)-(\d+)(?:\s+\([^)]+\))?\s+(.+?)\s*$/);
    if (withV) {
      time=withV[1] ?? "—"; home=withV[2].trim(); away=withV[3].trim();
      if (withV[4] !== undefined && withV[5] !== undefined) { homeGoals=Number(withV[4]); awayGoals=Number(withV[5]); }
    } else if (withScore) {
      time=withScore[1] ?? "—"; home=withScore[2].trim(); homeGoals=Number(withScore[3]); awayGoals=Number(withScore[4]); away=withScore[5].trim();
    } else continue;
    if (!home || !away || home.length>90 || away.length>90) continue;
    const kickoff=localKickoffToBrussels(currentDate,time,feed.timeZone);
    output.push({
      id:`openfootball|${feed.id}|${kickoff.date}|${time}|${home}|${away}`,
      feedId:feed.id,
      homeGoals,awayGoals,
      competition:feed.competition,
      countryCode:feed.countryCode,
      date:kickoff.date,
      time:kickoff.time,
      home,away,
      source:"openfootball",
      sourceUpdatedAt:"dataset does not expose a per-file update timestamp",
    });
  }
  return output;
}
export function parseOpenFootballFixtures(text: string, feed: OpenFootballFeed, targetDate: string): OpenFootballFixture[] {
  return parseOpenFootballMatches(text, feed, targetDate);
}
async function fetchText(url: string): Promise<string> {
  const response=await fetch(url,{headers:{Accept:"text/plain"},signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
const feedTextCache = new Map<string, { promise: Promise<string>; cachedAt: number }>();
async function loadFeedText(feed: OpenFootballFeed, season: string, force = false): Promise<string> {
  const key = `${feed.id}:${season}`;
  const cached = feedTextCache.get(key);
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_MS) return cached.promise;
  const promise = fetchText(feed.urlForSeason(season));
  feedTextCache.set(key, { promise, cachedAt: Date.now() });
  try { return await promise; }
  catch (error) { feedTextCache.delete(key); throw error; }
}

export interface OpenFootballFormMatch {
  date: string;
  opponent: string;
  venue: "H" | "A";
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  points: number;
}
export interface OpenFootballTeamForm {
  team: string;
  matches: OpenFootballFormMatch[];
  home: OpenFootballFormMatch[];
  away: OpenFootballFormMatch[];
  source: string;
  sourceUpdatedAt: string;
}
function normalizeTeamName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function findFeed(feedId: string): OpenFootballFeed {
  const feed=discoveredFeedRegistry.get(feedId) ?? FEEDS.find(item=>item.id===feedId);
  if (!feed) throw new Error("Nieznany kanał OpenFootball");
  return feed;
}
export async function loadOpenFootballRecentTeamForm(feedId: string, team: string, beforeDate: string): Promise<OpenFootballTeamForm> {
  const feed=findFeed(feedId);
  const season=openFootballSeasonFolder(beforeDate);
  const key=`moneyball.openfootball-form.v1:${feedId}:${season}:${normalizeTeamName(team)}:${beforeDate}`;
  try {
    const cached=localStorage.getItem(key);
    if (cached) {
      const parsed=JSON.parse(cached) as OpenFootballTeamForm & {cachedAt:number};
      if (Date.now()-parsed.cachedAt<6*60*60*1000) return parsed;
    }
  } catch { /* ignore malformed cache */ }
  const text=await loadFeedText(feed,season);
  const target=normalizeTeamName(team);
  const matches=parseOpenFootballMatches(text,feed,undefined,beforeDate).flatMap(match=>{
    if (match.date>=beforeDate || match.homeGoals===null || match.awayGoals===null) return [];
    const isHome=normalizeTeamName(match.home)===target;
    const isAway=normalizeTeamName(match.away)===target;
    if (!isHome&&!isAway) return [];
    const goalsFor=isHome?match.homeGoals:match.awayGoals;
    const goalsAgainst=isHome?match.awayGoals:match.homeGoals;
    const result:OpenFootballFormMatch["result"]=goalsFor>goalsAgainst?"W":goalsFor===goalsAgainst?"D":"L";
    return [{date:match.date,opponent:isHome?match.away:match.home,venue:isHome?"H" as const:"A" as const,goalsFor,goalsAgainst,result,points:result==="W"?3:result==="D"?1:0}];
  }).sort((a,b)=>b.date.localeCompare(a.date));
  const form:OpenFootballTeamForm={
    team,
    matches:matches.slice(0,15),
    home:matches.filter(match=>match.venue==="H").slice(0,15),
    away:matches.filter(match=>match.venue==="A").slice(0,15),
    source:`OpenFootball · ${feed.competition}`,
    sourceUpdatedAt:"dataset does not expose a per-file update timestamp",
  };
  try { localStorage.setItem(key,JSON.stringify({...form,cachedAt:Date.now()})); } catch { /* cache optional */ }
  return form;
}
export interface OpenFootballVerifiedResult {
  actual:"1"|"X"|"2";
  homeGoals:number;
  awayGoals:number;
  date:string;
  source:string;
}
export async function findOpenFootballFixtureResult(feedId:string,home:string,away:string,date:string):Promise<OpenFootballVerifiedResult|null>{
  const feed=findFeed(feedId);
  const text=await loadFeedText(feed,openFootballSeasonFolder(date));
  const homeKey=normalizeTeamName(home),awayKey=normalizeTeamName(away);
  const match=parseOpenFootballMatches(text,feed,date).find(item=>normalizeTeamName(item.home)===homeKey&&normalizeTeamName(item.away)===awayKey&&item.homeGoals!==null&&item.awayGoals!==null);
  if(!match||match.homeGoals===null||match.awayGoals===null)return null;
  return {actual:match.homeGoals>match.awayGoals?"1":match.homeGoals===match.awayGoals?"X":"2",homeGoals:match.homeGoals,awayGoals:match.awayGoals,date,source:"OpenFootball public-domain feed"};
}
export interface OpenFootballScan {
  fixtures: OpenFootballFixture[];
  checked: number;
  failed: string[];
}
export async function scanOpenFootball(date: string, force = false): Promise<OpenFootballScan> {
  const cacheKey=CACHE_KEY+date;
  const season=openFootballSeasonFolder(date);
  let discovered: OpenFootballFeed[] = [];
  let catalogueError = "";
  try {
    discovered = await discoverEuropeanOpenFootballFeeds(date);
    if (discoveredCatalogueFailures.length) catalogueError = "OpenFootball partial catalogue: " + discoveredCatalogueFailures.join("; ");
  } catch(error) {
    catalogueError = "OpenFootball Europe catalogue: " + (error instanceof Error ? error.message : "catalogue unavailable");
  }
  if (!force) {
    try {
      const cached=localStorage.getItem(cacheKey);
      if (cached) {
        const value=JSON.parse(cached) as OpenFootballScan & {cachedAt:number};
        if (Date.now()-value.cachedAt<CACHE_MS) return {
          ...value,
          checked: value.checked + (catalogueError ? 1 : 0),
          failed: [...value.failed, ...(catalogueError ? [catalogueError] : [])],
        };
      }
    } catch { /* ignore malformed cache */ }
  }
  const feedMap = new Map<string, OpenFootballFeed>();
  for (const feed of [...FEEDS, ...discovered]) feedMap.set(feed.id, feed);
  const feeds = [...feedMap.values()];
  const responses=await Promise.all(feeds.map(async feed=>{
    try {
      const content=await loadFeedText(feed,season,force);
      return {fixtures:parseOpenFootballFixtures(content,feed,date),error:""};
    } catch(error) {
      return {fixtures:[] as OpenFootballFixture[],error:feed.competition + ": " + (error instanceof Error?error.message:"source error")};
    }
  }));
  const result:OpenFootballScan={
    fixtures:responses.flatMap(response=>response.fixtures),
    checked:feeds.length + (catalogueError ? 1 : 0),
    failed:[catalogueError, ...responses.map(response=>response.error)].filter(Boolean),
  };
  try { localStorage.setItem(cacheKey,JSON.stringify({...result,cachedAt:Date.now()})); } catch { /* cache optional */ }
  return result;
}
