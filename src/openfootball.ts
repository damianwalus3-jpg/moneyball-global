export interface OpenFootballFeed {
  id: string;
  countryCode: string;
  competition: string;
  urlForSeason: (seasonFolder: string) => string;
  timeZone: string;
}
export interface OpenFootballFixture {
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
const MONTHS: Record<string, number> = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
const CACHE_KEY = "moneyball.openfootball.v1:";
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
export function parseOpenFootballFixtures(text: string, feed: OpenFootballFeed, targetDate: string): OpenFootballFixture[] {
  const seasonYear=seasonStart(targetDate);
  let currentDate="";
  const output: OpenFootballFixture[]=[];
  for (const raw of text.replace(/^\uFEFF/,"").split(/\r?\n/)) {
    const parsedDate=dateFromLine(raw,seasonYear);
    if (parsedDate) { currentDate=parsedDate; continue; }
    if (!currentDate || currentDate!==targetDate) continue;
    const line=raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("=") || line.startsWith("▪") || line.startsWith("(")) continue;
    let time="—", home="", away="";
    const withV=line.match(/^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)(?:\s{2,}\d+-\d+(?:\s+\([^)]+\))?.*)?$/);
    const withScore=line.match(/^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+(\d+)-(\d+)(?:\s+\([^)]+\))?\s+(.+?)\s*$/);
    if (withV) {
      time=withV[1] ?? "—"; home=withV[2].trim(); away=withV[3].trim();
    } else if (withScore) {
      time=withScore[1] ?? "—"; home=withScore[2].trim(); away=withScore[5].trim();
    } else continue;
    if (!home || !away || home.length>90 || away.length>90) continue;
    const kickoff=localKickoffToBrussels(currentDate,time,feed.timeZone);
    output.push({
      id:`openfootball|${feed.id}|${kickoff.date}|${time}|${home}|${away}`,
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
async function fetchText(url: string): Promise<string> {
  const response=await fetch(url,{headers:{Accept:"text/plain"}});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
export interface OpenFootballScan {
  fixtures: OpenFootballFixture[];
  checked: number;
  failed: string[];
}
export async function scanOpenFootball(date: string, force = false): Promise<OpenFootballScan> {
  const cacheKey=CACHE_KEY+date;
  if (!force) {
    try {
      const cached=localStorage.getItem(cacheKey);
      if (cached) {
        const value=JSON.parse(cached) as OpenFootballScan & {cachedAt:number};
        if (Date.now()-value.cachedAt<CACHE_MS) return value;
      }
    } catch { /* ignore malformed cache */ }
  }
  const season=openFootballSeasonFolder(date);
  const responses=await Promise.all(FEEDS.map(async feed=>{
    try {
      const content=await fetchText(feed.urlForSeason(season));
      return {fixtures:parseOpenFootballFixtures(content,feed,date),error:""};
    } catch(error) {
      return {fixtures:[] as OpenFootballFixture[],error:`${feed.competition}: ${error instanceof Error?error.message:"source error"}`};
    }
  }));
  const result:OpenFootballScan={
    fixtures:responses.flatMap(response=>response.fixtures),
    checked:FEEDS.length,
    failed:responses.map(response=>response.error).filter(Boolean),
  };
  try { localStorage.setItem(cacheKey,JSON.stringify({...result,cachedAt:Date.now()})); } catch { /* cache optional */ }
  return result;
}
