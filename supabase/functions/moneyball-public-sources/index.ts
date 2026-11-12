import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-requested-with, prefer, cache-control, pragma",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};
const BASE = "https://raw.githubusercontent.com/oladeeayo/open-matchday/master";
const LEAGUE_INDEX = BASE + "/LEAGUE_INDEX.md";

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}


const EUROPE_ISO3 = new Set(["ALB","AND","ARM","AUT","AZE","BLR","BEL","BIH","BUL","CRO","CYP","CZE","DNK","ENG","EST","FRO","FIN","FRA","GEO","DEU","GER","GIB","GRC","GRE","HUN","ISL","IRL","ITA","KAZ","KOS","LVA","LIE","LTU","LUX","MLT","MDA","MNE","NLD","MKD","NIR","NOR","POL","PRT","POR","ROU","RUS","SMR","SCO","SRB","SVK","SVN","ESP","SWE","CHE","SUI","TUR","UKR","WAL","GBR","UK"]);
const EUROPE_COUNTRIES = new Set(["albania","andorra","armenia","austria","azerbaijan","belarus","belgium","bosnia and herzegovina","bulgaria","croatia","cyprus","czechia","czech republic","denmark","england","estonia","faroe islands","finland","france","georgia","germany","gibraltar","greece","hungary","iceland","ireland","isle of man","italy","kazakhstan","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","northern ireland","norway","poland","portugal","romania","russia","san marino","scotland","serbia","slovakia","slovenia","spain","sweden","switzerland","turkey","türkiye","ukraine","wales","united kingdom","uk","europe","uefa"]);
const TIME_ZONE_BY_COUNTRY: Record<string,string> = {
  ENG:"Europe/London", SCO:"Europe/London", WAL:"Europe/London", NIR:"Europe/London",
  IRE:"Europe/Dublin", IRL:"Europe/Dublin", POR:"Europe/Lisbon", PRT:"Europe/Lisbon",
  TUR:"Europe/Istanbul", RUS:"Europe/Moscow", UKR:"Europe/Kyiv", CYP:"Asia/Nicosia",
  FIN:"Europe/Helsinki", EST:"Europe/Tallinn", LVA:"Europe/Riga", LTU:"Europe/Vilnius",
  GRE:"Europe/Athens", BUL:"Europe/Sofia", ROU:"Europe/Bucharest", MDA:"Europe/Chisinau",
  GEO:"Asia/Tbilisi", ARM:"Asia/Yerevan", AZE:"Asia/Baku", KAZ:"Asia/Almaty",
  ISL:"Atlantic/Reykjavik", FRO:"Atlantic/Faroe", BLR:"Europe/Minsk",
  ESP:"Europe/Madrid", FRA:"Europe/Paris", GER:"Europe/Berlin", DEU:"Europe/Berlin",
  BEL:"Europe/Brussels", NED:"Europe/Amsterdam", NLD:"Europe/Amsterdam", POL:"Europe/Warsaw",
  AUT:"Europe/Vienna", SUI:"Europe/Zurich", CHE:"Europe/Zurich", CZE:"Europe/Prague",
  SVK:"Europe/Bratislava", SVN:"Europe/Ljubljana", CRO:"Europe/Zagreb", SRB:"Europe/Belgrade",
  HUN:"Europe/Budapest", NOR:"Europe/Oslo", SWE:"Europe/Stockholm", DEN:"Europe/Copenhagen",
  DNK:"Europe/Copenhagen", ROU:"Europe/Bucharest", BUL:"Europe/Sofia", GRE:"Europe/Athens",
  GRC:"Europe/Athens", ALB:"Europe/Tirane", BIH:"Europe/Sarajevo", MNE:"Europe/Podgorica",
  MKD:"Europe/Skopje", KOS:"Europe/Belgrade", MLT:"Europe/Malta", LUX:"Europe/Luxembourg",
};
function localKickoffToIso(date:string,time:string,countryCode:string):string|null {
  const m=/^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(time);
  if(!m)return null;
  const [year,month,day]=date.split("-").map(Number),hour=Number(m[1]),minute=Number(m[2]);
  if(!year||!month||!day)return null;
  const desired=Date.UTC(year,month-1,day,hour,minute,0);
  const zone=TIME_ZONE_BY_COUNTRY[countryCode]||"Europe/Brussels";
  const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  let instant=desired;
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
    const represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    instant+=desired-represented;
  }
  return new Date(instant).toISOString();
}

function isEuropeanFixture(country: unknown, competition: unknown, home?: unknown, away?: unknown): boolean {
 const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const c=norm(country), comp=norm(competition), teams=norm(String(home??"")+" "+String(away??""));
 const countryParts=c.split(/[\\/,;|]+/).map((x:string)=>x.trim()).filter(Boolean);
 if(EUROPE_COUNTRIES.has(c)||countryParts.some((x:string)=>EUROPE_COUNTRIES.has(x)||EUROPE_ISO3.has(x.toUpperCase()))||EUROPE_ISO3.has(String(country??"").trim().toUpperCase()))return true;
 if(/\buefa\b|european (championship|qualif|league)|uefa nations|uefa champions|uefa europa|uefa conference/.test(comp))return true;
 if(/\bu20 elite league\b/.test(comp) && /\b(england|italy|portugal|czech republic|germany|france|spain|netherlands|belgium|sweden|norway|denmark|finland|iceland|poland|croatia|serbia|austria|switzerland|scotland|wales|ireland)\b/.test(teams))return true;
 return false;
}

