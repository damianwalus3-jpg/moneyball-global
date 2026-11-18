import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isGeographicEuropeCountry } from "../_shared/geographic-europe.ts";
import { isEligibleDomesticTopTwoLeague, isEligibleOpenMatchdayTier } from "../_shared/domestic-league-scope.ts";
import { isExcludedSeniorTeam, isWomensTeam } from "../_shared/team-normalization.ts";
import { isRealXgObservation } from "../_shared/xg-validation.ts";
import { selectPublicSourceApiKey } from "../_shared/public-source-auth.ts";
const S="https://gzgeklcukrclgwbsmbsp.supabase.co",K=Deno.env.get("SUPABASE_ANON_KEY")||"",SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",V="MONEYBALL GLOBAL 3.8";
let CRON_FALLBACK_TOKEN="";
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-requested-with, prefer, cache-control, pragma","Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"};
const out=(x:any,n=200)=>new Response(JSON.stringify(x),{status:n,headers:{...C,"Content-Type":"application/json"}});

function isEuropeanFixture(country: unknown, _competition?: unknown, _home?: unknown, _away?: unknown): boolean {
  return isGeographicEuropeCountry(country);
}

function isEligibleOpenMatchdayMatch(m:any):boolean {
 const folder=(String(m?.external_id||"").match(/^om:([^:]+):/)||[])[1]||String(m?.source_competition_id||"");
 const competition=String(m?.competition||m?.league||"");
 const country=String(m?.country||"");
 return String(m?.source||"").toLowerCase()==="openmatchday"
  && isEligibleOpenMatchdayTier(folder)
  && isEligibleDomesticTopTwoLeague(country,competition)
  && fixtureGender(m)==="men";
}
function isEligibleScheduledFixture(f:any):boolean {
 const competition=String(f?.competition||f?.league||"");
 const country=String(f?.country||"");
 const source=String(f?.source||"").toLowerCase();
 const competitionEligible=source==="openmatchday"
  ? isEligibleOpenMatchdayMatch(f)
  : isEligibleDomesticTopTwoLeague(country,competition);
 return isEuropeanFixture(country,competition,f?.home_team||f?.home,f?.away_team||f?.away)
  && competitionEligible && fixtureGender(f)==="men";
}
function brusselsFixtureDay(value:any):string {
 const stamp=Date.parse(String(value||""));
 return Number.isFinite(stamp)?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(stamp)):"";
}
async function db(p:string,t:string,m="GET",b?:any,prefer="return=representation"){const isService=t===SERVICE_KEY;const r=await fetch(S+"/rest/v1/"+p,{method:m,headers:{apikey:isService?SERVICE_KEY:K,Authorization:"Bearer "+(isService?SERVICE_KEY:t),...(isService?{"x-cron-token":CRON_FALLBACK_TOKEN}:{}),"Content-Type":"application/json",Prefer:prefer},body:b===undefined?undefined:JSON.stringify(b)});const s=await r.text();let j:any;try{j=s?JSON.parse(s):null}catch{j=s}if(!r.ok)throw Error(j?.message||j?.details||"DB HTTP "+r.status);return j;}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function normTeam(v:any){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|sc|ac|afc|club)\b/g," ").replace(/\b(wfc|women|w)\b/g," women ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
function fixtureGender(m:any):"men"|"women"|"excluded" {
 const competition=String(m?.competition||m?.league||"");
 const home=String(m?.home_team||m?.home||"");
 const away=String(m?.away_team||m?.away||"");
 if(isWomensTeam(home)||isWomensTeam(away)||/\b(women|womens|woman|female|frauen|feminine|femminile|femenina|ladies|girls|damallsvenskan|wsl|liga f)\b/i.test(competition))return "women";
 if(isExcludedSeniorTeam(home)||isExcludedSeniorTeam(away)||/\b(u(?:15|16|17|18|19|20|21|23)|under ?(?:15|16|17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?)\b/i.test(competition))return "excluded";
 const explicit=String(m?.gender||"").toLowerCase();
 if(explicit && explicit!=="men")return "excluded";
 return "men";
}
function fixtureTeamKey(v:any){const key=normTeam(v);const aliases:Record<string,string>={"turkiye":"turkey","republic of ireland":"ireland","czech republic":"czechia","north macedonia":"north macedonia","korea republic":"south korea","united states of america":"united states","usa":"united states","ivory coast":"cote d ivoire","cote d ivoire":"cote d ivoire"};return aliases[key]||key;}
function dedupeFixturesByDate(fixtures:any[],getDate:(m:any)=>string|null){
 const kept:any[]=[];
 const identity=(m:any)=>{const d=getDate(m),h=fixtureTeamKey(m.home_team),a=fixtureTeamKey(m.away_team);return d&&h&&a?d+"|"+h+">"+a:null;};
 const gender=(m:any)=>["men","women"].includes(String(m.gender||"").toLowerCase())?String(m.gender).toLowerCase():"unknown";
 const score=(m:any)=>((String(m.source||"").toLowerCase()==="footynomad")?100:0)+(gender(m)!=="unknown"?20:0)+(m.kickoff_at?10:0)+(m.competition?5:0);
 for(const candidate of fixtures){
  const key=identity(candidate);if(!key){kept.push(candidate);continue;}
  const g=gender(candidate);
  const index=kept.findIndex(existing=>identity(existing)===key&&(gender(existing)===g||gender(existing)==="unknown"||g==="unknown"));
  if(index<0){kept.push(candidate);continue;}
  if(score(candidate)>score(kept[index]))kept[index]=candidate;
 }
 return {matches:kept,duplicatesRemoved:fixtures.length-kept.length};
}
const ELO_ALIASES:Record<string,string>={
 "man city":"manchester city","man utd":"manchester united","man united":"manchester united",
 "spurs":"tottenham hotspurs","tottenham hotspur":"tottenham hotspurs","nott m forest":"nottingham forest",
 "bayer 04 leverkusen":"leverkusen","bayer leverkusen":"leverkusen",
 "borussia monchengladbach":"monchengladbach","eintracht frankfurt":"frankfurt",
 "ogc nice":"nice","as monaco":"monaco","losc lille":"lille","rc strasbourg alsace":"strasbourg",
 "deportivo alaves":"alaves","celta":"celta vigo","tsg hoffenheim":"hoffenheim",
 "us lecce":"lecce","aj auxerre":"auxerre","olympique lyonnais":"lyon","stade brestois 29":"brest",
 "vitoria guimaraes":"vitoria","sporting cp":"sporting lisbon","rc deportivo":"deportivo",
 "west ham united":"west ham","wolverhampton wanderers":"wolves","heart of midlothian":"hearts",
 "coventry":"coventry city","leeds":"leeds united","hull":"hull city","ipswich":"ipswich",
 "newcastle":"newcastle united","athletic bilbao":"athletic","inter milan":"inter",
 "ac milan":"milan","atletico de madrid":"atletico madrid","paris sg":"paris saint germain"
};
function eloKey(v:any){const k=normTeam(v).replace(/^\d+\.?\s*/,"").trim();return ELO_ALIASES[k]||k;}
function findEloRating(team:string,ratings:Map<string,any>){
 const key=eloKey(team),exact=ratings.get(key);if(exact)return exact;
 const tokens=(v:string)=>new Set(eloKey(v).split(" ").filter(x=>x.length>2));
 const a=tokens(team);if(a.size<2)return null;
 const candidates:any[]=[];
 for(const rating of new Set(ratings.values())){
  const names=[String(rating.name||""),String(rating.slug||"")].filter(Boolean);
  let score=0;
  for(const name of names){
   const b=tokens(name);if(!b.size)continue;
   const intersection=[...a].filter(x=>b.has(x)).length;
   const union=new Set([...a,...b]).size;
   score=Math.max(score,intersection/Math.max(1,union));
   const ka=eloKey(team),kb=eloKey(name);
   if(ka.length>=6&&(kb.includes(ka)||ka.includes(kb)))score=Math.max(score,0.9);
  }
  if(score>=0.85)candidates.push({rating,score});
 }
 candidates.sort((x,y)=>y.score-x.score);
 if(!candidates.length)return null;
 if(candidates[1]&&candidates[0].score-candidates[1].score<0.12)return null;
 return candidates[0].rating;
}
function wordNumber(v:string){const x=String(v||"").toLowerCase();const map:Record<string,number>={no:0,none:0,zero:0,one:1,two:2,three:3,four:4,five:5};return map[x]??(Number.isFinite(Number(x))?Number(x):NaN);}
function readCachedFootyForm(providerData:any,home:string,away:string){
 try{
  const v=providerData?.footy_nomad_form||providerData;
  const age=Date.now()-new Date(v?.fetched_at||0).getTime();
  if(!Number.isFinite(age)||age<0||age>6*60*60*1000)return null;
  if(normTeam(v.home_name)!==normTeam(home)||normTeam(v.away_name)!==normTeam(away))return null;
  const h=v.home,a=v.away;
  if(!h||!a||h.w+h.d+h.l!==5||a.w+a.d+a.l!==5)return null;
  return {home:h,away:a,source:"FOOTYNOMAD_LAST5_CACHE"};
 }catch(_){return null;}
}
async function readFootyNomadForm(id:string,expectedHome:string,expectedAway:string){
 try{
  const r=await fetch("https://footynomad.com/fixture/"+encodeURIComponent(id),{headers:{"User-Agent":"Mozilla/5.0 MoneyballGlobal/2.0","Accept":"text/html"},signal:AbortSignal.timeout(6500)});
  if(!r.ok)return null;
  const html=await r.text(),text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ");
  const m=text.match(/Going into this match,\s*(.+?)\s+have won\s+(no|none|zero|one|two|three|four|five|\d+),\s+drawn\s+(no|none|zero|one|two|three|four|five|\d+)\s+and lost\s+(no|none|zero|one|two|three|four|five|\d+)\s+of their last five;\s*(.+?)\s+have won\s+(no|none|zero|one|two|three|four|five|\d+),\s+drawn\s+(no|none|zero|one|two|three|four|five|\d+)\s+and lost\s+(no|none|zero|one|two|three|four|five|\d+)\s+of their last five/i);
  if(!m||normTeam(m[1])!==normTeam(expectedHome)||normTeam(m[5])!==normTeam(expectedAway))return null;
  const h={w:wordNumber(m[2]),d:wordNumber(m[3]),l:wordNumber(m[4])},a={w:wordNumber(m[6]),d:wordNumber(m[7]),l:wordNumber(m[8])};
  if([h.w,h.d,h.l,a.w,a.d,a.l].some(x=>!Number.isFinite(x)||x<0)||h.w+h.d+h.l!==5||a.w+a.d+a.l!==5)return null;
  return {home:h,away:a,source:"FOOTYNOMAD_LAST5"};
 }catch(_){return null;}
}

function fotbalSlug(value:string){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
const FOTBAL_COUNTRY_SLUGS:Record<string,string>={SVN:"slovenia",SLO:"slovenia",SVK:"slovakia",CZE:"czechia",ROU:"romania",GER:"germany",DEU:"germany",ENG:"england",SCO:"scotland",NIR:"northern-ireland",WAL:"wales",IRL:"ireland",BEL:"belgium",NED:"netherlands",NLD:"netherlands",ESP:"spain",FRA:"france",ITA:"italy",POR:"portugal",PRT:"portugal",AUT:"austria",SUI:"switzerland",CHE:"switzerland",POL:"poland",CRO:"croatia",SRB:"serbia",HUN:"hungary",TUR:"turkey",UKR:"ukraine",NOR:"norway",SWE:"sweden",DEN:"denmark",DNK:"denmark",FIN:"finland",GRE:"greece",GRC:"greece",BUL:"bulgaria"};
function fotbalTeamSlug(team:string){
 let s=fotbalSlug(team).replace(/^(nk|fc|fk|ac|afc|sc|sv|club)-/,"");
 const aliases:Record<string,string>={"primorje-ajdovscina":"primorje","nk-jesenice":"jesenice","nk-primorje":"primorje"};
 return aliases[s]||s;
}
function parseFotbalFormSection(markdown:string,kickoff:string){
 const heading="Meciuri recente, de la cel mai vechi la cel mai recent, în ultimele 5 meciuri.";
 const sections=String(markdown||"").split(heading).slice(1,3);
 const cutoff=String(kickoff||"").slice(0,10),target=new Date(cutoff+"T12:00:00Z");
 if(!Number.isFinite(target.getTime()))return [];
 return sections.map((section:string)=>{
  const body=section.split("Victorii–egaluri–înfrângeri")[0];
  const games:any[]=[];
  for(const line of body.split(/\\r?\\n/)){
   if(!/^\\s*\\*/.test(line))continue;
   const plain=line.replace(/\[([^\]]+)\]\([^)]+\)/g," $1 ").replace(/\*\*/g," ").replace(/\*/g," ").replace(/\s+/g," ").trim();
   const match=plain.match(/^(\\d{1,2})\\.(\\d{1,2})\\s+([DA])\\s+(.+?)\\s+(\\d{1,2})\\s*[–−-]\\s*(\\d{1,2})\\s+([VEÎ])$/i);
   if(!match)continue;
   const day=Number(match[1]),month=Number(match[2]),location=match[3],opponent=match[4].trim(),first=Number(match[5]),second=Number(match[6]);
   let year=target.getUTCFullYear();if(month>target.getUTCMonth()+1||(month===target.getUTCMonth()+1&&day>target.getUTCDate()))year--;
   const date=new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);
   if(date>=cutoff)continue;
   const isHome=location==="A",gf=isHome?first:second,ga=isHome?second:first;
   games.push({date,opponent,goals_for:gf,goals_against:ga,result:gf>ga?"W":gf<ga?"L":"D"});
  }
  const last10=games.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  if(last10.length<3)return null;
  const w=last10.filter(x=>x.result==="W").length,d=last10.filter(x=>x.result==="D").length,l=last10.filter(x=>x.result==="L").length;
  return {matches:last10.length,w,d,l,points:w*3+d,goals_for:last10.reduce((s,x)=>s+x.goals_for,0),goals_against:last10.reduce((s,x)=>s+x.goals_against,0),last10,source:"FOTBALINFO_PREMATCH"};
 }).filter(Boolean);
}
async function readFotbalInfoForm(m:any){
 try{
  const countryRaw=String(m.country||"").trim(),country=FOTBAL_COUNTRY_SLUGS[countryRaw.toUpperCase()]||fotbalSlug(countryRaw);
  const competition=String(m.competition||m.league||"").trim();
  if(!country||!competition||!m.kickoff_at)return null;
  const league=fotbalSlug(competition),date=String(m.kickoff_date||m.kickoff_at).slice(0,10);
  const home=fotbalTeamSlug(String(m.home_team)),away=fotbalTeamSlug(String(m.away_team));
  if(!home||!away||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const url="https://www.fotbalinfo.ro/"+country+"-"+league+"/"+date+"/"+home+"-"+away;
  // Direct requests from the edge region time out on FotbalInfo; use its public text-reader endpoint.
  const response=await fetch("https://r.jina.ai/"+url,{headers:{"User-Agent":"Mozilla/5.0 MoneyballGlobal/3.8","Accept":"text/plain"},signal:AbortSignal.timeout(14000)});
  if(!response.ok)return null;
  const markdown=await response.text();
  if(!markdown.toLowerCase().includes(String(m.home_team).toLowerCase())||!markdown.toLowerCase().includes(String(m.away_team).toLowerCase()))return null;
  const forms=parseFotbalFormSection(markdown,date);
  if(forms.length!==2)return null;
  return {home:forms[0],away:forms[1],source:"FOTBALINFO_PREMATCH",fixture_url:url,fetched_at:new Date().toISOString()};
 }catch(_){return null;}
}

function xgoalsSlug(value:string){const slug=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");const aliases:Record<string,string>={"rathfriland-rangers":"rathfriland","glenavon":"glenavon-fc"};return aliases[slug]||slug;}
async function readXgoalsTeamForm(team:string,country:string,kickoff:string){
 try{
  const countrySlug=xgoalsSlug(country||"france"),teamSlug=xgoalsSlug(team);
  if(!countrySlug||!teamSlug)return null;
  const url="https://xgoalspro.com/football/"+countrySlug+"/team/"+teamSlug+"/";
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 MoneyballGlobal/3.8","Accept":"text/html"},signal:AbortSignal.timeout(8000)});
  if(!r.ok)return null;
  const html=await r.text();
  const section=html.match(/<h2[^>]*>\s*Latest results\s*<\/h2>([\s\S]*?)(?:<h2|<\/section>)/i)?.[1]||"";
  if(!section)return null;
  const cutoff=String(kickoff||"").slice(0,10),rows:any[]=[];
  for(const item of section.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
   const li=item[1],date=li.match(/<time[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/time>/i)?.[1];
   if(!date||date>=cutoff)continue;
   const plain=li.replace(/<time[\s\S]*?<\/time>/i," ").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;|&apos;/g,"'").replace(/&#x27;/g,"'").replace(/\s+/g," ").trim();
   const score=plain.match(/(\d{1,2})\s*[–−-]\s*(\d{1,2})/);
   if(!score||score.index==null)continue;
   const home=plain.slice(0,score.index).trim(),away=plain.slice(score.index+score[0].length).trim();
   if(!home||!away)continue;
   const h=Number(score[1]),a=Number(score[2]);let gf:number,ga:number,opponent:string;
   if(normTeam(home)===normTeam(team)){gf=h;ga=a;opponent=away;}
   else if(normTeam(away)===normTeam(team)){gf=a;ga=h;opponent=home;}
   else continue;
   rows.push({date,opponent,goals_for:gf,goals_against:ga,result:gf>ga?"W":gf<ga?"L":"D"});
  }
  const last10=rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  if(last10.length<3)return null;
  const w=last10.filter(x=>x.result==="W").length,d=last10.filter(x=>x.result==="D").length,l=last10.filter(x=>x.result==="L").length;
  return {matches:last10.length,w,d,l,points:w*3+d,goals_for:last10.reduce((s,x)=>s+x.goals_for,0),goals_against:last10.reduce((s,x)=>s+x.goals_against,0),last10,source:"XGOALSPRO_PUBLIC_RESULTS"};
 }catch(_){return null;}
}
async function limitedSettled<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<PromiseSettledResult<R>[]>{const out:any[]=new Array(items.length);let cursor=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=cursor++;if(i>=items.length)return;try{out[i]={status:"fulfilled",value:await fn(items[i])};}catch(reason){out[i]={status:"rejected",reason};}}});await Promise.all(workers);return out;}
function formFromPublic(f:any){
 const games=Array.isArray(f?.last10)?f.last10:(Array.isArray(f?.last5)?f.last5:[]);
 if(!games.length){
  const matches=Number(f?.matches||0),w=Number(f?.w||0),d=Number(f?.d||0),l=Number(f?.l||0);
  if(matches<3||w+d+l!==matches)return null;
  return {w,d,l,matches,points:Number(f?.points??(w*3+d)),goals_for:null,goals_against:null,source:f?.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":"PUBLIC_WDL_FORM",last10:[],elo:f?.elo==null?null:Number(f.elo),rd:f?.rd==null?null:Number(f.rd),hfa:f?.hfa==null?null:Number(f.hfa),elo_as_of:f?.elo_as_of||null};
 }
 const w=games.filter((x:any)=>x.result==="W").length,d=games.filter((x:any)=>x.result==="D").length,l=games.filter((x:any)=>x.result==="L").length;
 const gf=games.reduce((s:number,x:any)=>s+Number(x.goals_for||0),0),ga=games.reduce((s:number,x:any)=>s+Number(x.goals_against||0),0);
 const source=f?.source==="ESPN_UEFA_NATIONS_SCHEDULE"?"ESPN_UEFA_NATIONS_SCHEDULE":f?.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":[f?.source,f?.home_form?.source,f?.away_form?.source].includes("ESPN_WOMEN_LAST10")?"ESPN_WOMEN_LAST10":"OPENMATCHDAY_LAST10";
 return {w,d,l,matches:games.length,goals_for:gf,goals_against:ga,source,last10:games,avg_shots_for:f?.avg_shots_for==null?null:Number(f.avg_shots_for),avg_shots_on_target_for:f?.avg_shots_on_target_for==null?null:Number(f.avg_shots_on_target_for),avg_corners_for:f?.avg_corners_for==null?null:Number(f.avg_corners_for),avg_possession_pct:f?.avg_possession_pct==null?null:Number(f.avg_possession_pct),avg_yellow_cards:f?.avg_yellow_cards==null?null:Number(f.avg_yellow_cards),avg_red_cards:f?.avg_red_cards==null?null:Number(f.avg_red_cards),avg_fouls:f?.avg_fouls==null?null:Number(f.avg_fouls),home_matches:f?.home_matches==null?null:Number(f.home_matches),away_matches:f?.away_matches==null?null:Number(f.away_matches),neutral_matches:f?.neutral_matches==null?null:Number(f.neutral_matches),xg_last10:Array.isArray(f?.xg_last10)?f.xg_last10:[],elo:f?.elo==null?null:Number(f.elo),rd:f?.rd==null?null:Number(f.rd),hfa:f?.hfa==null?null:Number(f.hfa),elo_as_of:f?.elo_as_of||null};
}
let publicSourceFormsCache:{date:string,at:number,value:any}|null=null;
async function readPublicSourceForms(date:string){
 if(publicSourceFormsCache&&publicSourceFormsCache.date===date&&Date.now()-publicSourceFormsCache.at<10*60*1000)return publicSourceFormsCache.value;
 const byPair=new Map<string,any>(),byTeam=new Map<string,any[]>(),eloByTeam=new Map<string,any>();
 try{
  const sourceApiKey=selectPublicSourceApiKey(SERVICE_KEY,K);
   // Edge Runtime may attach its service-role Authorization context to same-project fetches.
   // Set both headers explicitly to the same key to prevent Supabase rejecting conflicting credentials.
   const r=await fetch(S+"/functions/v1/moneyball-public-sources?date="+encodeURIComponent(date),{headers:{apikey:sourceApiKey,Authorization:"Bearer "+sourceApiKey,Accept:"application/json"},signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw new Error("Public sources HTTP "+r.status);
  const j=await r.json();
   const eloMeta={as_of:j?.elo_ratings?.as_of||null,ratings_count:Number(j?.elo_ratings?.ratings_count||0)};
   for(const rating of (Array.isArray(j?.elo_ratings?.items)?j.elo_ratings.items:[])){
    const keys=[eloKey(rating.name),eloKey(rating.slug)].filter(Boolean);
    for(const key of keys)if(!eloByTeam.has(key))eloByTeam.set(key,rating);
   }
  for(const f of (Array.isArray(j?.fixtures)?j.fixtures:[])){
    const h=formFromPublic(f.home_form),a=formFromPublic(f.away_form);
    const genderKey=String(f.gender||"").toLowerCase()==="women"?"women":"men";
    if(h||a||Array.isArray(f.home_squad)||Array.isArray(f.away_squad))byPair.set(normTeam(f.home_team)+"|"+normTeam(f.away_team)+"|"+genderKey,{home:h,away:a,home_squad:f.home_squad||[],away_squad:f.away_squad||[],home_roster_available:!!f.home_roster_available,away_roster_available:!!f.away_roster_available,home_injuries_available:!!f.home_injuries_available,away_injuries_available:!!f.away_injuries_available,home_injury_count:f.home_injury_count??null,away_injury_count:f.away_injury_count??null,squad_note:f.squad_note||null,source:h?.source==="ESPN_UEFA_NATIONS_SCHEDULE"||a?.source==="ESPN_UEFA_NATIONS_SCHEDULE"?"ESPN_UEFA_NATIONS_SCHEDULE":h?.source==="ESPN_WOMEN_LAST10"||a?.source==="ESPN_WOMEN_LAST10"?"ESPN_WOMEN_LAST10":h?.source==="ESPN_FORM_LAST5"||a?.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":"OPENMATCHDAY_LAST10"});
    // Preserve one-sided form when the opponent has no tracked league results.
    for(const [team,form] of [[f.home_team,h],[f.away_team,a]] as any[]){if(!form)continue;const key=normTeam(team),arr=byTeam.get(key)||[];arr.push({form,country:String(f.country||"").toLowerCase(),competition:String(f.competition||"").toLowerCase(),gender:genderKey});byTeam.set(key,arr);}
   }
  const result={byPair,byTeam,eloByTeam,eloMeta,fixtures:Number(j?.european_fixtures||0),fixtureRows:Array.isArray(j?.fixtures)?j.fixtures:[],error:null};
  publicSourceFormsCache={date,at:Date.now(),value:result};
  return result;
 }catch(e){console.error("OpenMatchday supplemental form unavailable:",String(e));return {byPair,byTeam,eloByTeam,eloMeta:null,fixtures:0,fixtureRows:[],error:String(e)};}
}
let tipsAuditPayloadCache:any=null;let tipsAuditPayloadCacheAt=0;
async function readTipsAuditFairMarket(date:string,matches:any[]){
 const byMatch=new Map<string,any>();
 try{
  let payload:any=null;
  if(tipsAuditPayloadCache&&Date.now()-tipsAuditPayloadCacheAt<5*60*1000)payload=tipsAuditPayloadCache;
  else{
   const response=await fetch("https://tipsaudit.com/api/v1/predictions",{headers:{"Accept":"application/json","User-Agent":"MONEYBALL-GLOBAL/3.8"},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw new Error("TipsAudit HTTP "+response.status);
   payload=await response.json();tipsAuditPayloadCache=payload;tipsAuditPayloadCacheAt=Date.now();
  }
  const generatedAt=Date.parse(String(payload?.generated_at||""));
  if(!Number.isFinite(generatedAt)||Date.now()-generatedAt>90*60*1000||generatedAt>Date.now()+5*60*1000)throw new Error("TipsAudit feed is stale or has an invalid generated_at timestamp");
  const toDay=(value:any)=>{const stamp=Date.parse(String(value||""));return Number.isFinite(stamp)?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(stamp)):"";};
  const key=(home:any,away:any)=>fixtureTeamKey(home)+">"+fixtureTeamKey(away);
  const feed=new Map<string,any>();
  for(const item of Array.isArray(payload?.predictions)?payload.predictions:[]){
   const fair=item?.fair_probabilities||{},odds=item?.fair_odds||{},readAt=Date.parse(String(item?.fair_read_at||item?.benchmark_read_at||payload.generated_at));
   const values=[Number(fair.home),Number(fair.draw),Number(fair.away)],sum=values.reduce((a,b)=>a+b,0);
   if(toDay(item?.kickoff_utc)!==date||item?.fair_source!=="live"||!Number.isFinite(readAt)||Date.now()-readAt>120*60*1000||readAt>Date.now()+5*60*1000)continue;
   if(!values.every(x=>Number.isFinite(x)&&x>0&&x<1)||sum<0.97||sum>1.03)continue;
   if(![odds.home,odds.draw,odds.away].every((x:any)=>Number.isFinite(Number(x))&&Number(x)>1))continue;
   const matchKey=key(item.home,item.away);
   if(!feed.has(matchKey))feed.set(matchKey,{item,readAt,values,odds});
  }
  for(const match of matches){
   if(!match?.kickoff_at||!["scheduled","unknown"].includes(String(match.status||"")))continue;
   const matchDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(match.kickoff_at));
   if(matchDate!==date)continue;
   const found=feed.get(key(match.home_team,match.away_team));
   if(!found)continue;
   const {item,readAt,values,odds}=found;
   byMatch.set(match.id,{market_probabilities:{home:values[0],draw:values[1],away:values[2]},captured_at:new Date(readAt).toISOString(),market_source:"TIPSAUDIT_FAIR_MARKET",fair_odds:{home:Number(odds.home),draw:Number(odds.draw),away:Number(odds.away)},fair_source_url:String(item.url||"https://tipsaudit.com"),market_reference_best_soft_odds:item.value?.best_soft_odds==null?null:Number(item.value.best_soft_odds),market_reference_bookmaker:item.value?.bookmaker||null,market_reference_selection:item.value?.selection||null,league:item.league||null,generated_at:payload.generated_at});
  }
  return {byMatch,ok:true,matched:byMatch.size,generated_at:payload.generated_at};
 }catch(error){console.error("TipsAudit fair market unavailable:",String(error));return {byMatch,ok:false,matched:0,error:String(error)};}
}
function publicFormForMatch(m:any,index:any){
 const rawGender=fixtureGender(m).toLowerCase();if(rawGender!=="men"&&rawGender!=="women")return null;const targetGender=rawGender;
 const exact=index.byPair.get(normTeam(m.home_team)+"|"+normTeam(m.away_team)+"|"+targetGender);if(exact)return exact;
 const choose=(team:string)=>{const rows=(index.byTeam.get(normTeam(team))||[]).filter((x:any)=>targetGender==="women"?x.gender==="women":x.gender!=="women");if(!rows.length)return null;const country=String(m.country||"").toLowerCase(),comp=String(m.competition||"").toLowerCase();const ranked=rows.map((x:any)=>({...x,score:(country&&x.country.includes(country)?3:0)+(comp&&(x.competition.includes(comp)||comp.includes(x.competition))?2:0)})).sort((a:any,b:any)=>b.score-a.score);if(ranked.length>1&&ranked[0].score===ranked[1].score)return null;return ranked[0].form;};
  const home=choose(String(m.home_team)),away=choose(String(m.away_team));return home||away?{home,away,source:home?.source==="ESPN_UEFA_NATIONS_SCHEDULE"||away?.source==="ESPN_UEFA_NATIONS_SCHEDULE"?"ESPN_UEFA_NATIONS_SCHEDULE":home?.source==="ESPN_WOMEN_LAST10"||away?.source==="ESPN_WOMEN_LAST10"?"ESPN_WOMEN_LAST10":home?.source==="ESPN_FORM_LAST5"||away?.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":"OPENMATCHDAY_LAST10"}:null;
}
function poisson(lambda:number,k:number){let p=Math.exp(-lambda);for(let i=1;i<=k;i++)p*=lambda/i;return p;}
function historyModel(home:string,away:string,kickoff:string,history:any[],footyForm:any=null,publicForm:any=null,gender:string="men"){
 const cutoff=new Date(kickoff).getTime();
 const targetGender=String(gender||"unknown").toLowerCase();const teamRows=(team:string)=>history.filter((x:any)=>{const historyGender=String(x.gender||"unknown").toLowerCase();if(targetGender==="women"&&historyGender!=="women")return false;if(targetGender==="men"&&historyGender==="women")return false;if(targetGender==="unknown"&&historyGender!=="unknown")return false;const t=x.kickoff_at?new Date(x.kickoff_at).getTime():NaN;if(!Number.isFinite(t)||t>=cutoff)return false;const rr=Array.isArray(x.match_results)?x.match_results[0]:x.match_results;if(!rr||rr.verified!==true||rr.home_score==null||rr.away_score==null||!Number.isInteger(Number(rr.home_score))||!Number.isInteger(Number(rr.away_score)))return false;return normTeam(x.home_team)===team||normTeam(x.away_team)===team;}).sort((a:any,b:any)=>new Date(b.kickoff_at||0).getTime()-new Date(a.kickoff_at||0).getTime()).filter((x:any)=>{const t=x.kickoff_at?new Date(x.kickoff_at).getTime():NaN;return Number.isFinite(t)&&cutoff-t<=240*24*60*60*1000;}).slice(0,10).map((x:any)=>{const rr=Array.isArray(x.match_results)?x.match_results[0]:x.match_results;const isHome=normTeam(x.home_team)===team,gf=Number(isHome?rr.home_score:rr.away_score),ga=Number(isHome?rr.away_score:rr.home_score);return {date:String(x.kickoff_at||"").slice(0,10),opponent:isHome?x.away_team:x.home_team,gf,ga,pts:gf>ga?3:gf===ga?1:0};});
 const hLocal=teamRows(normTeam(home)),aLocal=teamRows(normTeam(away)),hf={...(footyForm?.home||{}),...(publicForm?.home||{})},af={...(footyForm?.away||{}),...(publicForm?.away||{})};
 const choose=(local:any[],fallback:any)=>{
  const supplemental=Array.isArray(fallback?.last10)?fallback.last10:(Array.isArray(fallback?.last5)?fallback.last5:[]);
  const externalRows=supplemental.map((x:any)=>({date:String(x.date||"").slice(0,10),opponent:String(x.opponent||""),gf:Number(x.goals_for||0),ga:Number(x.goals_against||0),xg_for:x.xg_for==null?null:Number(x.xg_for),xg_against:x.xg_against==null?null:Number(x.xg_against),source:String(x.source||x.xg_source||"").trim(),pts:x.result==="W"?3:x.result==="D"?1:0})).filter((x:any)=>{const t=Date.parse(String(x.date||"")+"T00:00:00Z");return Number.isFinite(t)&&t<cutoff&&cutoff-t<=240*24*60*60*1000;});
  const merged=[...local,...externalRows].filter((x:any)=>Number.isFinite(x.gf)&&Number.isFinite(x.ga)).sort((a:any,b:any)=>String(b.date||"").localeCompare(String(a.date||"")));
  const seen=new Set<string>(),rows=merged.filter((x:any)=>{const k=[x.date,normTeam(x.opponent),x.gf,x.ga].join("|");if(seen.has(k))return false;seen.add(k);return true;}).slice(0,10);
  if(rows.length>=3)return {rows,matches:rows.length,form:fallback||null,source:fallback?.source||"VERIFIED_MATCH_HISTORY"};
   const fallbackMatches=Number(fallback?.matches||((Number(fallback?.w)||0)+(Number(fallback?.d)||0)+(Number(fallback?.l)||0)));if(fallback&&fallbackMatches>=3)return {rows,matches:fallbackMatches,form:fallback,source:fallback.source||"FOOTYNOMAD_LAST5"};
  if(local.length)return {rows:local,matches:local.length,form:null,source:"PARTIAL_VERIFIED_HISTORY"};
  return {rows:[],matches:0,form:null,source:"BASELINE_ONLY"};
 };
 const hs=choose(hLocal,hf),as=choose(aLocal,af),avg=(xs:any[],k:string)=>xs.length?xs.reduce((s,x)=>s+Number(x[k]||0),0)/xs.length:0,hn=hs.matches,an=as.matches,n=Math.min(hn,an);
 let p1:number,px:number,p2:number,method:string,xgUsed=false,xgHomeMatches=0,xgAwayMatches=0,expectedHomeGoals:number|null=null,expectedAwayGoals:number|null=null,xgHomeSourceCounts:Record<string,number>={},xgAwaySourceCounts:Record<string,number>={};
 if(hs.rows.length>=3&&as.rows.length>=3){
  const xgCutoff=Date.parse(String(kickoff||""));
  const freshXg=(rows:any[])=>rows.filter((x:any)=>{const stamp=Date.parse(String(x.date||"")+"T00:00:00Z");return isRealXgObservation(x)&&Number.isFinite(stamp)&&Number.isFinite(xgCutoff)&&stamp<xgCutoff&&xgCutoff-stamp<=240*24*60*60*1000;});
  const externalHomeXg=freshXg(Array.isArray(hf?.xg_last10)?hf.xg_last10:[]);
  const externalAwayXg=freshXg(Array.isArray(af?.xg_last10)?af.xg_last10:[]);
  // Merge public xG feeds with local verified history instead of discarding
  // the local sample whenever an external source returns even one row.
  // Deduplicate same-date/same-xG observations and retain the latest ten.
  const mergeXg=(...groups:any[][])=>{
   const unique=new Map<string,any>();
   for(const row of groups.flat().sort((a:any,b:any)=>Date.parse(String(b.date||""))-Date.parse(String(a.date||"")))){
    const key=String(row.date||"").slice(0,10)+"|"+String(row.source||row.xg_source||"")+"|"+Number(row.xg_for).toFixed(3)+"|"+Number(row.xg_against).toFixed(3);
    if(!unique.has(key))unique.set(key,row);
   }
   return [...unique.values()].slice(0,10);
  };
  const hxgRows=mergeXg(externalHomeXg,freshXg(hs.rows));
  const axgRows=mergeXg(externalAwayXg,freshXg(as.rows));
  const hxg=hxgRows.length,axg=axgRows.length,useXg=hxg>=3&&axg>=3; xgUsed=useXg; xgHomeMatches=hxg; xgAwayMatches=axg; const countSources=(rows:any[])=>rows.reduce((acc:Record<string,number>,row:any)=>{const source=String(row.source||row.xg_source||"").trim().toLowerCase();if(source)acc[source]=(acc[source]||0)+1;return acc;},{});xgHomeSourceCounts=countSources(hxgRows);xgAwaySourceCounts=countSources(axgRows); const homeAttack=useXg?0.65*avg(hxgRows,"xg_for")+0.35*avg(hs.rows,"gf"):avg(hs.rows,"gf"),homeDefence=useXg?0.65*avg(hxgRows,"xg_against")+0.35*avg(hs.rows,"ga"):avg(hs.rows,"ga"),awayAttack=useXg?0.65*avg(axgRows,"xg_for")+0.35*avg(as.rows,"gf"):avg(as.rows,"gf"),awayDefence=useXg?0.65*avg(axgRows,"xg_against")+0.35*avg(as.rows,"ga"):avg(as.rows,"ga"),lh=clamp(((homeAttack+awayDefence)/2)*1.06,0.15,3.6),la=clamp(((awayAttack+homeDefence)/2)*0.94,0.15,3.6),hp=Array.from({length:9},(_,i)=>poisson(lh,i)),ap=Array.from({length:9},(_,i)=>poisson(la,i));
  p1=0;px=0;p2=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){const q=hp[i]*ap[j];if(i>j)p1+=q;else if(i===j)px+=q;else p2+=q;}const sum=p1+px+p2;p1/=sum;px/=sum;p2/=sum;expectedHomeGoals=+lh.toFixed(2);expectedAwayGoals=+la.toFixed(2);
  method=useXg?"Model Poissona: 65% średnie xG i xGA z ostatnich 10 meczów + 35% rzeczywiste gole, z korektą przewagi gospodarzy.":"Model Poissona na podstawie średnich goli strzelonych i straconych z ostatnich maksymalnie 10 spotkań, z niewielką korektą przewagi gospodarzy.";
 }else{
  const points=(s:any)=>s.rows.length?avg(s.rows,"pts"):(s.form?(Number(s.form.w||0)*3+Number(s.form.d||0))/Math.max(1,Number(s.form.matches||5)):1.25);
  const gd=(s:any)=>s.rows.length?avg(s.rows,"gf")-avg(s.rows,"ga"):(s.form&&s.form.goals_for!=null?(Number(s.form.goals_for)-Number(s.form.goals_against))/Math.max(1,Number(s.form.matches||5)):0);
  const diff=clamp(((points(hs)-points(as))*0.58+(gd(hs)-gd(as))*0.22)*0.62+0.22,-1.8,1.8),share=1/(1+Math.exp(-diff)),draw=clamp(0.275-Math.abs(diff)*0.025,0.19,0.275);p1=(1-draw)*share;p2=(1-draw)*(1-share);px=draw;
  method="Model formy W/D/L i różnicy bramek z dostępnych ostatnich spotkań; ograniczone dane oznaczają niższe pokrycie.";
 }
  let eloUsed=false,eloDiff:number|null=null,eloWeight=0,eloAsOf:string|null=null,eloHome:number|null=null,eloAway:number|null=null;
  const eh=Number(hf?.elo),ea=Number(af?.elo),rh=Number(hf?.rd),ra=Number(af?.rd),homeHfa=Number(hf?.hfa);
  if(Number.isFinite(eh)&&Number.isFinite(ea)&&Number.isFinite(rh)&&Number.isFinite(ra)){
   const drawPrior=clamp(px,0.18,0.34),expected=1/(1+Math.pow(10,-((eh-ea+(Number.isFinite(homeHfa)?homeHfa:45))/400)));
   let eloP1=clamp(expected-drawPrior/2,0,1),eloP2=clamp(1-expected-drawPrior/2,0,1);
   const remainder=1-drawPrior,eloSum=eloP1+eloP2;
   if(eloSum>0){eloP1=eloP1/eloSum*remainder;eloP2=eloP2/eloSum*remainder;}
   const avgRd=(rh+ra)/2;eloWeight=clamp(0.22*(100-avgRd)/35,0.05,0.22);
   if(hn===0&&an===0){p1=eloP1;px=drawPrior;p2=eloP2;eloWeight=1;method="Model Elo BeyondELO: rating obu klubów i przewaga własnego boiska; brak historii formy.";}
   else {p1=p1*(1-eloWeight)+eloP1*eloWeight;p2=p2*(1-eloWeight)+eloP2*eloWeight;method+=" Uzupełniono ratingiem Elo BeyondELO.";}
   eloUsed=true;eloHome=eh;eloAway=ea;eloDiff=+(eh-ea).toFixed(1);eloAsOf=hf?.elo_as_of||af?.elo_as_of||null;
  }
  const xgSources=[...new Set([...Object.keys(xgHomeSourceCounts),...Object.keys(xgAwaySourceCounts)])];
  // Do not sharpen model probabilities with hard-coded temperatures until a
  // reproducible, versioned out-of-sample calibration report is available.
  // Keep raw model probabilities neutral rather than claiming an unverified calibration.
  const calibrationTemperature: number=1,calibrationMethod="none_unverified_calibration_disabled";
  if(calibrationTemperature!==1){
   const scaled=[p1,px,p2].map((p:number)=>Math.exp(Math.log(Math.max(p,1e-15))/calibrationTemperature));
   const scaledSum=scaled.reduce((sum:number,value:number)=>sum+value,0);
   p1=scaled[0]/scaledSum;px=scaled[1]/scaledSum;p2=scaled[2]/scaledSum;
   method+=` Skalowanie temperaturą ${calibrationTemperature.toFixed(2)} (walidacja chronologiczna).`;
  }
  const total=p1+px+p2;
  let source="BASELINE_ONLY";
  if(hs.source==="STATSBOMB_OPEN_DATA"||as.source==="STATSBOMB_OPEN_DATA")source="STATSBOMB_OPEN_DATA";
  else if(hs.source==="AMERICAN_SOCCER_ANALYSIS"||as.source==="AMERICAN_SOCCER_ANALYSIS")source="AMERICAN_SOCCER_ANALYSIS";
  else if(hs.source==="KEYLESS_GITHUB_LAST10"||as.source==="KEYLESS_GITHUB_LAST10")source="KEYLESS_GITHUB_LAST10";
  else if(hs.source==="ESPN_UEFA_NATIONS_SCHEDULE"||as.source==="ESPN_UEFA_NATIONS_SCHEDULE")source="ESPN_UEFA_NATIONS_SCHEDULE";
  else if(hs.source==="ESPN_WOMEN_LAST10"||as.source==="ESPN_WOMEN_LAST10")source="ESPN_WOMEN_LAST10";
  else if(hs.source==="ESPN_FORM_LAST5"||as.source==="ESPN_FORM_LAST5")source="ESPN_FORM_LAST5";
   else if(hs.source==="OPENMATCHDAY_LAST10"||as.source==="OPENMATCHDAY_LAST10")source="OPENMATCHDAY_LAST10";
  else if(hs.source==="FOTBALINFO_PREMATCH"||as.source==="FOTBALINFO_PREMATCH")source="FOTBALINFO_PREMATCH";
  else if(hs.source==="VERIFIED_MATCH_HISTORY"&&as.source==="VERIFIED_MATCH_HISTORY")source="VERIFIED_MATCH_HISTORY";
  else if(footyForm)source="FOOTYNOMAD_LAST5";
  else if(hn>0||an>0)source="PARTIAL_VERIFIED_HISTORY";
  if(eloUsed&&hn===0&&an===0)source="BEYONDELO_ONLY";
  const coverage=source==="BEYONDELO_ONLY"?35:source==="ESPN_FORM_LAST5"?45:(n>0?Math.min(75,n*15):(eloUsed?35:0));
  return {p1:+(p1/total*100).toFixed(1),px:+(px/total*100).toFixed(1),p2:+(p2/total*100).toFixed(1),coverage,home_matches:hn,away_matches:an,home_form:Object.keys(hf).length?hf:null,away_form:Object.keys(af).length?af:null,source,footyForm:!!footyForm,publicForm:source==="OPENMATCHDAY_LAST10"||source==="ESPN_WOMEN_LAST10"||source==="ESPN_FORM_LAST5",espnWomenForm:source==="ESPN_WOMEN_LAST10",pitchForm:source==="PITCHAPI_LAST5",method,expected_home_goals:expectedHomeGoals,expected_away_goals:expectedAwayGoals,expected_total_goals:expectedHomeGoals==null||expectedAwayGoals==null?null:+(expectedHomeGoals+expectedAwayGoals).toFixed(2),xg_used:xgUsed,xg_home_matches:xgHomeMatches,xg_away_matches:xgAwayMatches,xg_home_source_counts:xgHomeSourceCounts,xg_away_source_counts:xgAwaySourceCounts,xg_sources:xgSources,calibration_temperature:calibrationTemperature,calibration_method:calibrationMethod,elo_used:eloUsed,elo_home:eloHome,elo_away:eloAway,elo_diff:eloDiff,elo_weight:eloWeight,elo_as_of:eloAsOf};
 return {p1:+(p1/total*100).toFixed(1),px:+(px/total*100).toFixed(1),p2:+(p2/total*100).toFixed(1),coverage:Math.min(75,n*15),home_matches:hn,away_matches:an,home_form:hf||null,away_form:af||null,source,footyForm:!!footyForm,publicForm:source==="OPENMATCHDAY_LAST10",pitchForm:source==="PITCHAPI_LAST5",method};
}
const INTERNATIONAL_RESULTS_URL="https://raw.githubusercontent.com/martj42/international_results/master/results.csv";
let internationalHistoryCache:any=null,internationalHistoryCacheAt=0;
function parseCsvRows(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===","&&!quoted){row.push(cell);cell="";}
  else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(v=>v.trim()))rows.push(row);row=[];}
  else cell+=c;
 }
 if(cell.length||row.length){row.push(cell);rows.push(row);}
 return rows;
}
async function readInternationalTeamForms(targetDate:string){
 if(internationalHistoryCache&&Date.now()-internationalHistoryCacheAt<6*60*60*1000)return internationalHistoryCache;
 const forms=new Map<string,any>();
 try{
  const response=await fetch(INTERNATIONAL_RESULTS_URL,{headers:{"User-Agent":"MoneyballGlobal/3.9","Accept":"text/csv"},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error("International results HTTP "+response.status);
  const raw=await response.text();
  if(raw.length<1000||raw.length>12000000)throw new Error("International results file size validation failed");
  const rows=parseCsvRows(raw),headers=rows[0]?.map(x=>x.trim().toLowerCase())||[];
  const ix=(name:string)=>headers.indexOf(name);
  for(const name of ["date","home_team","away_team","home_score","away_score","tournament"])if(ix(name)<0)throw new Error("Missing CSV column "+name);
  const byTeam=new Map<string,any[]>();
  for(const row of rows.slice(1)){
   const date=String(row[ix("date")]||"").slice(0,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>=targetDate)continue;
   const age=Date.parse(targetDate+"T00:00:00Z")-Date.parse(date+"T00:00:00Z");
   if(!Number.isFinite(age)||age<0||age>240*86400000)continue;
   const home=String(row[ix("home_team")]||"").trim(),away=String(row[ix("away_team")]||"").trim();
   const hg=Number(row[ix("home_score")]),ag=Number(row[ix("away_score")]),tournament=String(row[ix("tournament")]||"").trim();
   if(!home||!away||!Number.isInteger(hg)||!Number.isInteger(ag))continue;
   const add=(team:string,opponent:string,gf:number,ga:number)=>{
    const key=fixtureTeamKey(team),list=byTeam.get(key)||[];
    list.push({date,opponent,result:gf>ga?"W":gf<ga?"L":"D",goals_for:gf,goals_against:ga,competition:tournament,source:"INTERNATIONAL_RESULTS_CC0"});
    byTeam.set(key,list);
   };
   add(home,away,hg,ag);add(away,home,ag,hg);
  }
  for(const [key,list] of byTeam){
   const last10=list.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
   if(last10.length<3)continue;
   const w=last10.filter(x=>x.result==="W").length,d=last10.filter(x=>x.result==="D").length,l=last10.filter(x=>x.result==="L").length;
   forms.set(key,{matches:last10.length,w,d,l,points:w*3+d,goals_for:last10.reduce((n,x)=>n+x.goals_for,0),goals_against:last10.reduce((n,x)=>n+x.goals_against,0),last10,source:"INTERNATIONAL_RESULTS_CC0"});
  }
  const sourceDates=rows.slice(1).map(row=>String(row[ix("date")]||"").slice(0,10)).filter(x=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x)).sort();const latestDate=sourceDates[sourceDates.length-1]||null;for(const form of forms.values()){form.source_url=INTERNATIONAL_RESULTS_URL;form.source_as_of=latestDate;}internationalHistoryCache={forms,generated_at:new Date().toISOString(),source_as_of:latestDate,source_url:INTERNATIONAL_RESULTS_URL,rows:rows.length-1,teams:forms.size,error:null};
 }catch(error){internationalHistoryCache={forms,generated_at:null,rows:0,teams:0,error:String(error)};}
 internationalHistoryCacheAt=Date.now();return internationalHistoryCache;
}
async function readGitHubPublicTeamHistory(){
 try{
  const r=await fetch("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/team-form.json",{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(18000)});
  if(!r.ok)throw new Error("GitHub public history HTTP "+r.status);
  const data=await r.json();
  if(data?.schema_version!==1||!data?.teams||Object.keys(data.teams).length<100)throw new Error("GitHub public history validation failed");
  return data;
 }catch(e){return {teams:{},error:String(e),generated_at:null,coverage:null};}
}
let historicalXgCache:any=null;let historicalXgCacheAt=0;
async function readOpenPlayXgData(){
 if(historicalXgCache&&Date.now()-historicalXgCacheAt<30*60*1000)return historicalXgCache;
 const teams:Record<string,any>={};
 const loadXgDataset=async(url:string,minTeams:number,label:string)=>{
  const response=await fetch(url,{headers:{"Accept":"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw new Error(label+" HTTP "+response.status);
  const data=await response.json();
  if(data?.schema_version!==1||!data?.teams||Object.keys(data.teams).length<minTeams)throw new Error(label+" validation failed");
  return data;
 };
 // These public archives are independent. Fetch concurrently so a cold Edge
 // isolate pays the slowest source latency, not the sum of all three timeouts.
 const [openplayResult,statsbombResult,asaResult]=await Promise.allSettled([
  loadXgDataset("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/openplay-xg.json",100,"OpenPlay xG"),
  loadXgDataset("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/statsbomb-xg.json",80,"StatsBomb xG"),
  loadXgDataset("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/asa-xg.json",20,"American Soccer Analysis xG"),
 ]);
 const openplay=openplayResult.status==="fulfilled"?openplayResult.value:null;
 const statsbomb=statsbombResult.status==="fulfilled"?statsbombResult.value:null;
 const asa=asaResult.status==="fulfilled"?asaResult.value:null;
 if(openplayResult.status==="rejected")console.error("OpenPlay xG history unavailable:",String(openplayResult.reason));
 if(statsbombResult.status==="rejected")console.error("StatsBomb xG history unavailable:",String(statsbombResult.reason));
 if(asaResult.status==="rejected")console.error("American Soccer Analysis xG history unavailable:",String(asaResult.reason));
 for(const [source,defaultGender] of [[openplay,"men"],[statsbomb,null],[asa,null]] as any[]){
  for(const [key,entry] of Object.entries(source?.teams||{})){
   const sourceGender=defaultGender||(entry as any).gender||"unknown";
   const current=teams[key]||{name:(entry as any).name,gender:sourceGender,matches:[]};
   const incoming=((entry as any).matches||[]).map((x:any)=>({...x,gender:x.gender||sourceGender}));
   const merged=[...(current.matches||[]),...incoming],deduped=new Map<string,any>();
   const sourcePriority=(x:any)=>{const s=String(x.source||"").toLowerCase();return s.includes("statsbomb")?3:s.includes("american_soccer_analysis")?2:s.includes("openplay")?1:0;};
   for(const match of merged){
    const opponent=normTeam(match.opponent||"");
    const hasScore=match.goals_for!=null&&match.goals_against!=null;
    const key=match.date&&opponent?String(match.date)+"|"+opponent+(hasScore?"|"+match.goals_for+"|"+match.goals_against:""):String(match.match_id||JSON.stringify(match));
    const existing=deduped.get(key);
    if(!existing||sourcePriority(match)>sourcePriority(existing))deduped.set(key,match);
   }
   current.matches=[...deduped.values()].sort((a:any,b:any)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,30);
   if(current.gender==="unknown")current.gender=sourceGender;
   teams[key]=current;
  }
 }
 historicalXgCache={teams,generated_at:openplay?.generated_at||statsbomb?.generated_at||asa?.generated_at||null,coverage:{openplay:openplay?.coverage||null,statsbomb:statsbomb?.coverage||null,american_soccer_analysis:asa?.coverage||null},openplay_generated_at:openplay?.generated_at||null,statsbomb_generated_at:statsbomb?.generated_at||null,asa_generated_at:asa?.generated_at||null,error:!openplay&&!statsbomb&&!asa?"OpenPlay, StatsBomb and ASA xG datasets unavailable":null};historicalXgCacheAt=Date.now();return historicalXgCache;
}
function githubTeamForm(team:string,kickoff:string,data:any,xgData:any=null,gender:string="men"){
 const key=normTeam(team),teams=data?.teams||{},xgTeams=xgData?.teams||{};
 const bestKey=(source:Record<string,any>,queryKey=key)=>{
  const tokens=new Set(queryKey.split(" ").filter(x=>x.length>2));
  const candidates=Object.keys(source).map(k=>{const other=new Set(k.split(" ").filter(x=>x.length>2));return {k,score:tokens.size&&other.size?[...tokens].filter(x=>other.has(x)).length/Math.max(tokens.size,other.size):0};}).filter(x=>x.score>=0.8).sort((x,y)=>y.score-x.score);
  return candidates.length&&(!candidates[1]||candidates[0].score-candidates[1].score>=0.12)?candidates[0].k:null;
 };
 const rawGender=String(gender||"unknown").toLowerCase();
 const targetGender=rawGender==="women"?"women":rawGender==="men"?"men":"unknown";
 const ageGroup=/(?:\bu(?:15|16|17|18|19|20|21|23)\b|\bunder[- ]?(?:15|16|17|18|19|20|21|23)\b|\b(?:reserve|reserves|academy|youth|b team|ii|iii)\b)/i.test(team);
 if(targetGender==="unknown"&&!ageGroup)return null;
 const resolvedKey=teams[key]?key:(bestKey(teams)||key);
 const teamEntry=teams[resolvedKey];
 const teamMatches=Array.isArray(teamEntry?.matches)?teamEntry.matches.filter((x:any)=>{
  const g=String(x.gender||teamEntry.gender||"unknown").toLowerCase();
  if(targetGender==="women")return g==="women";
  if(targetGender==="men")return g!=="women";
  return true;
 }):[];
 const xgLookupKey=targetGender==="women"&&xgTeams[key+" women"]?key+" women":key;
 const xgKey=xgTeams[xgLookupKey]?xgLookupKey:(xgTeams[resolvedKey]?resolvedKey:(bestKey(xgTeams,xgLookupKey)||resolvedKey));
 const xgEntry=xgTeams[xgKey];
 const genderMatches=targetGender!=="unknown"&&Array.isArray(xgEntry?.matches)?xgEntry.matches.filter((x:any)=>String(x.gender||xgEntry.gender||"unknown").toLowerCase()===targetGender):[];
 let usedXgHistoryForForm=teamMatches.length===0&&genderMatches.length>0;
 const entry=teamMatches.length?{matches:teamMatches}:genderMatches.length?{matches:genderMatches}:null;
 if(!entry||!Array.isArray(entry.matches))return null;
 const cutoff=String(kickoff||"").slice(0,10);
 let last=entry.matches.filter((x:any)=>String(x.date||"")<cutoff).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))).slice(0,10);
 const kickoffDate=Date.parse(cutoff+"T00:00:00Z");
 const recentEnough=(rows:any[])=>rows.length&&Number.isFinite(kickoffDate)&&Number.isFinite(Date.parse(String(rows[0].date||"")+"T00:00:00Z"))&&kickoffDate-Date.parse(String(rows[0].date||"")+"T00:00:00Z")<=240*24*60*60*1000;
 // Prefer the team's own gender-tagged results; use gender-matched xG results only as a recent fallback.
 if(!recentEnough(last)&&genderMatches.length){
  const xgForm=genderMatches.filter((x:any)=>String(x.date||"")<cutoff).sort((a:any,b:any)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,10).map((x:any)=>({...x,result:x.result||"D"}));
  if(recentEnough(xgForm)){last=xgForm;usedXgHistoryForForm=true;}
 }
 if(!recentEnough(last))return null;
 const w=last.filter((x:any)=>x.result==="W").length,d=last.filter((x:any)=>x.result==="D").length,l=last.filter((x:any)=>x.result==="L").length;
 const mean=(k:string)=>{const vals=last.map((x:any)=>x[k]).filter((x:any)=>x!==null&&x!==undefined&&Number.isFinite(Number(x)));return vals.length?+(vals.reduce((sum:number,v:any)=>sum+Number(v),0)/vals.length).toFixed(2):null;};
 const cutoffMs=Date.parse(cutoff+"T00:00:00Z"),xgMinDate=new Date(cutoffMs-540*24*60*60*1000).toISOString().slice(0,10);
 const xgLast=genderMatches.filter((x:any)=>String(x.date||"")<cutoff&&String(x.date||"")>=xgMinDate&&x.xg_for!=null&&x.xg_against!=null&&Number.isFinite(Number(x.xg_for))&&Number.isFinite(Number(x.xg_against))).sort((a:any,b:any)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,10).map((x:any)=>({date:x.date,opponent:x.opponent,xg_for:Number(x.xg_for),xg_against:Number(x.xg_against),goals_for:Number(x.goals_for),goals_against:Number(x.goals_against),source:String(x.source||"HISTORICAL_XG")}));
 return {matches:last.length,w,d,l,goals_for:last.reduce((sum:number,x:any)=>sum+Number(x.goals_for||0),0),goals_against:last.reduce((sum:number,x:any)=>sum+Number(x.goals_against||0),0),last10:last.map((x:any)=>({date:x.date,opponent:x.opponent,result:x.result,goals_for:x.goals_for,goals_against:x.goals_against,shots_for:x.shots_for,shots_against:x.shots_against,shots_on_target_for:x.shots_on_target_for,shots_on_target_against:x.shots_on_target_against,corners_for:x.corners_for,corners_against:x.corners_against,fouls_for:x.fouls_for,fouls_against:x.fouls_against,yellow_for:x.yellow_for,yellow_against:x.yellow_against,red_for:x.red_for,red_against:x.red_against})),xg_last10:xgLast,avg_shots_for:mean("shots_for"),avg_shots_against:mean("shots_against"),avg_shots_on_target_for:mean("shots_on_target_for"),avg_shots_on_target_against:mean("shots_on_target_against"),avg_corners_for:mean("corners_for"),avg_corners_against:mean("corners_against"),avg_fouls_for:mean("fouls_for"),source:usedXgHistoryForForm?(String(last[0]?.source||"").toLowerCase().includes("american_soccer_analysis")?"AMERICAN_SOCCER_ANALYSIS":String(last[0]?.source||"").toLowerCase().includes("statsbomb")?"STATSBOMB_OPEN_DATA":"KEYLESS_GITHUB_LAST10"):"KEYLESS_GITHUB_LAST10",xg_gender_eligible:targetGender!=="unknown",gender_history_matches:teamMatches.length};
}

Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:C});try{
 if(req.method==="GET")return out({ok:true,model:V,provider:"Keyless OpenMatchday/OpenFootball + OpenPlay xG + StatsBomb Open Data xG + American Soccer Analysis xG + BeyondELO + verified results + FootyNomad + fresh market probabilities",apiFootballDisabled:true});
 if(req.method!=="POST")return out({error:"POST required"},405);
 const body=await req.json().catch(()=>({}));
 let token=req.headers.get("Authorization")?.replace("Bearer ","")||"";
 let ownerId="";
 const cronToken=req.headers.get("x-cron-token")||"";
 CRON_FALLBACK_TOKEN=cronToken;
 if(cronToken){
  if(!SERVICE_KEY)throw Error("Brak konfiguracji bezpiecznego klucza serwisowego.");
  const check=await fetch(S+"/rest/v1/rpc/moneyball_cron_token_valid",{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_token:cronToken})});
  if(!check.ok||(await check.json())!==true)throw Error("Nieprawidłowy token harmonogramu.");
  ownerId=String(body.owner_id||"");
  if(!ownerId)throw Error("Brak właściciela dla automatycznego skanu.");
  token=SERVICE_KEY;
 }else{
  if(!token)throw Error("Zaloguj się ponownie.");
  const jwtParts=token.split(".");
  const jwtPayload=jwtParts.length>1?JSON.parse(atob(jwtParts[1].replace(/-/g,"+").replace(/_/g,"/"))):{};
  ownerId=String(jwtPayload.sub||"");
  if(!ownerId)throw Error("Nie można odczytać właściciela sesji.");
 }
 const date=String(body.date||new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
 const scheduledMode=body.mode==="scheduled"&&!!cronToken;
 const requestedOffset=Number.isFinite(Number(body.offset))?Math.max(0,Math.floor(Number(body.offset))):0;
 const analysisOffset=Math.min(requestedOffset,10000);
 const requestedBatchSize=Number.isFinite(Number(body.batch_size))?Math.floor(Number(body.batch_size)):10;
 const batchSize=Math.max(1,Math.min(10,requestedBatchSize));
 let scanLeaseToken:string|null=null,scanCursorKickoff:string|null=null,scanCursorId:string|null=null;
 if(scheduledMode){
  const claim=await db("rpc/moneyball_claim_prediction_scan",token,"POST",{p_owner_id:ownerId,p_date:date,p_token:cronToken});
  if(!claim?.claimed)return out({ok:true,scheduled:true,skipped:true,reason:claim?.reason||"not_claimed",next_scan_at:claim?.next_scan_at||null});
  scanLeaseToken=String(claim.lease_token||"");
  if(!scanLeaseToken)throw Error("Harmonogram nie otrzymał tokenu blokady.");
  scanCursorKickoff=claim.cursor_kickoff_at||null;
  scanCursorId=claim.cursor_match_id||null;
 }
 // Query only the exact Europe/Brussels calendar day. This avoids earlier UTC-day
 // fixtures consuming pagination slots before today's local fixtures.
 const nextDateObj=new Date(date+"T12:00:00Z");nextDateObj.setUTCDate(nextDateObj.getUTCDate()+1);
 const nextDate=nextDateObj.toISOString().slice(0,10);
 const brusselsMidnightUtc=(day:string)=>{
  const utcMidnight=new Date(day+"T00:00:00.000Z");
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(utcMidnight);
  const values=Object.fromEntries(parts.map((part:any)=>[part.type,part.value]));
  const localClockAsUtc=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));
  return new Date(utcMidnight.getTime()-(localClockAsUtc-utcMidnight.getTime())).toISOString();
 };
 const fromUtc=brusselsMidnightUtc(date);
 const toUtc=brusselsMidnightUtc(nextDate);
 let scheduledImport:any={ok:true,attempted:false,feed_rows:0,public_rows:0,eligible_rows:0,inserted:0};
 // The minute cron previously predicted only rows already present in matches.
 // Import the refreshed global FootyNomad feed and public European fixtures on
 // the first page of each scheduled scan, before the scan cursor is read.
 if(scheduledMode&&!scanCursorKickoff&&!scanCursorId){
  scheduledImport={ok:true,attempted:true,feed_rows:0,public_rows:0,eligible_rows:0,inserted:0};
  try{
   let feedRows:any[]=[];
   let feedError:string|null=null;
   try{
    feedRows=await db("moneyball_global_fixture_feed?select=scan_date,external_id,source,competition,country,gender,home_team,away_team,kickoff_at,status&scan_date=eq."+encodeURIComponent(date)+"&order=kickoff_at.asc",token);
   }catch(e){feedError=String(e);}
   const publicForImport=await readPublicSourceForms(date);
   const publicRows=Array.isArray(publicForImport.fixtureRows)?publicForImport.fixtureRows:[];
   const candidates=[...feedRows,...publicRows];
   const fixtureDay=(f:any)=>brusselsFixtureDay(f.kickoff_at)||String(f.scan_date||f.date||f.kickoff_date||"").slice(0,10);
   const eligible=candidates.filter((f:any)=>fixtureDay(f)===date&&isEligibleScheduledFixture(f)&&String(f.source||"").trim()&&String(f.external_id||"").trim()&&String(f.competition||f.league||"").trim()&&String(f.home_team||f.home||"").trim()&&String(f.away_team||f.away||"").trim());
   const existingRows=await db("matches?select=source,external_id,country,competition,league,gender,home_team,away_team,kickoff_at,kickoff_date&owner_id=eq."+encodeURIComponent(ownerId)+"&or=(and(kickoff_at.gte."+encodeURIComponent(fromUtc)+",kickoff_at.lt."+encodeURIComponent(toUtc)+"),kickoff_date.eq."+date+")",token);
   const identity=(f:any)=>normTeam(f.home_team||f.home)+"|"+normTeam(f.away_team||f.away)+"|"+fixtureDay(f);
   const existingKeys=new Set((existingRows||[]).filter((f:any)=>isEligibleScheduledFixture(f)).map(identity));
   const sourceRank=(f:any)=>String(f.source||"").toLowerCase()==="footynomad"?0:String(f.source||"").toLowerCase()==="openmatchday"?1:2;
   const selected=new Map<string,any>();
   let skippedExisting=0,deduplicatedCandidates=0;
   for(const f of eligible){
    const key=identity(f);
    if(existingKeys.has(key)){skippedExisting++;continue;}
    const previous=selected.get(key);
    if(previous){deduplicatedCandidates++;if(sourceRank(f)<sourceRank(previous))selected.set(key,f);}
    else selected.set(key,f);
   }
   const rows=[...selected.values()].map((f:any)=>({
    owner_id:ownerId,scan_run_id:null,external_id:String(f.external_id),source:String(f.source),
    competition:f.competition||f.league||null,league:f.league||f.competition||null,country:f.country||null,
    gender:"men",home_team:String(f.home_team||f.home),away_team:String(f.away_team||f.away),
    kickoff_at:f.kickoff_at||null,kickoff_date:date,status:String(f.status||"scheduled").toLowerCase()
   }));
   let saved:any[]=[];
   if(rows.length)saved=await db("matches?on_conflict=owner_id,source,external_id",token,"POST",rows,"resolution=ignore-duplicates,return=representation");
   const sourceCounts:Record<string,number>={};
   for(const f of eligible){const key=String(f.source||"unknown");sourceCounts[key]=(sourceCounts[key]||0)+1;}
   scheduledImport={ok:!feedError&&!publicForImport.error,attempted:true,scope:"EUROPE_MENS_DOMESTIC_TIER_1_2",feed_rows:feedRows.length,public_rows:publicRows.length,eligible_rows:eligible.length,inserted:Array.isArray(saved)?saved.length:0,skipped_existing:skippedExisting,deduplicated_candidates:deduplicatedCandidates,source_counts:sourceCounts,feed_error:feedError,public_source_error:publicForImport.error||null};
  }catch(e){scheduledImport={ok:false,attempted:true,error:String(e)};}
 }
 if(scheduledImport.attempted)console.log("scheduled_import",JSON.stringify(scheduledImport));
 let scheduledPage:any=null,manualPage:any=null;
 const all=scheduledMode
  ?(scheduledPage=await db("rpc/moneyball_prediction_scan_page",token,"POST",{p_owner_id:ownerId,p_date:date,p_cursor_kickoff_at:scanCursorKickoff,p_cursor_match_id:scanCursorId,p_limit:batchSize,p_token:cronToken})).rows||[]
  :(manualPage=await db("rpc/moneyball_manual_prediction_scan_page",token,"POST",{p_date:date,p_offset:analysisOffset,p_limit:batchSize})).rows||[];
 const moreAvailable=scheduledMode?!!scheduledPage?.has_more:!!manualPage?.has_more;
 const lastRawMatch=all.length?all[all.length-1]:null;
 const finishScheduledScan=async(processed:number)=>{
  if(!scheduledMode||!scanLeaseToken)return null;
  return await db("rpc/moneyball_finish_prediction_scan",token,"POST",{
   p_owner_id:ownerId,p_date:date,p_lease_token:scanLeaseToken,
   p_cursor_kickoff_at:lastRawMatch?.kickoff_at||scanCursorKickoff,
   p_cursor_match_id:lastRawMatch?.id||scanCursorId,
   p_has_more:moreAvailable,p_processed:processed,p_token:cronToken
  });
 };
 const dateFromExternalId=(m:any)=>/:(\\d{4}-\\d{2}-\\d{2}):/.exec(String(m.external_id||""))?.[1]||null;
 const matchDate=(m:any)=>m.kickoff_at?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(m.kickoff_at)):(String(m.kickoff_date||"").slice(0,10)||dateFromExternalId(m));
 const rawDateMatches=all.filter((m:any)=>matchDate(m)===date&&isEligibleScheduledFixture(m));
 const deduped=dedupeFixturesByDate(rawDateMatches,matchDate);const matches=deduped.matches;const duplicatesRemoved=deduped.duplicatesRemoved;
 const historyFields="select=id,home_team,away_team,kickoff_at,gender,match_results(home_score,away_score,verified)";
 const historySince=new Date(Date.parse(date+"T00:00:00Z")-240*24*60*60*1000).toISOString();
 const pageMatchIds=matches.map((m:any)=>String(m.id)).filter(Boolean);
 const pageMatchFilter=pageMatchIds.length?"&match_id=in.("+pageMatchIds.join(",")+")":"";
 // These reads do not depend on one another. Run them together to avoid paying
 // the sum of several network round-trips for every analysis batch.
 const providerOddsQuery=matches.length?db("provider_odds?select=match_id,mapped_market,mapped_selection,odds,bookmaker,provider,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&suspended=eq.false&phase=eq.prematch&captured_at=gte."+encodeURIComponent(new Date(Date.now()-6*60*60*1000).toISOString())+"&mapped_market=not.is.null&mapped_selection=not.is.null&match_id=in.("+matches.map((x:any)=>x.id).join(",")+")&order=captured_at.desc",token).catch(()=>[]):Promise.resolve([]);
 const [historyTimed,footyCacheRows,fotbalCacheRows,xgoalsCacheRows,publicForms,marketRows,providerOddsRows,tipsAudit]=await Promise.all([
  db("matches?"+historyFields+"&owner_id=eq."+encodeURIComponent(ownerId)+"&kickoff_at=gte."+encodeURIComponent(historySince)+"&kickoff_at=lt."+encodeURIComponent(date+"T23:59:59Z")+"&order=kickoff_at.desc&limit=1500",token).catch((e:any)=>{console.error("Timed history query unavailable:",String(e));return [];}),
  pageMatchIds.length?db("match_market_data?select=match_id,provider_data,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&source=eq.FootyNomad"+pageMatchFilter,token).catch(()=>[]):Promise.resolve([]),
  pageMatchIds.length?db("match_market_data?select=match_id,provider_data,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&source=eq.FotbalInfo"+pageMatchFilter,token).catch(()=>[]):Promise.resolve([]),
  pageMatchIds.length?db("match_market_data?select=match_id,provider_data,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&source=eq.XGoalsPro"+pageMatchFilter,token).catch(()=>[]):Promise.resolve([]),
  readPublicSourceForms(date),
  pageMatchIds.length?db("match_market_data?select=match_id,provider_data,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&source=eq.StrikerAPI"+pageMatchFilter,token):Promise.resolve([]),
  providerOddsQuery,
  readTipsAuditFairMarket(date,matches),
 ]);
 // Load every external history dataset explicitly before scoring. Optional-source