function norm(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

const GITHUB_TEAM_HISTORY_URL = "https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/team-form.json";
function teamHistoryKey(value: unknown): string {
  return String(value ?? "").normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase()
    .replace(/\\b(fc|cf|sc|ac|afc|club)\\b/g," ")
    .replace(/\\b(women|w)\\b/g," women ")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\\s+/g," ");
}
async function readGithubTeamHistory(): Promise<any> {
  try {
    const payload = await safeJson(GITHUB_TEAM_HISTORY_URL);
    if (payload?.schema_version !== 1 || !payload?.teams || Object.keys(payload.teams).length < 100)
      throw new Error("GitHub team history schema/coverage validation failed");
    return payload;
  } catch (error) {
    return { teams: {}, error: String(error), generated_at: null, coverage: null };
  }
}
function githubTeamForm(team: string, date: string, history: any) {
  const key = teamHistoryKey(team), teams = history?.teams || {};
  let entry = teams[key];
  if (!entry) {
    const words = new Set(key.split(" ").filter((x:string)=>x.length>2));
    const candidates = Object.keys(teams).map((k:string)=>{
      const other = new Set(k.split(" ").filter((x:string)=>x.length>2));
      const score = words.size && other.size ? [...words].filter(x=>other.has(x)).length / Math.max(words.size,other.size) : 0;
      return {key:k,score};
    }).filter((x:any)=>x.score>=0.8).sort((a:any,b:any)=>b.score-a.score);
    if (candidates.length && (!candidates[1] || candidates[0].score-candidates[1].score>=0.12))
      entry=teams[candidates[0].key];
  }
  if (!Array.isArray(entry?.matches)) return null;
  const last = entry.matches.filter((x:any)=>String(x.date||"")<date)
    .sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))).slice(0,10);
  if (!last.length) return null;
  const newestMatch=Date.parse(String(last[0].date||"")+"T00:00:00Z"),target=Date.parse(date+"T00:00:00Z");
  if(!Number.isFinite(newestMatch)||!Number.isFinite(target)||target-newestMatch>240*24*60*60*1000)return null;
  const sum = (field:string) => last.reduce((total:number,x:any)=>total+Number(x[field]||0),0);
  const avg = (field:string) => {
    const values=last.map((x:any)=>x[field]).filter((x:any)=>x!==null&&x!==undefined&&Number.isFinite(Number(x)));
    return values.length ? +(values.reduce((a:number,b:any)=>a+Number(b),0)/values.length).toFixed(2) : null;
  };
  return {
    matches:last.length, last10:last, points:last.reduce((n:number,x:any)=>n+(x.result==="W"?3:x.result==="D"?1:0),0),
    goals_for:sum("goals_for"), goals_against:sum("goals_against"),
    avg_shots_for:avg("shots_for"), avg_shots_against:avg("shots_against"),
    avg_shots_on_target_for:avg("shots_on_target_for"), avg_shots_on_target_against:avg("shots_on_target_against"),
    avg_corners_for:avg("corners_for"), avg_corners_against:avg("corners_against"),
    source:"GITHUB_OPENMATCHDAY_OPENFOOTBALL_LAST10"
  };
}
function genderFromCompetition(folder:string):string {
  if (/women|womens|female|frauen|femenin|damallsvenskan|\\bwsl\\b|d1-arkema|liga-f/i.test(folder)) return "women";
  if (/mixed|coed/i.test(folder)) return "mixed";
  // National league and cup folders are men's by default unless the source labels them otherwise.
  return "men";
}