// failures degrade coverage, never abort an entire prediction batch.
const [githubHistoryResult,xgHistoryResult,internationalHistoryResult]=await Promise.allSettled([
 readGitHubPublicTeamHistory(),
 readOpenPlayXgData(),
 readInternationalTeamForms(date),
]);
const githubPublic=githubHistoryResult.status==="fulfilled"&&githubHistoryResult.value?.teams
 ?githubHistoryResult.value:{teams:{},generated_at:null,coverage:null,error:githubHistoryResult.status==="rejected"?String(githubHistoryResult.reason):"GitHub history unavailable"};
const openPlayXg=xgHistoryResult.status==="fulfilled"&&xgHistoryResult.value?.teams
 ?xgHistoryResult.value:{teams:{},generated_at:null,coverage:null,openplay_generated_at:null,statsbomb_generated_at:null,asa_generated_at:null,error:xgHistoryResult.status==="rejected"?String(xgHistoryResult.reason):"Historical xG unavailable"};
const internationalForms=internationalHistoryResult.status==="fulfilled"&&internationalHistoryResult.value?.forms
 ?internationalHistoryResult.value:{forms:new Map(),generated_at:null,rows:0,teams:0,error:internationalHistoryResult.status==="rejected"?String(internationalHistoryResult.reason):"International history unavailable"};