function statusFromEspn(e: any): string {
  const s = e?.competitions?.[0]?.status?.type?.state || e?.status?.type?.state;
  if (s === "in") return "live";
  if (s === "post") return "finished";
  return "scheduled";
}
async function safeJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MoneyballGlobal/2.0", "Accept": "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
  return await r.json();
}
async function safeText(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MoneyballGlobal/2.0", "Accept": "text/csv,text/plain,*/*" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
  return await r.text();
}
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { out[i] = await fn(items[i]); } catch (e) { out[i] = e as R; }
    }
  });
  await Promise.all(workers);
  return out;
}
async function openMatchday(date: string) {
  const index = await safeText(LEAGUE_INDEX);
  const indexRows = [...index.matchAll(/^\|\s*`([A-Za-z0-9_-]+)`\s*\|\s*([^|]+)\|/gm)];
  const leagueNameByFolder = new Map(indexRows.map(m => [m[1], m[2].trim()]));
  const folders = indexRows.map(m => m[1]);
  const unique = [...new Set(folders)];
  const githubHistoryPromise = readGithubTeamHistory();
  const results = await mapLimit(unique, 8, async (folder) => {
    const raw = await safeText(BASE + "/data/" + folder + "/fixtures_2627.csv")
      .catch(() => safeText(BASE + "/data/" + folder + "/fixtures_2026.csv"));
    const rows = csvRows(raw);
    if (!rows.length) return [];
    const headers = rows[0].map(x => x.trim().toLowerCase());
    const ix = (key: string) => headers.indexOf(key);
    const countryCode=folder.split("_")[0];
    return rows.slice(1).filter(r => norm(r[ix("date")]) === date).map(r => ({
      external_id: "om:" + folder + ":" + date + ":" + norm(r[ix("home")]) + ":" + norm(r[ix("away")]),
      source: "OpenMatchday",
      competition: folder,
      country: countryCode,
      gender: /women|womens|female|frauen|femenin|femenina|damallsvenskan|wsl/i.test(folder + " " + (leagueNameByFolder.get(folder) || "")) ? "women" : "men",
      home_team: norm(r[ix("home")]),
      away_team: norm(r[ix("away")]),
      // CSV kickoff is venue-local. Convert using the competition's IANA timezone;
      // never append Z to a local clock time or fabricate a time when missing.
      kickoff_at: localKickoffToIso(norm(r[ix("date")]),norm(r[ix("time")]),countryCode),
      status: "scheduled",
    })).filter(x => x.home_team && x.away_team);
  });
  const fixtures = results.flatMap(x => Array.isArray(x) ? x : []);
  // Cup fixtures often have no recent cup-only results. Build a country-wide
  // club history from every available non-cup competition in the same country.
  // This improves form coverage without inventing scores or using another club's data.
  const activeCountries = [...new Set(fixtures.map(x => String(x.country || "").toUpperCase()))];
  const historyFolders = unique.filter(folder => {
    const country = folder.split("_")[0].toUpperCase();
    return activeCountries.includes(country) && !/_CUP_/i.test(folder);
  });
  const histories = await mapLimit(historyFolders, 8, async (folder) => {
    try {
      const raw = await safeText(BASE + "/data/" + folder + "/results_2627.csv")
        .catch(() => safeText(BASE + "/data/" + folder + "/results_2026.csv"));
      return [folder, csvRows(raw)] as [string, string[][]];
    } catch (error) {
      return [folder, []] as [string, string[][]];
    }
  });
  const historyMap = new Map<string, string[][]>(histories as any);
  const teamForm = (folder: string, team: string) => {
    const country = folder.split("_")[0].toUpperCase();
    const rowsForTeam: {date:string; opponent:string; own:number; opp:number; competition:string}[] = [];
    const canonical = (v:string) => v.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    for (const [historyFolder, rows] of historyMap.entries()) {
      if (historyFolder.split("_")[0].toUpperCase() !== country || !rows.length) continue;
      const headers = rows[0].map(x => x.trim().toLowerCase());
      const at = (r:string[], key:string) => r[headers.indexOf(key)] || "";
      for (const r of rows.slice(1)) {
        const matchDate = at(r,"date");
        if (!matchDate || matchDate >= date || !at(r,"ft_home") || !at(r,"ft_away")) continue;
        const home = at(r,"home"), away = at(r,"away");
        const isHome = canonical(home) === canonical(team);
        const isAway = canonical(away) === canonical(team);
        if (!isHome && !isAway) continue;
        const own = Number(at(r,isHome ? "ft_home" : "ft_away"));
        const opp = Number(at(r,isHome ? "ft_away" : "ft_home"));
        if (!Number.isFinite(own) || !Number.isFinite(opp)) continue;
        rowsForTeam.push({date:matchDate,opponent:isHome?away:home,own,opp,competition:historyFolder});
      }
    }
    const uniqueRows = [...new Map(rowsForTeam.map(x => [[x.date,canonical(x.opponent),x.own,x.opp].join("|"),x])).values()]
      .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
    let points = 0, gf = 0, ga = 0;
    const last10 = uniqueRows.map(x => {
      gf += x.own; ga += x.opp;
      const result = x.own > x.opp ? "W" : x.own < x.opp ? "L" : "D";
      points += result === "W" ? 3 : result === "D" ? 1 : 0;
      return {date:x.date,opponent:x.opponent,result,goals_for:x.own,goals_against:x.opp,competition:x.competition};
    });
    return {matches:last10.length,last10,points:last10.length?points:null,goals_for:last10.length?gf:null,goals_against:last10.length?ga:null,source:"OPENMATCHDAY_COUNTRY_COMPETITIONS"};
  };
  const githubHistory = await githubHistoryPromise;
  let githubFormsUsed = 0;
  for (const f of fixtures) {
    // The public OpenMatchday/ClubElo history is men's data. Never attach a
    // men's club record or rating to a women's team with the same club name.
    if (String(f.gender||"").toLowerCase() === "women") {
      f.home_form = { matches: 0, last10: [], points: null, goals_for: null, goals_against: null, source: "WOMENS_HISTORY_PENDING" };
      f.away_form = { matches: 0, last10: [], points: null, goals_for: null, goals_against: null, source: "WOMENS_HISTORY_PENDING" };
      continue;
    }
    const localHome = teamForm(f.competition, f.home_team);
    const localAway = teamForm(f.competition, f.away_team);
    const githubHome = githubTeamForm(f.home_team, date, githubHistory);
    const githubAway = githubTeamForm(f.away_team, date, githubHistory);
    f.home_form = localHome.matches >= 3 ? localHome : (githubHome || localHome);
    f.away_form = localAway.matches >= 3 ? localAway : (githubAway || localAway);
    if (githubHome) githubFormsUsed++;
    if (githubAway) githubFormsUsed++;
  }
  return {
    fixtures,
    leagues_checked: unique.length,
    history_leagues_checked: historyMap.size,
    fixture_fetch_errors: results.filter(x => x instanceof Error).length,
    history_fetch_errors: histories.filter(x => x instanceof Error).length,
    github_history_generated_at: githubHistory.generated_at || null,
    github_history_error: githubHistory.error || null,
    github_history_team_count: Object.keys(githubHistory.teams || {}).length,
    github_forms_used: githubFormsUsed,
    history_error_details: histories.filter(x => x instanceof Error).slice(0,8).map(x => String(x).slice(0,240))
  };
}
const ESPN_LEAGUES = [
  "eng.1","eng.2","esp.1","esp.2","ita.1","ita.2","ger.1","ger.2","fra.1","fra.2",
  "bel.1","ned.1","por.1","sco.1","uefa.champions","uefa.europa","uefa.europa.conf",
  "swe.1","nor.1","den.1","aut.1","sui.1","tur.1","gre.1",
  "eng.w.1","eng.w.promotion.relegation","eng.w.fa","eng.w.league_cup",
  "esp.w.1","fra.w.1","ned.w.1","ned.w.knvb_cup",
  "uefa.w.nations","uefa.w.europa"
];
const ESPN_COUNTRY: Record<string,string> = {
  eng:"England", esp:"Spain", ita:"Italy", ger:"Germany", fra:"France",
  bel:"Belgium", ned:"Netherlands", por:"Portugal", sco:"Scotland",
  uefa:"Europe", swe:"Sweden", nor:"Norway", den:"Denmark",
  aut:"Austria", sui:"Switzerland", tur:"Turkey", gre:"Greece"
};

const ESPN_WOMEN_HISTORY_LEAGUES = ["eng.w.1","esp.w.1","fra.w.1","ned.w.1"];
function previousSundayDates(targetDate:string,count=10):string[] {
  const target=new Date(targetDate+"T12:00:00Z");
  const weekday=target.getUTCDay();
  const daysBack=weekday===0?7:weekday;
  return Array.from({length:count},(_,i)=>{
    const d=new Date(target);
    d.setUTCDate(target.getUTCDate()-daysBack-i*7);
    return d.toISOString().slice(0,10).replaceAll("-","");
  });
}
async function espnWomenHistory(targetDate:string) {
  const tasks=ESPN_WOMEN_HISTORY_LEAGUES.flatMap(league=>previousSundayDates(targetDate,10).map(ymd=>({league,ymd})));
  const results=await mapLimit(tasks,8,async task=>{
    const data=await safeJson("https://site.api.espn.com/apis/site/v2/sports/soccer/"+task.league+"/scoreboard?dates="+task.ymd);
    return Array.isArray(data?.events)?data.events:[];
  });
  const byTeam=new Map<string,any[]>(),errors=results.filter(x=>x instanceof Error).length;
  const key=(value:string)=>norm(value).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  for(const group of results){
    if(!Array.isArray(group))continue;
    for(const event of group){
      const status=event?.status?.type||event?.competitions?.[0]?.status?.type||{};
      if(status.completed!==true&&status.state!=="post")continue;
      const competition=event?.competitions?.[0]||{};
      const competitors=competition.competitors||[];
      const home=competitors.find((x:any)=>x.homeAway==="home")||competitors[0];
      const away=competitors.find((x:any)=>x.homeAway==="away")||competitors[1];
      const homeName=norm(home?.team?.displayName),awayName=norm(away?.team?.displayName);
      const homeScore=Number(home?.score),awayScore=Number(away?.score);
      const matchDate=String(event?.date||competition?.date||"").slice(0,10);
      if(!homeName||!awayName||!matchDate||matchDate>=targetDate||!Number.isInteger(homeScore)||!Number.isInteger(awayScore))continue;
      const add=(team:string,opponent:string,own:number,opp:number)=>{
        const teamKey=key(team),rows=byTeam.get(teamKey)||[];
        rows.push({date:matchDate,opponent,result:own>opp?"W":own<opp?"L":"D",goals_for:own,goals_against:opp});
        byTeam.set(teamKey,rows);
      };
      add(homeName,awayName,homeScore,awayScore);
      add(awayName,homeName,awayScore,homeScore);
    }
  }
  const forms=new Map<string,any>();
  for(const [team,rows] of byTeam.entries()){
    const seen=new Set<string>();
    const last10=rows.sort((a,b)=>b.date.localeCompare(a.date)).filter(x=>{
      const id=[x.date,key(x.opponent),x.goals_for,x.goals_against].join("|");
      if(seen.has(id))return false;seen.add(id);return true;
    }).slice(0,10);
    if(!last10.length)continue;
    const w=last10.filter(x=>x.result==="W").length,d=last10.filter(x=>x.result==="D").length,l=last10.filter(x=>x.result==="L").length;
    forms.set(team,{matches:last10.length,w,d,l,last10,goals_for:last10.reduce((s,x)=>s+x.goals_for,0),goals_against:last10.reduce((s,x)=>s+x.goals_against,0),source:"ESPN_WOMEN_LAST10"});
  }
  return {forms,teams:forms.size,matches:[...forms.values()].reduce((s,x)=>s+x.matches,0),errors,dates:10,leagues:ESPN_WOMEN_HISTORY_LEAGUES.length};
}
function espnRecentForm(competitor:any){
  const sequence=String(competitor?.form||"").toUpperCase().replace(/[^WDL]/g,"").slice(-5);
  if(sequence.length<3)return null;
  const w=[...sequence].filter(x=>x==="W").length,d=[...sequence].filter(x=>x==="D").length,l=[...sequence].filter(x=>x==="L").length;
  return {matches:sequence.length,w,d,l,points:w*3+d,source:"ESPN_FORM_LAST5"};
}

async function espn(date: string) {
  const ymd = date.replaceAll("-", "");
  const results = await mapLimit(ESPN_LEAGUES, 8, async (leagueCode) => {
    const data = await safeJson("https://site.api.espn.com/apis/site/v2/sports/soccer/" + leagueCode + "/scoreboard?dates=" + ymd);
    const events = Array.isArray(data?.events) ? data.events : [];
    const leagueName = norm(data?.leagues?.[0]?.name || leagueCode);
    const country = ESPN_COUNTRY[leagueCode.split(".")[0]] || "Europe";
    const isWomen = /\.w\.|women|frauen/i.test(leagueCode) || /women|femenina|frauen/i.test(leagueName);
    return events.map((e: any) => {
      const c = e?.competitions?.[0] || {};
      const competitors = c?.competitors || [];
      const home = competitors.find((x: any) => x.homeAway === "home") || competitors[0];
      const away = competitors.find((x: any) => x.homeAway === "away") || competitors[1];
      return {
        external_id: "espn:" + norm(e.id),
        source: "ESPN",
        competition: leagueName || norm(c?.notes?.[0]?.headline || e?.name),
        country: norm(c?.venue?.address?.country) || country,
        gender: isWomen ? "women" : "unknown",
        home_team: norm(home?.team?.displayName),
        away_team: norm(away?.team?.displayName),
        kickoff_at: e?.date || c?.date || null,
        status: statusFromEspn(e),
        home_score: home?.score == null ? null : Number(home.score),
        away_score: away?.score == null ? null : Number(away.score),
        home_form: espnRecentForm(home),
        away_form: espnRecentForm(away),
      };
    }).filter((x: any) => x.home_team && x.away_team);
  });
  const fixtures = results.flatMap(x => Array.isArray(x) ? x : []);
  const failures = results.filter(x => x instanceof Error) as Error[];
  const womenFixtures=fixtures.filter((x:any)=>x.gender==="women");
  let womenHistory:any={forms:new Map(),teams:0,matches:0,errors:0,dates:0,leagues:0};
  if(womenFixtures.length){
    womenHistory=await espnWomenHistory(date);
    const key=(value:string)=>norm(value).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    for(const fixture of womenFixtures){
      fixture.home_form=womenHistory.forms.get(key(fixture.home_team))||fixture.home_form||null;
      fixture.away_form=womenHistory.forms.get(key(fixture.away_team))||fixture.away_form||null;
    }
  }
  return { fixtures, events_received: fixtures.length, leagues_checked: ESPN_LEAGUES.length, errors: failures.length, error_details: failures.slice(0,5).map(x => String(x)), women_history_teams:womenHistory.teams, women_history_matches:womenHistory.matches, women_history_errors:womenHistory.errors, women_history_leagues:womenHistory.leagues, women_history_matchdays:womenHistory.dates };
}
const SPORTSDB_COUNTRY_CODE:Record<string,string> = {
 "england":"ENG","scotland":"SCO","wales":"WAL","northern ireland":"NIR","ireland":"IRL",
 "portugal":"POR","the netherlands":"NED","netherlands":"NED","spain":"ESP","france":"FRA",
 "germany":"GER","italy":"ITA","belgium":"BEL","serbia":"SRB","greece":"GRE","turkey":"TUR",
 "switzerland":"SUI","austria":"AUT","denmark":"DEN","sweden":"SWE","norway":"NOR",
 "poland":"POL","czech republic":"CZE","czechia":"CZE","slovakia":"SVK","slovenia":"SVN",
 "croatia":"CRO","romania":"ROU","bulgaria":"BUL","ukraine":"UKR","finland":"FIN",
 "iceland":"ISL","faroe islands":"FRO","cyprus":"CYP","estonia":"EST","latvia":"LVA",
 "lithuania":"LTU","hungary":"HUN","russia":"RUS","georgia":"GEO","armenia":"ARM",
 "azerbaijan":"AZE","belarus":"BLR","north macedonia":"MKD","montenegro":"MNE",
 "bosnia and herzegovina":"BIH","albania":"ALB","kosovo":"KOS","luxembourg":"LUX",
 "malta":"MLT","gibraltar":"GIB","san marino":"SMR"
};
async function theSportsDb(date:string) {
 const data=await safeJson("https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d="+encodeURIComponent(date)+"&s=Soccer");
 const events=Array.isArray(data?.events)?data.events:[];
 const fixtures=events.flatMap((e:any)=>{
  const home=norm(e?.strHomeTeam),away=norm(e?.strAwayTeam);
  if(!home||!away||String(e?.dateEvent||date)!==date)return [];
  const countryName=norm(e?.strCountry||"");
  const countryCode=SPORTSDB_COUNTRY_CODE[countryName]||"";
  const rawTime=String(e?.strTimeLocal||e?.strTime||"").slice(0,5);
  let kickoff:string|null=null;
  const timestamp=String(e?.strTimestamp||"");
  if(/[zZ]$|[+-]\\d{2}:?\\d{2}$/.test(timestamp)){
   const parsed=Date.parse(timestamp);if(Number.isFinite(parsed))kickoff=new Date(parsed).toISOString();
  } else if(rawTime) kickoff=localKickoffToIso(date,rawTime,countryCode||"BEL");
  const statusRaw=String(e?.strStatus||"").toLowerCase();
  const postponed=String(e?.strPostponed||"").toLowerCase()==="yes"||/postponed|cancelled|canceled/.test(statusRaw);
  const finished=/^(ft|aet|pen|finished|match finished)$/.test(statusRaw)||/full time/.test(statusRaw);
  const live=/live|in progress|1st half|2nd half|half time/.test(statusRaw);
  const league=norm(e?.strLeague||"");
  const women=/women|womens|frauen|femenin|female|vrouwen|damallsvenskan|liga f|\\bwsl\\b|feminine/i.test(league);
  const hs=e?.intHomeScore==null||e.intHomeScore===""?null:Number(e.intHomeScore);
  const as=e?.intAwayScore==null||e.intAwayScore===""?null:Number(e.intAwayScore);
  return [{
   external_id:"tsdb:"+String(e.idEvent||""),
   source:"TheSportsDB",
   competition:league||"Soccer",
   country:countryName||"Europe",
   gender:women?"women":"unknown",
   home_team:home,away_team:away,kickoff_at:kickoff,
   status:postponed?"postponed":finished?"finished":live?"live":"scheduled",
   home_score:finished&&Number.isInteger(hs)?hs:null,
   away_score:finished&&Number.isInteger(as)?as:null
  }];
 });
 return {fixtures,events_received:fixtures.length,source:"TheSportsDB public v1 feed",errors:0};
}
async function openLiga(date: string) {
  const shortcuts = ["bl1","bl2","bl3","la1","ucl","uel","dfb","ffb1","ffb2","pl","unl"];
  const results = await mapLimit(shortcuts, 5, async (league) => {
    const data = await safeJson("https://api.openligadb.de/getmatchdata/" + league + "/2026");
    return (Array.isArray(data) ? data : []).filter((m: any) => String(m?.matchDateTime || "").slice(0,10) === date).map((m: any) => {
      const home = norm(m?.team1?.teamName), away = norm(m?.team2?.teamName);
      const hs = m?.matchResults?.find((x: any) => x.resultTypeID === 2)?.pointsTeam1;
      const as = m?.matchResults?.find((x: any) => x.resultTypeID === 2)?.pointsTeam2;
      const finished = m?.matchIsFinished === true;
      return {
        external_id: "oldb:" + norm(m?.matchID),
        source: "OpenLigaDB",
        competition: league,
        country: "Germany/Europe",
        gender: /frauen|women|ffb/i.test(league) ? "women" : "unknown",
        home_team: home, away_team: away,
        kickoff_at: m?.matchDateTime || null,
        status: finished ? "finished" : "scheduled",
        home_score: hs == null ? null : Number(hs),
        away_score: as == null ? null : Number(as),
      };
    }).filter((x: any) => x.home_team && x.away_team);
  });
  const fixtures = results.flatMap(x => Array.isArray(x) ? x : []);
  return { fixtures, leagues_checked: shortcuts.length, errors: results.filter(x => x instanceof Error).length };
}
function normClub(value:unknown):string {
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/&/g," and ").replace(/\b(football club|fc|afc|cf|cd|sc|ac|ud|rcd|rc|sv|vfb|vfl|fsv|tsg|ogc|losc|ssc|sl|gnk|us|fk|club|alsace)\b/g," ").replace(/^\d+\.?\s*/,"")
    .replace(/[^a-z0-9]+/g," ").trim();
}
const ELO_ALIASES:Record<string,string> = {
  "man utd":"manchester united","man united":"manchester united","man city":"manchester city",
  "tottenham hotspurs":"tottenham hotspur","spurs":"tottenham hotspur","bayern munchen":"bayern munich",
  "bayer 04 leverkusen":"leverkusen","bayer leverkusen":"leverkusen","borussia monchengladbach":"monchengladbach","as monaco":"monaco",
  "eintracht frankfurt":"frankfurt","rc strasbourg":"strasbourg","deportivo alaves":"alaves",
  "celta":"celta vigo","aj auxerre":"auxerre","olympique lyonnais":"lyon","stade brestois 29":"brest",
  "inter milan":"inter","ac milan":"milan","athletic bilbao":"athletic","psv":"psv eindhoven",
  "union saint gilloise":"union sg","nott m forest":"nottingham forest","coventry":"coventry city",
  "leeds":"leeds united","hull":"hull city","ipswich":"ipswich town","newcastle":"newcastle united",
  "west ham united":"west ham","wolverhampton wanderers":"wolves","norwich city":"norwich",
  "swansea city":"swansea","bolton wanderers":"bolton","bradford city":"bradford",
  "heart of midlothian":"hearts","dunfermline athletic":"dunfermline",
  "vitoria guimaraes":"vitoria","sporting cp":"sporting lisbon",
  "atletico de madrid":"atletico madrid","paris sg":"paris saint germain",
};
function daysBetween(later:string,earlier:string):number {
  const a=Date.parse(later+"T00:00:00Z"),b=Date.parse(earlier+"T00:00:00Z");
  return Number.isFinite(a)&&Number.isFinite(b)?Math.floor((a-b)/86400000):9999;
}
async function beyondElo(targetDate:string) {
  const raw=await safeText("https://public-api.beyondelo.com/v1/datasets/club-ratings.csv");
  const rows=csvRows(raw);
  if(rows.length<2)throw new Error("BeyondELO CSV is empty");
  const h=rows[0].map(x=>x.trim().toLowerCase());
  const at=(r:string[],key:string)=>r[h.indexOf(key)]||"";
  const items=rows.slice(1).map(r=>({
    name:at(r,"name"),slug:at(r,"slug"),country_code:at(r,"country_code"),
    elo:Number(at(r,"elo")),rd:Number(at(r,"rd")),hfa:Number(at(r,"hfa")),
    is_ranked:at(r,"is_ranked").toLowerCase()==="true",
    last_match_date:at(r,"last_match_date"),as_of:at(r,"as_of")
  })).filter(x=>x.name&&Number.isFinite(x.elo)&&x.is_ranked);
  const asOf=items.map(x=>x.as_of).filter(Boolean).sort().at(-1)||"";
  const age=asOf?daysBetween(targetDate,asOf):9999;
  if(!asOf||age<0||age>14) return {items:[],ratings_count:0,as_of:asOf,stale:true,raw_count:items.length};
  const fresh=items.filter(x=>x.last_match_date&&daysBetween(targetDate,x.last_match_date)>=0&&daysBetween(targetDate,x.last_match_date)<=60);
  return {items:fresh,ratings_count:fresh.length,as_of:asOf,stale:false,raw_count:items.length};
}