const history=historyTimed||[];
 const footyCacheMap=new Map((footyCacheRows||[]).map((row:any)=>[row.match_id,row.provider_data]));
 const fotbalCacheMap=new Map<string,any>((fotbalCacheRows||[]).map((row:any)=>[row.match_id,row.provider_data]));
 const xgoalsCacheMap=new Map<string,any>((xgoalsCacheRows||[]).map((row:any)=>[row.match_id,row.provider_data]));
 const marketMap=new Map((marketRows||[]).map((x:any)=>[x.match_id,x.provider_data]));
 const providerOddsMap=new Map<string,any>();
 for(const quote of (providerOddsRows||[])){
  const key=String(quote.match_id)+"|"+String(quote.mapped_market)+"|"+String(quote.mapped_selection);
  const previous=providerOddsMap.get(key);
  if(!previous||Date.parse(String(quote.captured_at||""))>Date.parse(String(previous.captured_at||"")))providerOddsMap.set(key,quote);
 }
 const americanToDecimal=(value:any)=>{const n=Number(value);if(!Number.isFinite(n)||n===0)return null;return +(n>0?1+n/100:1+100/Math.abs(n)).toFixed(3);};

 if(!matches.length){const scanState=await finishScheduledScan(all.length);return out({ok:true,date,total:0,matches:0,offset:analysisOffset,batch_size:batchSize,has_more:moreAvailable,predictions:0,created:0,updated:0,preserved:0,covered:0,missing:0,selected:0,scheduled:scheduledMode,scheduled_import:scheduledImport,scan_state:scanState,message:moreAvailable?"Brak kwalifikujących się meczów w tej partii; skan przechodzi dalej.":"Brak kolejnych kwalifikujących się meczów."});}
 // Add a no-key public score-history fallback for teams missing recent verified results.
 const xgoalsTeamForms=new Map<string,any>(),xgoalsCandidates=new Map<string,{team:string,country:string,kickoff:string}>();
 for(const m of matches){
  if(fixtureGender(m)!=="men"||!["scheduled","unknown"].includes(String(m.status||""))||!m.kickoff_at||new Date(m.kickoff_at).getTime()<=Date.now())continue;
  const cached=xgoalsCacheMap.get(m.id),age=cached?.fetched_at?Date.now()-Date.parse(cached.fetched_at):Infinity;
  if(cached?.source==="XGOALSPRO_PUBLIC_RESULTS"&&age>=0&&age<6*60*60*1000){
   if(cached.home?.last10?.length>=3)xgoalsTeamForms.set(normTeam(m.home_team),cached.home);
   if(cached.away?.last10?.length>=3)xgoalsTeamForms.set(normTeam(m.away_team),cached.away);
  }
  for(const team of [String(m.home_team||""),String(m.away_team||"")]){
   const key=normTeam(team);
   if(team&&key&&!xgoalsTeamForms.has(key)&&!xgoalsCandidates.has(key))xgoalsCandidates.set(key,{team,country:String(m.country||""),kickoff:String(m.kickoff_at)});
  }
 }
 // xGoalsPro publishes public, keyless team results pages. Fetch each missing team once per batch.
 // Concurrency is bounded and successful forms are cached by fixture for six hours.
 const xgoalsResults=await limitedSettled([...xgoalsCandidates.values()].slice(0,20),4,async(item:any)=>({
  ...item,form:await readXgoalsTeamForm(item.team,item.country,item.kickoff)
 }));
 for(const result of xgoalsResults){
  if(result.status!=="fulfilled"||!result.value?.form)continue;
  const value=result.value;
  xgoalsTeamForms.set(normTeam(value.team),{...value.form,fetched_at:new Date().toISOString()});
 }
 const xgoalsCacheWrites:any[]=[];
 for(const m of matches){
  const home=xgoalsTeamForms.get(normTeam(m.home_team)),away=xgoalsTeamForms.get(normTeam(m.away_team));
  if(!home&&!away)continue;
  const providerData={source:"XGOALSPRO_PUBLIC_RESULTS",home:home||null,away:away||null,fetched_at:new Date().toISOString()};
  xgoalsCacheWrites.push({owner_id:ownerId,match_id:m.id,source:"XGoalsPro",provider_data:providerData,captured_at:providerData.fetched_at});
 }
 if(xgoalsCacheWrites.length){
  await db("match_market_data?on_conflict=owner_id,match_id,source",token,"POST",xgoalsCacheWrites,"resolution=merge-duplicates,return=minimal").catch((e:any)=>console.error("xGoalsPro form cache write failed:",String(e)));
 }
 const footyForms=new Map<string,any>(),footyCandidates:any[]=[];
 for(const m of matches){
  const cached=readCachedFootyForm(footyCacheMap.get(m.id),String(m.home_team),String(m.away_team));
  if(cached)footyForms.set(m.id,cached);
  else if(["scheduled","unknown"].includes(String(m.status||""))&&m.kickoff_at&&new Date(m.kickoff_at).getTime()>Date.now()&&m.source==="FootyNomad"&&/^\d+$/.test(String(m.external_id||"")))footyCandidates.push(m);
 }
 // FootyNomad is the primary fixture source; fetch only two missing form pages per batch
 // and cache validated W/D/L records. This prevents a burst of hundreds of page requests.
 const footyResults=await Promise.all(footyCandidates.slice(0,2).map(async (item:any)=>{
  const form=await readFootyNomadForm(String(item.external_id),String(item.home_team),String(item.away_team));
  return {id:item.id,form,item};
 }));
 const footyCacheWrites:any[]=[];
 for(const result of footyResults){
  if(!result.form)continue;
  const providerData={...result.form,home_name:String(result.item.home_team),away_name:String(result.item.away_team),fetched_at:new Date().toISOString()};
  footyForms.set(result.id,{home:result.form.home,away:result.form.away,source:"FOOTYNOMAD_LAST5"});
  footyCacheWrites.push({owner_id:ownerId,match_id:result.id,source:"FootyNomad",provider_data:providerData,captured_at:providerData.fetched_at});
 }
 if(footyCacheWrites.length){
  await db("match_market_data?on_conflict=owner_id,match_id,source",token,"POST",footyCacheWrites,"resolution=merge-duplicates,return=minimal").catch((e:any)=>console.error("FootyNomad form cache write failed:",String(e)));
 }
 const fotbalForms=new Map<string,any>(),fotbalCandidates:any[]=[];
 for(const m of matches){
  if(!["scheduled","unknown"].includes(String(m.status||""))||!m.kickoff_at||new Date(m.kickoff_at).getTime()<=Date.now())continue;
  const cached=fotbalCacheMap.get(m.id),age=cached?.fetched_at?Date.now()-Date.parse(cached.fetched_at):Infinity;
  if(cached?.source==="FOTBALINFO_PREMATCH"&&age>=0&&age<6*60*60*1000&&cached.home&&cached.away)fotbalForms.set(m.id,cached);
  else fotbalCandidates.push(m);
 }
 // Fetch a small, bounded number of missing FotbalInfo forms per batch.
 // Keep concurrency low and cache successful responses so later scans do not repeat requests.
 const fotbalResults=await Promise.all(fotbalCandidates.slice(0,2).map(async (item:any)=>{
  const form=await readFotbalInfoForm(item);
  return {status:"fulfilled",value:{id:item.id,form}};
 }));
 const fotbalCacheWrites:any[]=[];
 for(const result of fotbalResults){
  if(result.status!=="fulfilled"||!result.value?.form)continue;
  fotbalForms.set(result.value.id,result.value.form);
  fotbalCacheWrites.push({owner_id:ownerId,match_id:result.value.id,source:"FotbalInfo",provider_data:result.value.form,captured_at:result.value.form.fetched_at||new Date().toISOString()});
 }
 if(fotbalCacheWrites.length){
  await db("match_market_data?on_conflict=owner_id,match_id,source",token,"POST",fotbalCacheWrites,"resolution=merge-duplicates,return=minimal").catch((e:any)=>console.error("FotbalInfo cache write failed:",String(e)));
 }

 const rows:any[]=[];let covered=0,missing=0;
 for(const m of matches){
  try {
  const market:any=marketMap.get(m.id)||tipsAudit.byMatch.get(m.id);let model:any=null,coverage:any={market_odds:false,elo:false,verified_history:false};
  if(market?.market_probabilities){const mp=market.market_probabilities,stamp=Date.parse(String(market.captured_at||market.provider_data?.captured_at||"")),fresh=Number.isFinite(stamp)&&Date.now()-stamp>=0&&Date.now()-stamp<=48*60*60*1000,vals=[Number(mp.home),Number(mp.draw),Number(mp.away)],sum=vals.reduce((a,b)=>a+b,0);if(fresh&&vals.every(x=>Number.isFinite(x)&&x>0)&&sum>0){model={p1:+(vals[0]/sum*100).toFixed(1),px:+(vals[1]/sum*100).toFixed(1),p2:+(vals[2]/sum*100).toFixed(1),coverage:market.market_source==="TIPSAUDIT_FAIR_MARKET"?75:80,market:true,source:market.market_source||"VERIFIED_MARKET_DATA"};coverage={market_odds:true,market_source:market.market_source||"VERIFIED_MARKET_DATA",books:market.books||null,league:market.league||null,market_captured_at:market.captured_at||market.provider_data?.captured_at,fair_odds:market.fair_odds||null,fair_source_url:market.fair_source_url||null,market_reference_best_soft_odds:market.market_reference_best_soft_odds||null,market_reference_bookmaker:market.market_reference_bookmaker||null,market_reference_selection:market.market_reference_selection||null,market_feed_generated_at:market.generated_at||null};}}
  if(!model){
   const modelKickoff=String(m.kickoff_at||`${matchDate(m)}T00:00:00.000Z`);const isWomen=fixtureGender(m)==="women";const githubHome=githubTeamForm(String(m.home_team),modelKickoff,githubPublic,openPlayXg,fixtureGender(m)),githubAway=githubTeamForm(String(m.away_team),modelKickoff,githubPublic,openPlayXg,fixtureGender(m));const internationalHome=internationalForms.forms.get(fixtureTeamKey(String(m.home_team)))||null,internationalAway=internationalForms.forms.get(fixtureTeamKey(String(m.away_team)))||null;
   const githubForm={home:githubHome||internationalHome,away:githubAway||internationalAway,source:githubHome||githubAway?"KEYLESS_GITHUB_LAST10":"INTERNATIONAL_RESULTS_CC0"};const publicMatchForm=publicFormForMatch(m,publicForms);const knownGender=["men","women"].includes(String(m.gender||"").toLowerCase());const homeElo=knownGender&&!isWomen?findEloRating(String(m.home_team),publicForms.eloByTeam||new Map()):null,awayElo=knownGender&&!isWomen?findEloRating(String(m.away_team),publicForms.eloByTeam||new Map()):null;const xgoalsHome=String(m.gender||"").toLowerCase()==="men"?xgoalsTeamForms.get(normTeam(m.home_team)):null,xgoalsAway=String(m.gender||"").toLowerCase()==="men"?xgoalsTeamForms.get(normTeam(m.away_team)):null;const homeSupplement={...(publicMatchForm?.home||{}),...(githubForm.home||{}),...(xgoalsHome||{})},awaySupplement={...(publicMatchForm?.away||{}),...(githubForm.away||{}),...(xgoalsAway||{})};if(homeElo)Object.assign(homeSupplement,{elo:Number(homeElo.elo),rd:Number(homeElo.rd),hfa:Number(homeElo.hfa),elo_as_of:homeElo.as_of});if(awayElo)Object.assign(awaySupplement,{elo:Number(awayElo.elo),rd:Number(awayElo.rd),hfa:Number(awayElo.hfa),elo_as_of:awayElo.as_of});const fotbalInfoForm=fotbalForms.get(m.id);
   if(fotbalInfoForm?.home)Object.assign(homeSupplement,fotbalInfoForm.home);
   if(fotbalInfoForm?.away)Object.assign(awaySupplement,fotbalInfoForm.away);
   const supplemental={home:Object.keys(homeSupplement).length?homeSupplement:null,away:Object.keys(awaySupplement).length?awaySupplement:null,source:fotbalInfoForm?"FOTBALINFO_PREMATCH":xgoalsHome||xgoalsAway?"XGOALSPRO_PUBLIC_RESULTS":githubForm.home||githubForm.away?githubForm.source:publicMatchForm?.source||"OPENMATCHDAY_LAST10"};
   model=historyModel(m.home_team,m.away_team,modelKickoff,history||[],footyForms.get(m.id)||null,supplemental,fixtureGender(m));
   coverage={verified_history:model.source==="VERIFIED_MATCH_HISTORY",partial_verified_history:model.source==="PARTIAL_VERIFIED_HISTORY",baseline_only:model.source==="BASELINE_ONLY",footynomad_last5:model.footyForm,openmatchday_last10:model.source==="OPENMATCHDAY_LAST10",espn_women_last10:model.espnWomenForm,espn_nations_last10:model.source==="ESPN_UEFA_NATIONS_SCHEDULE",keyless_github_last10:githubForm.source==="KEYLESS_GITHUB_LAST10"&&!!(githubForm.home||githubForm.away),xgoals_public_results:!!(xgoalsHome||xgoalsAway),xgoals_home_matches:xgoalsHome?.matches||0,xgoals_away_matches:xgoalsAway?.matches||0,statsbomb_open_data:(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("statsbomb")),statsbomb_xg_used:!!model.xg_used&&(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("statsbomb")),openplay_xg_used:!!model.xg_used&&(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("openplay")),asa_xg_used:!!model.xg_used&&(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("american_soccer_analysis")),historical_xg_used:!!model.xg_used,historical_xg_sources:model.xg_sources||[],calibration_temperature:model.calibration_temperature||1,calibration_method:model.calibration_method||"none",elo_used:model.elo_used,home_elo:model.elo_home,away_elo:model.elo_away,elo_diff:model.elo_diff,elo_weight:model.elo_weight,elo_as_of:model.elo_as_of,elo_ratings_count:publicForms.eloMeta?.ratings_count||0,github_data_generated_at:githubPublic.generated_at||null,github_data_coverage:githubPublic.coverage||null,openplay_xg_generated_at:openPlayXg.openplay_generated_at||null,statsbomb_xg_generated_at:openPlayXg.statsbomb_generated_at||null,asa_xg_generated_at:openPlayXg.asa_generated_at||null,xg_data_coverage:openPlayXg.coverage||null,historical_xg_home_matches:model.xg_home_matches||0,historical_xg_away_matches:model.xg_away_matches||0,openplay_xg_home_matches:model.xg_home_source_counts?.openplay||0,openplay_xg_away_matches:model.xg_away_source_counts?.openplay||0,statsbomb_xg_home_matches:model.xg_home_source_counts?.statsbomb_open_data||0,statsbomb_xg_away_matches:model.xg_away_source_counts?.statsbomb_open_data||0,asa_xg_home_matches:model.xg_home_source_counts?.american_soccer_analysis||0,asa_xg_away_matches:model.xg_away_source_counts?.american_soccer_analysis||0,home_form:model.home_form,away_form:model.away_form,method:model.method};
   model.history=model.source!=="BASELINE_ONLY";
  }
  const hasModel=!!model;
  if(!model){coverage={market_odds:false,elo:false,reason:"BRAK POTWIERDZONYCH DANYCH — nie generujemy sztucznego prawdopodobieństwa."};}
  // Show verified recent form even when the probability model is market-based.
  const fotbalInfoContext=fotbalForms.get(m.id);
  if(fotbalInfoContext?.home&&fotbalInfoContext?.away){
   coverage={...coverage,home_form:fotbalInfoContext.home,away_form:fotbalInfoContext.away,history_source:"FOTBALINFO_PREMATCH",home_history_matches:fotbalInfoContext.home.matches,away_history_matches:fotbalInfoContext.away.matches,fotbalinfo_form:true};
  }
  // Keep recent team form visible even when 1X2 probabilities come from a market feed.
  // Market odds are not a substitute for team history; fetch the same public form sources
  // for the detail panel and record their provenance in data_coverage.
  const displayKickoff=String(m.kickoff_at||`${matchDate(m)}T00:00:00.000Z`);
  const displayPublicForm=publicFormForMatch(m,publicForms);
  const displayGithubHome=githubTeamForm(String(m.home_team),displayKickoff,githubPublic,openPlayXg,fixtureGender(m));
  const displayGithubAway=githubTeamForm(String(m.away_team),displayKickoff,githubPublic,openPlayXg,fixtureGender(m));
  const displayInternationalHome=internationalForms.forms.get(fixtureTeamKey(String(m.home_team)))||null;
  const displayInternationalAway=internationalForms.forms.get(fixtureTeamKey(String(m.away_team)))||null;
  const displayHomeForm=coverage.home_form||displayPublicForm?.home||displayGithubHome||displayInternationalHome||null;
  const displayAwayForm=coverage.away_form||displayPublicForm?.away||displayGithubAway||displayInternationalAway||null;
  if(displayHomeForm||displayAwayForm){
   coverage={...coverage,home_form:displayHomeForm,away_form:displayAwayForm,
    history_source:displayHomeForm?.source||displayAwayForm?.source||displayPublicForm?.source||"PUBLIC_TEAM_HISTORY",
    home_history_matches:Number(displayHomeForm?.matches||displayHomeForm?.last10?.length||0),
    away_history_matches:Number(displayAwayForm?.matches||displayAwayForm?.last10?.length||0),
    recent_form_sources:[...new Set([displayHomeForm?.source,displayAwayForm?.source].filter(Boolean))]};
  }
  coverage={...coverage,
   home_squad:Array.isArray(displayPublicForm?.home_squad)?displayPublicForm.home_squad:[],
   away_squad:Array.isArray(displayPublicForm?.away_squad)?displayPublicForm.away_squad:[],
   home_roster_available:!!displayPublicForm?.home_roster_available,
   away_roster_available:!!displayPublicForm?.away_roster_available,
   home_injuries_available:!!displayPublicForm?.home_injuries_available,
   away_injuries_available:!!displayPublicForm?.away_injuries_available,
   home_injury_count:displayPublicForm?.home_injury_count??null,
   away_injury_count:displayPublicForm?.away_injury_count??null,
   squad_note:displayPublicForm?.squad_note||"Brak potwierdzonej informacji o składzie meczowym."
  };
  const bothTeamsCovered=!!(model.market||(model.history&&model.home_matches>=3&&model.away_matches>=3));const dataCovered=bothTeamsCovered;if(dataCovered)covered++;else missing++;
  const preds:any[]=[];
  if(hasModel){const opts=[["1",model.p1],["X",model.px],["2",model.p2]];const best=opts.sort((x:any,y:any)=>y[1]-x[1])[0];preds.push({market:"1X2",selection:best[0],probability:best[1]});for(const [sel,val] of [["1X",model.p1+model.px],["X2",model.px+model.p2],["12",model.p1+model.p2]])preds.push({market:"DOUBLE_CHANCE",selection:sel,probability:+val.toFixed(1)});}
  else{preds.push({market:"1X2",selection:"—",probability:null},{market:"DOUBLE_CHANCE",selection:"1X",probability:null},{market:"DOUBLE_CHANCE",selection:"X2",probability:null},{market:"DOUBLE_CHANCE",selection:"12",probability:null});}
   const reasonBase=model.market?(model.source==="TIPSAUDIT_FAIR_MARKET"?"Prawdopodobieństwa fair bez marży z aktualnego rynku TipsAudit; kursy fair nie są ofertą bukmachera. Źródło: https://tipsaudit.com":"Rzeczywiste prawdopodobieństwa rynkowe dostawcy."):model.source==="BEYONDELO_ONLY"?"Prognoza oparta na ratingach Elo obu klubów z publicznego źródła BeyondELO; brak wystarczającej historii formy, więc typ jest odrzucony.":model.source==="STATSBOMB_OPEN_DATA"?"Forma z publicznych danych StatsBomb Open Data; zakres rozgrywek jest selektywny i historyczny.":model.source==="AMERICAN_SOCCER_ANALYSIS"?"Forma i historyczne xG z publicznego American Soccer Analysis; dane obejmują wybrane ligi Ameryki Północnej.":model.source==="KEYLESS_GITHUB_LAST10"?"Model Poissona na podstawie ostatnich maksymalnie 10 wyników z publicznych baz GitHub: OpenMatchday i OpenFootball.":model.source==="ESPN_UEFA_NATIONS_SCHEDULE"?"Model na podstawie ostatnich zweryfikowanych wyników reprezentacji z publicznego terminarza ESPN UEFA Nations League.":model.source==="ESPN_WOMEN_LAST10"?"Model Poissona na podstawie ostatnich dostępnych wyników ligi kobiecej z publicznych scoreboardów ESPN.":model.source==="ESPN_FORM_LAST5"?"Model formy W/D/L na podstawie ostatnich pięciu wyników widocznych w publicznym scoreboardzie ESPN; bez dopisywania nieudostępnionych goli ani xG.":model.history?"Szacunek Moneyball na podstawie zweryfikowanej historii i formy z publicznych baz. Nie jest to kurs bukmachera ani gwarancja.":"Neutralny prior techniczny bez danych o formie; zapisany wyłącznie jako ODRZUCONY.";const xgNote=model.market?"":model.xg_used?` Uwzględniono świeże historyczne xG ze źródeł: ${(model.xg_sources||[]).join(", ")}.`:" Nie wykorzystano xG: brak co najmniej 3 świeżych meczów z xG dla obu drużyn.";const calibrationNote=model.calibration_temperature&&model.calibration_temperature!==1?` Prawdopodobieństwa skalowano temperaturą ${model.calibration_temperature.toFixed(2)}.`:"";const reason=reasonBase+xgNote+calibrationNote+(model.elo_used&&model.source!=="BEYONDELO_ONLY"?` Rating Elo: ${model.elo_home}–${model.elo_away} (różnica ${model.elo_diff}), snapshot ${model.elo_as_of}.`:"");
  for(const p of preds){
   const futureEligible=!!m.kickoff_at&&["scheduled","unknown"].includes(m.status)&&new Date(m.kickoff_at).getTime()>Date.now();
   const providerQuote=providerOddsMap.get(m.id+"|"+p.market+"|"+p.selection);
   const tipsOdds=coverage.market_source==="TIPSAUDIT_FAIR_MARKET"&&coverage.market_reference_selection===p.selection&&Number(coverage.market_reference_best_soft_odds)>1?Number(coverage.market_reference_best_soft_odds):null;
   const marketPriceStamp=Date.parse(String(market?.captured_at||market?.generated_at||""));
   const marketPriceFresh=Number.isFinite(marketPriceStamp)&&Date.now()-marketPriceStamp>=0&&Date.now()-marketPriceStamp<=48*60*60*1000;
   const strikerAmerican=marketPriceFresh&&market?.odds?(p.selection==="1"?market.odds.home:p.selection==="X"?market.odds.draw:p.selection==="2"?market.odds.away:null):null;
   const strikerOdds=p.market==="1X2"?americanToDecimal(strikerAmerican):null;
   const referenceOdds=providerQuote?Number(providerQuote.odds):tipsOdds??strikerOdds;
   const oddsSource=providerQuote?String(providerQuote.provider||"MoviOdds")+"/"+String(providerQuote.bookmaker||"bookmaker"):tipsOdds?String(coverage.market_reference_bookmaker||"TipsAudit best soft"):strikerOdds?("StrikerAPI median · "+String(market?.books||"multi")+" books"):null;
   const verdictBase=futureEligible&&bothTeamsCovered&&model.source!=="BASELINE_ONLY"&&p.probability>75&&model.coverage>=55;
   const verdict=verdictBase&&referenceOdds!=null&&referenceOdds>1?"WYBRANY":"ODRZUCONY";
   const rejectionReason=verdict==="WYBRANY"?null:!m.kickoff_at?"Brak potwierdzonej godziny rozpoczęcia meczu.":!["scheduled","unknown"].includes(String(m.status||""))?"Mecz jest w trakcie, zakończony lub ma nieaktywny status.":new Date(m.kickoff_at).getTime()<=Date.now()?"Mecz już się rozpoczął.":!hasModel?"Brak modelu i potwierdzonych danych wejściowych; prawdopodobieństwo pozostawiono puste.":!bothTeamsCovered?"Brak minimalnego pokrycia historii obu drużyn; potrzebne co najmniej 3 mecze każdej drużyny albo wiarygodne dane rynkowe.":model.source==="BASELINE_ONLY"?"Dostępny jest wyłącznie model bazowy bez potwierdzonej formy.":p.probability==null?"Model nie wyliczył prawdopodobieństwa dla tego typu.":p.probability<=75?"Prawdopodobieństwo nie przekracza wymaganego progu (>75%).":Number(model.coverage||0)<55?"Pokrycie danych modelu poniżej 55%.":referenceOdds==null?"Brak aktualnego, potwierdzonego kursu dla tego rynku i typu.":Number(referenceOdds)<=1?"Nieprawidłowy kurs (musi być większy niż 1,00).":"Nie spełniono warunków zatwierdzenia.";
   if(referenceOdds!=null){coverage.odds_source=providerQuote?.provider|| (tipsOdds?"TipsAudit":"StrikerAPI");coverage.odds_bookmaker=providerQuote?.bookmaker|| (tipsOdds?coverage.market_reference_bookmaker:"Mediana z "+String(market?.books||"wielu")+" bukmacherów");coverage.odds_captured_at=providerQuote?.captured_at||coverage.market_captured_at||market?.captured_at||null;}
   const type=p.market==="DOUBLE_CHANCE"?"DC":"1X2";
    const baseSource=model.market?(model.source==="TIPSAUDIT_FAIR_MARKET"?"TIPSAUDIT_FAIR_MARKET":"VERIFIED_MARKET_DATA"):model.source==="BASELINE_ONLY"?"NO_VERIFIED_SOURCE":model.source==="BEYONDELO_ONLY"?"BEYONDELO_ELO_ONLY":model.source==="KEYLESS_GITHUB_LAST10"?"KEYLESS_GITHUB_LAST10_FORM":model.source==="STATSBOMB_OPEN_DATA"?"STATSBOMB_OPEN_DATA_FORM":model.source==="AMERICAN_SOCCER_ANALYSIS"?"AMERICAN_SOCCER_ANALYSIS_FORM":model.source==="ESPN_WOMEN_LAST10"?"ESPN_WOMEN_LAST10_FORM":model.publicForm?"OPENMATCHDAY_LAST10_FORM":model.footyForm?"FOOTYNOMAD_LAST5_FORM":"MONEYBALL_VERIFIED_HISTORY";const xgSources=model.xg_sources||[];const xgSuffix=model.xg_used?"+HISTORICAL_XG"+(xgSources.some((x:string)=>x.toLowerCase().includes("openplay"))?"+OPENPLAY_XG":"")+(xgSources.some((x:string)=>x.toLowerCase().includes("statsbomb"))?"+STATSBOMB_XG":"")+(xgSources.some((x:string)=>x.toLowerCase().includes("american_soccer_analysis"))?"+ASA_XG":""):"";const dataSource=(model.elo_used&&model.source!=="BEYONDELO_ONLY"?baseSource+"+BEYONDELO_ELO":baseSource)+xgSuffix;
    rows.push({owner_id:ownerId,decision_status:verdict==="WYBRANY"?"FINAL":"REJECTED",source_class:"MODEL",match_id:m.id,scan_run_id:m.scan_run_id||null,model_version:V,market:p.market,selection:p.selection,pick:p.selection,prediction_type:type,selection_status:verdict,rejection_reason:rejectionReason,probability:p.probability,odds:referenceOdds,confidence:null /* coverage is data completeness, not calibrated confidence */,verdict,rationale:reason,group_name:p.market==="1X2"?"MAIN":"MEGA",data_source:oddsSource||dataSource,data_coverage:{...coverage,model_source:dataSource,model_source_type:model.source,model_coverage:Number(model.coverage||0)},note:JSON.stringify({source:dataSource,odds_source:oddsSource,coverage}),settlement_status:"pending",result_status:"pending",verified:false});
  }
  // Goals are modelled independently from 1X2 market odds. Market-only records do not contain expected goals.
  const goalKickoff=String(m.kickoff_at||`${matchDate(m)}T00:00:00.000Z`);
  const goalPublicForm=publicFormForMatch(m,publicForms);
  const goalGithubHome=githubTeamForm(String(m.home_team),goalKickoff,githubPublic,openPlayXg,fixtureGender(m));
  const goalGithubAway=githubTeamForm(String(m.away_team),goalKickoff,githubPublic,openPlayXg,fixtureGender(m));
  const goalInternationalHome=internationalForms.forms.get(fixtureTeamKey(String(m.home_team)))||null;
  const goalInternationalAway=internationalForms.forms.get(fixtureTeamKey(String(m.away_team)))||null;
  const goalXgoalsHome=String(m.gender||"").toLowerCase()==="men"?xgoalsTeamForms.get(normTeam(m.home_team)):null,goalXgoalsAway=String(m.gender||"").toLowerCase()==="men"?xgoalsTeamForms.get(normTeam(m.away_team)):null;
  const goalFotbalInfoForm=fotbalForms.get(m.id);
  const goalHomeSupplement={...(goalPublicForm?.home||{}),...(goalGithubHome||goalInternationalHome||{}),...(goalXgoalsHome||{}),...(goalFotbalInfoForm?.home||{})};
  const goalAwaySupplement={...(goalPublicForm?.away||{}),...(goalGithubAway||goalInternationalAway||{}),...(goalXgoalsAway||{}),...(goalFotbalInfoForm?.away||{})};
  const goalSupplement={home:Object.keys(goalHomeSupplement).length?goalHomeSupplement:null,away:Object.keys(goalAwaySupplement).length?goalAwaySupplement:null,source:goalXgoalsHome||goalXgoalsAway?"XGOALSPRO_PUBLIC_RESULTS":goalGithubHome||goalGithubAway?"KEYLESS_GITHUB_LAST10":goalPublicForm?.source||"OPENMATCHDAY_LAST10"};
  const goalsModel=model?.expected_home_goals!=null&&model?.expected_away_goals!=null?model:historyModel(m.home_team,m.away_team,goalKickoff,history||[],footyForms.get(m.id)||null,goalSupplement,fixtureGender(m));
  if(goalsModel&&goalsModel.expected_home_goals!=null&&goalsModel.expected_away_goals!=null&&((goalsModel.home_matches>=3&&goalsModel.away_matches>=3)||goalsModel.source==="BASELINE_ONLY")){
   const lh=Number(goalsModel.expected_home_goals),la=Number(goalsModel.expected_away_goals),hp=Array.from({length:10},(_,i)=>poisson(lh,i)),ap=Array.from({length:10},(_,i)=>poisson(la,i));
   const total=Array.from({length:19},(_,t)=>{let v=0;for(let h=0;h<=9;h++){const a=t-h;if(a>=0&&a<=9)v+=hp[h]*ap[a];}return v;});
   const over=(line:number)=>total.reduce((v,p,i)=>v+(i>line?p:0),0),btts=1-hp[0]-ap[0]+hp[0]*ap[0];
   const goalMarkets=[["OVER_1.5",over(1.5)],["UNDER_1.5",1-over(1.5)],["OVER_2.5",over(2.5)],["UNDER_2.5",1-over(2.5)],["OVER_3.5",over(3.5)],["UNDER_3.5",1-over(3.5)],["BTTS_YES",btts],["BTTS_NO",1-btts]];
   for(const [selection,prob] of goalMarkets){
    const probability=+(Number(prob)*100).toFixed(1),futureEligible=!!m.kickoff_at&&["scheduled","unknown"].includes(m.status)&&new Date(m.kickoff_at).getTime()>Date.now();
    const goalCoverage={...coverage,model_coverage:Number(goalsModel.coverage||0),model_source_type:goalsModel.source,expected_home_goals:lh,expected_away_goals:la,expected_total_goals:+(lh+la).toFixed(2),goals_model:"INDEPENDENT_POISSON",history_source:goalsModel.source,xgoals_public_results:goalsModel.source==="XGOALSPRO_PUBLIC_RESULTS",xg_used:!!goalsModel.xg_used,xg_sources:goalsModel.xg_sources||[],home_history_matches:goalsModel.home_matches,away_history_matches:goalsModel.away_matches};
    const providerQuote=providerOddsMap.get(m.id+"|GOALS|"+selection);
    const referenceOdds=providerQuote&&Number(providerQuote.odds)>1?Number(providerQuote.odds):null;
    const oddsSource=providerQuote?String(providerQuote.provider||"MoviOdds")+"/"+String(providerQuote.bookmaker||"bookmaker"):null;
    const verdict=futureEligible&&(goalsModel.home_matches>=3&&goalsModel.away_matches>=3)&&goalsModel.source!=="BASELINE_ONLY"&&probability>75&&goalsModel.coverage>=55&&referenceOdds!=null?"WYBRANY":"ODRZUCONY";
     const rejectionReason=verdict==="WYBRANY"?null:!m.kickoff_at?"Brak potwierdzonej godziny rozpoczęcia meczu.":!["scheduled","unknown"].includes(String(m.status||""))?"Mecz jest w trakcie, zakończony lub ma nieaktywny status.":new Date(m.kickoff_at).getTime()<=Date.now()?"Mecz już się rozpoczął.":goalsModel.home_matches<3||goalsModel.away_matches<3?"Za mało historii: wymagane minimum 3 mecze dla każdej drużyny.":goalsModel.source==="BASELINE_ONLY"?"Dostępny jest wyłącznie model bazowy bez potwierdzonej formy.":probability<=75?"Prawdopodobieństwo nie przekracza wymaganego progu (>75%).":Number(goalsModel.coverage||0)<55?"Pokrycie danych modelu poniżej 55%.":referenceOdds==null?"Brak aktualnego, potwierdzonego kursu dla tego rynku i typu.":Number(referenceOdds)<=1?"Nieprawidłowy kurs (musi być większy niż 1,00).":"Nie spełniono warunków zatwierdzenia.";
    rows.push({owner_id:ownerId,decision_status:verdict==="WYBRANY"?"FINAL":"REJECTED",source_class:"MODEL",match_id:m.id,scan_run_id:m.scan_run_id||null,model_version:V,market:"GOALS",selection,prediction_type:null,pick:selection,probability,odds:referenceOdds,confidence:String(goalsModel.coverage),verdict,selection_status:verdict,rejection_reason:rejectionReason,rationale:goalsModel.source==="BASELINE_ONLY"?"Orientacyjny rozkład Poissona z neutralnego modelu bazowego (1,35–1,10 gola); brak historii drużyn, typ automatycznie ODRZUCONY.":"Niezależny model Poissona na podstawie ostatnich maksymalnie 10 wyników z oznaczonym źródłem publicznym lub zweryfikowanej historii bazy; xG uwzględniane, gdy dostępne.",data_source:oddsSource||"GOALS_POISSON+VERIFIED_GOALS",data_coverage:{...goalCoverage,odds_source:providerQuote?.provider||null,odds_bookmaker:providerQuote?.bookmaker||null,odds_captured_at:providerQuote?.captured_at||null},note:JSON.stringify({source:"GOALS_POISSON",odds_source:oddsSource,coverage:goalCoverage}),settlement_status:"pending",result_status:"pending",verified:false});
   }
  } else {
   const reason=!goalsModel?"Nie udało się zbudować niezależnego modelu goli.":goalsModel.home_matches<3||goalsModel.away_matches<3?"Za mało zweryfikowanych ostatnich meczów: wymagane minimum 3 dla każdej drużyny.":goalsModel.source==="BASELINE_ONLY"?"Dostępny wyłącznie model bazowy — brak podstaw do prognozy goli.":goalsModel.expected_home_goals==null||goalsModel.expected_away_goals==null?"Brak wiarygodnych oczekiwanych goli w modelu Poissona.":"Model goli nie spełnia warunków publikacji.";
   const missingCoverage={...coverage,expected_home_goals:null,expected_away_goals:null,expected_total_goals:null,goals_model:"UNAVAILABLE",xg_used:false,home_history_matches:goalsModel?.home_matches||0,away_history_matches:goalsModel?.away_matches||0};
   for(const selection of ["OVER_1.5","UNDER_1.5","OVER_2.5","UNDER_2.5","OVER_3.5","UNDER_3.5","BTTS_YES","BTTS_NO"]){
    rows.push({owner_id:ownerId,decision_status:"REJECTED",source_class:"MODEL",match_id:m.id,scan_run_id:m.scan_run_id||null,model_version:V,market:"GOALS",selection,prediction_type:null,pick:selection,probability:null,odds:null,confidence:null,verdict:"ODRZUCONY",selection_status:"ODRZUCONY",rejection_reason:reason,rationale:"Prognoza nie została wyliczona — brak wymaganych danych wejściowych. Nie generujemy sztucznych prawdopodobieństw.",data_source:"GOALS_DATA_INSUFFICIENT",data_coverage:missingCoverage,note:JSON.stringify({source:"GOALS_DATA_INSUFFICIENT",coverage:missingCoverage}),settlement_status:"pending",result_status:"pending",verified:false});
   }
  }
  } catch(matchError) {
   // Isolate a bad fixture: do not let one provider/data exception abort the rest of the page.
   const failure=String(matchError||"Nieznany błąd analizy").slice(0,300);
   const coverage={baseline_only:true,match_analysis_error:failure,reason:"Nie udało się pobrać pełnych danych tego meczu. Zapisano jawny typ awaryjny ODRZUCONY; bez udawania potwierdzonej analizy."};
   const base={owner_id:ownerId,decision_status:"REJECTED",source_class:"MODEL",match_id:m.id,scan_run_id:m.scan_run_id||null,model_version:V,odds:null,confidence:null,verdict:"ODRZUCONY",selection_status:"ODRZUCONY",rejection_reason:"Analiza szczegółowa przerwana dla tego meczu: "+failure,rationale:"Typ awaryjny. Brak wystarczających danych do wiarygodnej prognozy; nie traktować jako zakładu.",data_source:"MATCH_LEVEL_FALLBACK",data_coverage:coverage,note:JSON.stringify({source:"MATCH_LEVEL_FALLBACK",coverage}),settlement_status:"pending",result_status:"pending",verified:false};
   rows.push({...base,market:"1X2",selection:"1",pick:"1",prediction_type:"1X2",probability:null,group_name:"MAIN"});
   for(const selection of ["1X","X2","12"])rows.push({...base,market:"DOUBLE_CHANCE",selection,pick:selection,prediction_type:"DC",probability:null,group_name:"MEGA"});
   for(const selection of ["OVER_1.5","UNDER_1.5","OVER_2.5","UNDER_2.5","OVER_3.5","UNDER_3.5","BTTS_YES","BTTS_NO"])rows.push({...base,market:"GOALS",selection,pick:selection,prediction_type:null,probability:null,group_name:"GOALS"});
  }
 }
 // Normalize every market row to identical keys for PostgREST bulk upserts.
 // GOALS is a separate market and must not break the 1X2/DC batch.
 for(const r of rows){
  if(!Object.prototype.hasOwnProperty.call(r,"prediction_type"))r.prediction_type=r.market==="DOUBLE_CHANCE"?"DC":r.market==="GOALS"?null:"1X2";
  if(!Object.prototype.hasOwnProperty.call(r,"pick"))r.pick=r.selection??null;
  if(!Object.prototype.hasOwnProperty.call(r,"selection_status"))r.selection_status=r.verdict??"ODRZUCONY";
  if(!Object.prototype.hasOwnProperty.call(r,"rejection_reason"))r.rejection_reason=null;
  if(!Object.prototype.hasOwnProperty.call(r,"result_status"))r.result_status="pending";
  if(!Object.prototype.hasOwnProperty.call(r,"group_name"))r.group_name=r.market==="GOALS"?"GOALS":r.market==="DOUBLE_CHANCE"?"MEGA":"MAIN";
  // Fixed analytical stake for every newly selected single prediction.
  // Existing verified history is preserved below; pending model rows are refreshed to €4.
  if(r.verdict==="WYBRANY"){
   r.stake=4.00;
   r.potential_return=r.odds!=null&&Number(r.odds)>1?Math.round(4*Number(r.odds)*100)/100:null;
  }
 }
 const matchIds=matches.map((m:any)=>String(m.id)).filter(Boolean);
 const old=matchIds.length?await db("predictions?select=id,owner_id,match_id,market,selection,settlement_status,verified,note&owner_id=eq."+encodeURIComponent(ownerId)+"&model_version=eq."+encodeURIComponent(V)+"&match_id=in.("+matchIds.join(",")+")",token):[];
 // A 1X2 market has exactly one official selection per match. When a later
 // analysis changes that selection (including to a no-data placeholder),
 // void the older pending row so it cannot inflate history or hit rates.
 const desired1x2=new Map(rows.filter((x:any)=>x.market==="1X2").map((x:any)=>[x.match_id,x.selection]));
 const stale1x2=(old||[]).filter((x:any)=>x.market==="1X2"&&desired1x2.has(x.match_id)&&x.selection!==desired1x2.get(x.match_id)&&x.settlement_status==="pending");
 const staleIds=new Set(stale1x2.map((x:any)=>x.id));
 if(staleIds.size){
  const ids=[...staleIds];
  for(let i=0;i<ids.length;i+=100){
   await db("predictions?id=in.("+ids.slice(i,i+100).join(",")+")&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{settlement_status:"void",verified:false,note:"Zastąpiono nowszym wyborem 1X2 modelu; poprzedni wpis wyłączony z rozliczeń."});
  }
 }
 const activeOld=(old||[]).filter((x:any)=>!staleIds.has(x.id)&&!(x.market==="1X2"&&String(x.note||"").includes("Zastąpiono nowszym wyborem 1X2 modelu")));
 const map=new Map(activeOld.map((x:any)=>[x.match_id+"|"+x.market+"|"+x.selection,x.id])),settledMarkets=new Set(activeOld.filter((x:any)=>x.verified===true&&["won","lost"].includes(x.settlement_status)).map((x:any)=>x.match_id+"|"+x.market));let created=0,updated=0,preserved=0;
 for(const x of activeOld){if(!x.selection||x.selection==="—"){await db("predictions?id=eq."+x.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{settlement_status:"void",verified:false,note:"Stary pusty wpis zastąpiono typem modelowym; nie liczy się do skuteczności."});}}
 const updateRows:any[]=[],insertRows:any[]=[];
 for(const r of rows){
  const key=r.match_id+"|"+r.market+"|"+r.selection,id=map.get(key);
  if(id){
   const existing=old.find((x:any)=>x.id===id);
   if(existing?.settlement_status==="pending"){updateRows.push({...r,id});updated++;}else preserved++;
  }else if(settledMarkets.has(r.match_id+"|"+r.market)){preserved++;}
  else{insertRows.push(r);created++;}
 }
 // PostgREST bulk insert requires identical JSON keys in every row. Keep rows with id separate from new rows.
 for(let i=0;i<updateRows.length;i+=50){
  await db("predictions?on_conflict=owner_id,match_id,model_version,market,selection",token,"POST",updateRows.slice(i,i+50),"resolution=merge-duplicates,return=minimal");
 }
 for(let i=0;i<insertRows.length;i+=50){
  await db("predictions?on_conflict=owner_id,match_id,model_version,market,selection",token,"POST",insertRows.slice(i,i+50),"resolution=merge-duplicates,return=minimal");
 }
 const couponCreated=false,couponLegs=0;
 const scanState=await finishScheduledScan(matches.length);
 return out({ok:true,date,model:V,provider:"Verified database history + cached FootyNomad/FotbalInfo + compact OpenMatchday public sources + fresh market probabilities",tipsaudit:{ok:tipsAudit.ok,matched:tipsAudit.matched,generated_at:tipsAudit.generated_at,error:tipsAudit.error||null},matches:matches.length,offset:scheduledMode?null:analysisOffset,batch_size:batchSize,has_more:moreAvailable,scheduled:scheduledMode,scheduled_import:scheduledImport,scan_state:scanState,fixtures_before_deduplication:rawDateMatches.length,duplicates_removed:duplicatesRemoved,predictions:rows.length,created,updated,preserved,covered,missing,footy_form_candidates:footyForms.size,fotbal_form_candidates:fotbalCandidates.length,footy_form_matches:footyForms.size,openmatchday_fixtures:publicForms.fixtures,openmatchday_error:publicForms.error||null,github_public_teams:Object.keys(githubPublic.teams||{}).length,github_public_competitions:githubPublic.coverage?.competitions_with_results||0,github_openfootball_matches:githubPublic.coverage?.openfootball_league_matches_read||0,github_openfootball_files:githubPublic.coverage?.openfootball_league_files_loaded||0,github_public_generated_at:githubPublic.generated_at||null,github_public_error:githubPublic.error||null,github_form_matches:new Set(rows.filter((x:any)=>String(x.note).includes("KEYLESS_GITHUB_LAST10_FORM")).map((x:any)=>x.match_id)).size,selected:rows.filter(x=>x.verdict==="WYBRANY").length,couponCreated,couponLegs,limitations:["W trakcie skanowania używane są zweryfikowana historia bazy, zapisane cache FootyNomad/FotbalInfo i kompaktowe źródła OpenMatchday. Duże archiwa historyczne CSV/JSON nie są parsowane ponownie w każdej partii, aby uniknąć limitu CPU Edge Function.","Nie wszystkie ligi mają świeże xG, potwierdzone składy i kontuzje. Brakujące dane pozostają jawnie oznaczone; model bazowy jest ODRZUCONY i nie trafia do kuponów. Kursy rynkowe są używane wyłącznie, gdy zapis ma maksymalnie 48 godzin.","Dane publiczne odświeżane przez GitHub Actions zgodnie z harmonogramem poszczególnych źródeł.","Kupony tworzy użytkownik przyciskiem generatora; skan nie zapisuje automatycznie kuponów."]});
}catch(e){console.error("moneyball-predict failed:",String(e),e instanceof Error?e.stack:"");return out({ok:false,error:String(e)},500)}});