function sportsDbTeamKey(value:unknown):string {
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/\b(fc|cf|cd|ud|sc|ac|afc|club|football|de|the)\b/g," ")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function sportsDbSeason(countryCode:string,targetDate:string):string {
  const year=Number(targetDate.slice(0,4)),month=Number(targetDate.slice(5,7));
  if(["SWE","NOR","FIN","ISL","FRO"].includes(countryCode))return String(year);
  const start=month>=7?year:year-1;
  return String(start)+"-"+String(start+1);
}
async function sportsDbTeamHistory(fixtures:any[],targetDate:string) {
  const forms=new Map<string,any>(),errors:string[]=[],teamMatchCounts:any[]=[];
  const missing=new Map<string,{name:string;gender:string;country:string}>();
  for(const f of fixtures){
    for(const [team,form] of [[f.home_team,f.home_form],[f.away_team,f.away_form]] as any[]){
      if(!team||Number(form?.matches||0)>=3)continue;
      const gender=String(f.gender||"").toLowerCase(),country=String(f.country||"");
      if(!["men","women"].includes(gender))continue;
      const key=sportsDbTeamKey(team);
      if(key&&!missing.has(key))missing.set(key,{name:String(team),gender,country});
    }
  }
  const selected=[...missing.entries()].slice(0,40);
  const teamResults=await mapLimit(selected,4,async ([key,info])=>{
    try{
      const data=await safeJson("https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t="+encodeURIComponent(info.name));
      const candidates=Array.isArray(data?.teams)?data.teams:[];
      const queryTokens=sportsDbTeamKey(info.name).split(" ").filter(Boolean);
      const expectedCode=info.country.length===3?info.country.toUpperCase():SPORTSDB_COUNTRY_CODE[info.country.toLowerCase()]||"";
      const valid=candidates.filter((team:any)=>{
        const sourceGender=String(team?.strGender||"").toLowerCase();
        if(info.gender==="women"&&sourceGender!=="female")return false;
        if(info.gender==="men"&&sourceGender!=="male")return false;
        if(expectedCode&&SPORTSDB_COUNTRY_CODE[String(team?.strCountry||"").toLowerCase()]!==expectedCode)return false;
        const names=[sportsDbTeamKey(team?.strTeam),sportsDbTeamKey(team?.strTeamAlternate)].filter(Boolean);
        return names.some((candidate:string)=>queryTokens.every(token=>candidate.split(" ").includes(token)));
      });
      if(valid.length!==1)return {key,info,team:null};
      return {key,info,team:valid[0]};
    }catch(error){errors.push("team "+info.name+": "+String(error).slice(0,120));return {key,info,team:null};}
  });
  const teamByKey=new Map<string,any>();
  const leagues=new Map<string,{id:string;season:string;countryCode:string}>();
  for(const row of teamResults){
    if(!row.team)continue;
    teamByKey.set(row.key,row.team);
    const countryCode=row.info.country.length===3?row.info.country.toUpperCase():SPORTSDB_COUNTRY_CODE[row.info.country.toLowerCase()]||"";
    const leagueId=String(row.team.idLeague||"");
    if(!leagueId||!countryCode)continue;
    const season=sportsDbSeason(countryCode,targetDate);
    leagues.set(leagueId+"|"+season,{id:leagueId,season,countryCode});
  }
  const leagueRows=await mapLimit([...leagues.values()],4,async league=>{
    try{
      const data=await safeJson("https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id="+encodeURIComponent(league.id)+"&s="+encodeURIComponent(league.season));
      const events=Array.isArray(data?.events)?data.events:[];
      const firstDate=events.map((x:any)=>String(x?.dateEvent||"").slice(0,10)).filter((x:string)=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x)).sort()[0]||"";
      return {key:league.id+"|"+league.season,league,events,firstDate};
    }catch(error){errors.push("league "+league.id+": "+String(error).slice(0,120));return {key:league.id+"|"+league.season,league,events:[],firstDate:""};}
  });
  const eventsByLeague=new Map(leagueRows.map(x=>[x.key,[...x.events]]));
  const roundTasks:any[]=[];
  for(const row of leagueRows){
    if(!row.firstDate)continue;
    const elapsed=Math.max(0,(Date.parse(targetDate+"T00:00:00Z")-Date.parse(row.firstDate+"T00:00:00Z"))/86400000);
    const estimatedRound=Math.min(35,Math.max(1,Math.floor(elapsed/7)+1));
    const minRound=Math.max(1,estimatedRound-12);
    for(let round=estimatedRound;round>=minRound;round--)roundTasks.push({key:row.key,leagueId:row.league.id,round});
  }
  const roundRows=await mapLimit(roundTasks,8,async task=>{
    try{
      const data=await safeJson("https://www.thesportsdb.com/api/v1/json/123/eventsround.php?id="+encodeURIComponent(task.leagueId)+"&r="+task.round);
      return {key:task.key,events:Array.isArray(data?.events)?data.events:[]};
    }catch(error){errors.push("round "+task.leagueId+"/"+task.round+": "+String(error).slice(0,100));return {key:task.key,events:[]};}
  });
  for(const row of roundRows){
    const existing=eventsByLeague.get(row.key)||[],seen=new Set(existing.map((x:any)=>String(x?.idEvent||"")));
    for(const event of row.events){const id=String(event?.idEvent||"");if(!id||!seen.has(id)){existing.push(event);if(id)seen.add(id);}}
    eventsByLeague.set(row.key,existing);
  }
  for(const [key,team] of teamByKey.entries()){
    const info=missing.get(key);if(!info)continue;
    const countryCode=info.country.length===3?info.country.toUpperCase():SPORTSDB_COUNTRY_CODE[info.country.toLowerCase()]||"";
    const leagueId=String(team.idLeague||""),season=sportsDbSeason(countryCode,targetDate);
    const events=eventsByLeague.get(leagueId+"|"+season)||[],teamId=String(team.idTeam||"");
    const matches=events.filter((event:any)=>{
      const d=String(event?.dateEvent||"").slice(0,10),status=String(event?.strStatus||"").toUpperCase();
      const homeId=String(event?.idHomeTeam||""),awayId=String(event?.idAwayTeam||"");
      const homeScore=event?.intHomeScore,awayScore=event?.intAwayScore;
      return d&&d<targetDate&&(homeId===teamId||awayId===teamId)&&["FT","AET","PEN","AP"].includes(status)
        &&homeScore!==null&&homeScore!==undefined&&String(homeScore)!==""
        &&awayScore!==null&&awayScore!==undefined&&String(awayScore)!==""
        &&Number.isInteger(Number(homeScore))&&Number.isInteger(Number(awayScore));
    });
    teamMatchCounts.push({team:info.name,team_id:teamId,league_id:leagueId,season,event_count:events.length,played_before_target:matches.length});
    matches.sort((a:any,b:any)=>String(b.dateEvent).localeCompare(String(a.dateEvent)));
    const recentMatches=matches.slice(0,10);
    if(recentMatches.length<3)continue;
    const last10=recentMatches.map((event:any)=>{
      const isHome=String(event.idHomeTeam)===teamId,own=Number(isHome?event.intHomeScore:event.intAwayScore),opp=Number(isHome?event.intAwayScore:event.intHomeScore);
      return {date:String(event.dateEvent).slice(0,10),opponent:String(isHome?event.strAwayTeam:event.strHomeTeam||""),result:own>opp?"W":own<opp?"L":"D",goals_for:own,goals_against:opp};
    });
    const w=last10.filter(x=>x.result==="W").length,d=last10.filter(x=>x.result==="D").length,l=last10.filter(x=>x.result==="L").length;
    forms.set(key,{matches:last10.length,w,d,l,points:w*3+d,goals_for:last10.reduce((sum,x)=>sum+x.goals_for,0),goals_against:last10.reduce((sum,x)=>sum+x.goals_against,0),last10,source:"THESPORTSDB_LAST10"});
  }
  return {forms,teams:teamByKey.size,leagues:leagues.size,matches:[...forms.values()].reduce((sum,x)=>sum+x.matches,0),errors:errors.slice(0,20),team_match_counts:teamMatchCounts,league_event_counts:leagueRows.map(x=>({league:x.key,events:x.events.length}))};
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const date = new URL(req.url).searchParams.get("date") || String(body?.date || "") || new Date().toISOString().slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Nieprawidłowa data. Użyj YYYY-MM-DD.");
    const [om, es, ol, ts, be] = await Promise.allSettled([openMatchday(date), espn(date), openLiga(date), theSportsDb(date), beyondElo(date)]);
    const sources: Record<string, any> = {};
    const all: any[] = [];
    for (const [name, result] of [["OpenMatchday",om],["ESPN",es],["OpenLigaDB",ol],["TheSportsDB",ts]] as const) {
      if (result.status === "fulfilled") {
        sources[name] = { ok: true, ...result.value };
        all.push(...result.value.fixtures);
      } else {
        sources[name] = { ok: false, error: String(result.reason) };
      }
    }
    const eloData=be.status==="fulfilled"?be.value:null;
    sources["BeyondELO"]=be.status==="fulfilled"
      ? {ok:true,ratings_count:eloData.ratings_count,raw_count:eloData.raw_count,as_of:eloData.as_of,stale:eloData.stale,licence:"CC BY 4.0"}
      : {ok:false,error:String(be.reason)};
    const eloByKey=new Map<string,any>();
    for(const rating of (eloData?.items||[])){
      const keys=[normClub(rating.name),normClub(rating.slug),ELO_ALIASES[normClub(rating.name)]||"",ELO_ALIASES[normClub(rating.slug)]||""].filter(Boolean);
      for(const key of keys)if(!eloByKey.has(key))eloByKey.set(key,rating);
    }
    const findElo=(team:string)=>{
      const key=normClub(team),alias=ELO_ALIASES[key]||"";
      return eloByKey.get(key)|| (alias?eloByKey.get(alias):null)||null;
    };
    const mergedByFixture = new Map<string,any>();
    for (const fixture of all) {
      const genderKey=String(fixture.gender||"").toLowerCase()==="women"?"women":"men";
       const k = (normClub(fixture.home_team) + "|" + normClub(fixture.away_team) + "|" + genderKey + "|" + String(fixture.kickoff_at || date).slice(0,10)).toLowerCase();
      const prior = mergedByFixture.get(k);
      if (!prior) {
        mergedByFixture.set(k,{...fixture,additional_sources:[]});
        continue;
      }
      const merged={...prior,
        kickoff_at:prior.kickoff_at||fixture.kickoff_at||null,
        gender:prior.gender==="unknown"&&fixture.gender!=="unknown"?fixture.gender:prior.gender,
        status:prior.status==="scheduled"&&fixture.status!=="scheduled"?fixture.status:prior.status,
        home_score:prior.home_score??fixture.home_score??null,
        away_score:prior.away_score??fixture.away_score??null,
        home_form:Number(prior.home_form?.matches||0)>0?prior.home_form:(fixture.home_form||prior.home_form),
        away_form:Number(prior.away_form?.matches||0)>0?prior.away_form:(fixture.away_form||prior.away_form),
        additional_sources:[...(prior.additional_sources||[]),fixture.source].filter((v:string,i:number,a:string[])=>a.indexOf(v)===i)
      };
      mergedByFixture.set(k,merged);
    }
    const deduped=[...mergedByFixture.values()];
    const europeanFixtures = deduped.filter((f:any) => isEuropeanFixture(f.country,f.competition,f.home_team,f.away_team));
    const sportsDbHistory=await sportsDbTeamHistory(europeanFixtures,date);
    for(const fixture of europeanFixtures){
      const homeForm=sportsDbHistory.forms.get(sportsDbTeamKey(fixture.home_team));
      const awayForm=sportsDbHistory.forms.get(sportsDbTeamKey(fixture.away_team));
      if(Number(fixture.home_form?.matches||0)<3&&homeForm)fixture.home_form=homeForm;
      if(Number(fixture.away_form?.matches||0)<3&&awayForm)fixture.away_form=awayForm;
    }
    if(sources["TheSportsDB"]?.ok)sources["TheSportsDB"]={...sources["TheSportsDB"],history_teams_checked:sportsDbHistory.teams,history_leagues_checked:sportsDbHistory.leagues,history_team_forms:sportsDbHistory.forms.size,history_matches:sportsDbHistory.matches,history_errors:sportsDbHistory.errors,history_team_match_counts:sportsDbHistory.team_match_counts,history_league_event_counts:sportsDbHistory.league_event_counts};
    const enriched = europeanFixtures.map((f:any) => {
      const isWomen=String(f.gender||"").toLowerCase()==="women";
       const homeRating=isWomen?null:findElo(f.home_team),awayRating=isWomen?null:findElo(f.away_team);
      const homeForm = f.home_form && Number(f.home_form.matches) > 0;
      const awayForm = f.away_form && Number(f.away_form.matches) > 0;
      const homeElo=!!homeRating,awayElo=!!awayRating;
      const missing = ["xG","lineups","injuries","odds"];
      if (!homeForm) missing.push("home_form");
      if (!awayForm) missing.push("away_form");
      if (!homeElo) missing.push("home_elo");
      if (!awayElo) missing.push("away_elo");
      return {
        ...f,
        home_elo:homeRating?.elo??null,away_elo:awayRating?.elo??null,
        elo_diff:homeRating&&awayRating?Number((homeRating.elo-awayRating.elo).toFixed(1)):null,
        home_rd:homeRating?.rd??null,away_rd:awayRating?.rd??null,
        home_hfa:homeRating?.hfa??null,elo_as_of:eloData?.as_of??null,
        home_form:{...(f.home_form||{}),elo:homeRating?.elo??null,rd:homeRating?.rd??null,hfa:homeRating?.hfa??null,elo_as_of:homeRating?.as_of??null},
        away_form:{...(f.away_form||{}),elo:awayRating?.elo??null,rd:awayRating?.rd??null,hfa:awayRating?.hfa??null,elo_as_of:awayRating?.as_of??null},
        data_coverage: {
          fixture: true,
          home_form: homeForm ? "available" : "missing",
          away_form: awayForm ? "available" : "missing",
          home_elo:homeElo?"available":"missing",away_elo:awayElo?"available":"missing",
          elo_as_of:eloData?.as_of??null,
          xg: "missing",
          lineups: "missing",
          injuries: "missing",
          odds: "missing",
          missing_fields: missing,
          coverage_status: missing.length === 4 ? "partial" : "limited"
        }
      };
    });
    return new Response(JSON.stringify({
      ok: true, date, api_key_required: false,
      source_count: Object.keys(sources).filter(k => sources[k].ok).length,
      raw_fixtures: all.length, european_fixtures: enriched.length, unique_fixtures: enriched.length,
      coverage_summary: {
        fixtures: enriched.length,
        with_home_form: enriched.filter((f:any)=>f.data_coverage.home_form==="available").length,
        with_away_form: enriched.filter((f:any)=>f.data_coverage.away_form==="available").length,
        with_both_forms: enriched.filter((f:any)=>f.data_coverage.home_form==="available"&&f.data_coverage.away_form==="available").length,
        with_home_elo: enriched.filter((f:any)=>f.data_coverage.home_elo==="available").length,
        with_away_elo: enriched.filter((f:any)=>f.data_coverage.away_elo==="available").length,
        with_both_elo: enriched.filter((f:any)=>f.data_coverage.home_elo==="available"&&f.data_coverage.away_elo==="available").length,
        without_xg: enriched.length,
        without_kickoff_time: enriched.filter((f:any)=>!f.kickoff_at).length,
        without_lineups: enriched.length,
        without_injuries: enriched.length,
        without_odds: enriched.length
      },
      sources, fixtures: enriched,
      elo_ratings: { source:"BeyondELO", as_of:eloData?.as_of??null, ratings_count:eloData?.ratings_count??0, items:eloData?.items??[], licence:"CC BY 4.0", attribution:"beyondELO (https://beyondelo.com)" },
      attribution: ["OpenMatchday (informational, non-commercial; attribute source)", "ESPN public scoreboard", "OpenLigaDB (public community football data)", "TheSportsDB public v1 soccer fixtures and season-result history feed", "beyondELO (CC BY 4.0)"],
      note: "Brak rekordu w źródle nie oznacza, że mecz nie istnieje. Puste dane nie są zastępowane fikcyjnymi statystykami. OpenMatchday nie dostarcza xG, składów, kontuzji ani kursów. Elo z beyondELO jest osobnym wskaźnikiem siły klubu, nie zastępuje xG ani potwierdzonych składów."
    }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});