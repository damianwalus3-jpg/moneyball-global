import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { selectEspnLeagues } from "./espn-leagues.ts";
const SUPABASE_URL="https://gzgeklcukrclgwbsmbsp.supabase.co";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-token","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};


const EUROPE_ISO3 = new Set(["ALB","AND","ARM","AUT","AZE","BLR","BEL","BIH","BUL","CRO","CYP","CZE","DNK","ENG","EST","FRO","FIN","FRA","GEO","DEU","GER","GIB","GRC","GRE","HUN","ISL","IRL","ITA","KAZ","KOS","LVA","LIE","LTU","LUX","MLT","MDA","MNE","NLD","MKD","NIR","NOR","POL","PRT","POR","ROU","RUS","SMR","SCO","SRB","SVK","SVN","ESP","SWE","CHE","SUI","TUR","UKR","WAL","GBR","UK"]);
const EUROPE_COUNTRIES = new Set(["albania","andorra","armenia","austria","azerbaijan","belarus","belgium","bosnia and herzegovina","bulgaria","croatia","cyprus","czechia","czech republic","denmark","england","estonia","faroe islands","finland","france","georgia","germany","gibraltar","greece","hungary","iceland","ireland","isle of man","italy","kazakhstan","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","northern ireland","norway","poland","portugal","romania","russia","san marino","scotland","serbia","slovakia","slovenia","spain","sweden","switzerland","turkey","türkiye","ukraine","wales","united kingdom","uk","europe","uefa"]);
function isEuropeanFixture(country: unknown, competition: unknown, home?: unknown, away?: unknown): boolean {
 const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const c=norm(country), comp=norm(competition), teams=norm(String(home??"")+" "+String(away??""));
 const countryParts=c.split(/[\\/,;|]+/).map((x:string)=>x.trim()).filter(Boolean);
 if(EUROPE_COUNTRIES.has(c)||countryParts.some((x:string)=>EUROPE_COUNTRIES.has(x)||EUROPE_ISO3.has(x.toUpperCase()))||EUROPE_ISO3.has(String(country??"").trim().toUpperCase()))return true;
 if(/\buefa\b|european (championship|qualif|league)|uefa nations|uefa champions|uefa europa|uefa conference/.test(comp))return true;
 if(/\bu20 elite league\b/.test(comp) && /\b(england|italy|portugal|czech republic|germany|france|spain|netherlands|belgium|sweden|norway|denmark|finland|iceland|poland|croatia|serbia|austria|switzerland|scotland|wales|ireland)\b/.test(teams))return true;
 return false;
}

function clean(s:string){return s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g," ").trim();}
function day(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
async function db(path:string,method="GET",body?:unknown){
 if(!SERVICE_KEY)throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{method,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",Prefer:"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text();let data:any;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
 if(!r.ok)throw new Error("Supabase "+r.status+" at "+path+": "+(data?.message||data?.details||data?.hint||raw||"empty response"));return data;
}
async function dbUpsert(path:string,body:unknown,onConflict:string){
 if(!SERVICE_KEY)throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path+"?on_conflict="+onConflict,{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(body)});
 const raw=await r.text();let data:any;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
 if(!r.ok)throw new Error("Supabase upsert "+r.status+" at "+path+": "+(data?.message||data?.details||data?.hint||raw||"empty response"));
 return data;
}

async function readDay(date:string){
 const r=await fetch("https://footynomad.com/fixtures/"+date,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MoneyballGlobal/2.0)","Accept":"text/html"},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error("FootyNomad "+date+" HTTP "+r.status);
 const html=await r.text(),re=/<a\b([^>]*\bhref=["'](?:https?:\/\/footynomad\.com)?\/fixture\/[^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi;
 const out:any[]=[];let m:RegExpExecArray|null;
 while((m=re.exec(html))!==null){
  const attrs=m[1],body=m[2],href=(attrs.match(/href=["']([^"']+)/i)||[])[1]||"",id=(href.match(/\/fixture\/(\d+)/i)||[])[1];if(!id)continue;
  const home=clean((body.match(/<span[^>]*class=["'][^"']*ticket-home[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)||[])[1]||"");
  const away=clean((body.match(/<span[^>]*class=["'][^"']*ticket-away[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)||[])[1]||"");
  const leagueStart=html.lastIndexOf('<details class="league-group',m.index),leagueEnd=leagueStart>=0?html.indexOf("</summary>",leagueStart):-1;
  const league=leagueStart>=0&&leagueEnd>leagueStart?clean((html.slice(leagueStart,leagueEnd).match(/href=["']\/league\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)||[])[1]||""):"";
  const gender=/\bW\b|Women|female|girls/i.test(home+" "+away+" "+league)?"women":"men";
  const kickoff=(body.match(/<time[^>]*datetime=["']([^"']+)/i)||[])[1]||null;
  const cls=(attrs.match(/class=["']([^"']+)/i)||[])[1]||"";
  const hs=(body.match(/class=["'][^"']*ticket-hs[^"']*["'][^>]*>(\d+)</i)||[])[1];
  const as=(body.match(/class=["'][^"']*ticket-as[^"']*["'][^>]*>(\d+)</i)||[])[1];
  const status=cls.includes("ticket-ft")?"finished":cls.includes("ticket-live")?"live":cls.includes("ticket-pst")?"postponed":cls.includes("ticket-canc")?"cancelled":"scheduled";
  if(home&&away)out.push({external_id:id,home_team:home,away_team:away,gender,kickoff_at:kickoff?new Date(kickoff).toISOString():null,status,home_score:hs==null?null:Number(hs),away_score:as==null?null:Number(as)});
 }
 return out;
}

type ScoreFeed={source:string;external_id:string;home:string;away:string;home_score:number|null;away_score:number|null;status:string;date:string;url:string;raw:any};
const ESPN_LEAGUES=["eng.1","esp.1","ita.1","ger.1","fra.1","bel.1","ned.1","por.1","sco.1","uefa.nations","uefa.champions","uefa.europa","uefa.europa.conf","eng.w.1","eng.w.fa","eng.w.league_cup","eng.w.promotion.relegation","esp.w.1","fra.w.1","ned.w.1","ned.w.knvb_cup","uefa.w.nations","uefa.w.europa"];
const ESPN_COUNTRY_PREFIX:Record<string,string>={england:"eng",eng:"eng",spain:"esp",italy:"ita",germany:"ger",france:"fra",belgium:"bel",netherlands:"ned",portugal:"por",scotland:"sco",usa:"usa","united states":"usa",brazil:"bra",argentina:"arg",mexico:"mex","saudi arabia":"ksa",turkey:"tur",japan:"jpn",australia:"aus",china:"chn",sweden:"swe",denmark:"den",norway:"nor",austria:"aut",greece:"gre",russia:"rus",chile:"chi",colombia:"col",peru:"per",paraguay:"par",ecuador:"ecu",venezuela:"ven",bolivia:"bol",uruguay:"uru","south africa":"rsa",india:"ind","el salvador":"slv",guatemala:"gua","costa rica":"crc",honduras:"hon"};
function teamKey(s:string){const key=clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/\b(fc|cf|sc|afc|club|football|de|the)\b/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");const aliases:Record<string,string>={"rep of ireland":"ireland","republic of ireland":"ireland","bosnia herzegovina":"bosnia","bosnia and herzegovina":"bosnia","turkiye":"turkey","fyr macedonia":"north macedonia","macedonia":"north macedonia"};return aliases[key]||key;}
function editDistance(a:string,b:string){const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}}return prev[b.length];}
function similarTeam(a:string,b:string){const x=teamKey(a),y=teamKey(b);if(!x||!y)return false;if(x===y||x.includes(y)||y.includes(x))return true;const A=new Set(x.split(" ")),B=new Set(y.split(" "));const overlap=[...A].filter(t=>B.has(t)&&t.length>2).length;if(overlap>=2&&overlap/Math.max(1,Math.min(A.size,B.size))>=0.7)return true;const max=Math.max(x.length,y.length);return Math.min(x.length,y.length)>=8&&max>0&&editDistance(x,y)/max<=0.16;}
async function limitedSettled<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<PromiseSettledResult<R>[]>{const out:any[]=new Array(items.length);let cursor=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=cursor++;if(i>=items.length)return;try{out[i]={status:"fulfilled",value:await fn(items[i])};}catch(reason){out[i]={status:"rejected",reason};}}});await Promise.all(workers);return out;}
async function readAlternateResults(startDate:string,endDate:string):Promise<ScoreFeed[]>{
 const alternateStarted=Date.now();
 const out:ScoreFeed[]=[];
 const matchFields="select=id,external_id,home_team,away_team,owner_id,country,league,gender,kickoff_at,kickoff_date,status";
 const discoveryStarted=Date.now();
 const timedMatches=await db("matches?"+matchFields+"&kickoff_at=gte."+encodeURIComponent(startDate+"T00:00:00Z")+"&kickoff_at=lt."+encodeURIComponent(endDate+"T23:59:59Z")).catch(()=>[]);
 const dateOnlyMatches=await db("matches?"+matchFields+"&kickoff_at=is.null&kickoff_date=gte."+encodeURIComponent(startDate)+"&kickoff_date=lte."+encodeURIComponent(endDate)).catch(()=>[]);
 console.log("[moneyball-results-sync] discovery",JSON.stringify({timedMatches:timedMatches.length,dateOnlyMatches:dateOnlyMatches.length,durationMs:Date.now()-discoveryStarted}));
 const unresolved=[...(timedMatches||[]),...(dateOnlyMatches||[])],todayKey=day(new Date());
 const due=unresolved.filter((m:any)=>isEuropeanFixture(m.country,m.league,m.home_team,m.away_team)&&((m.kickoff_at&&new Date(m.kickoff_at).getTime()<Date.now())||(!m.kickoff_at&&m.kickoff_date&&String(m.kickoff_date)<=todayKey))&& !["finished","postponed","cancelled"].includes(String(m.status||"").toLowerCase()));
 if(!due.length){
  console.log("[moneyball-results-sync] alternate sources skipped",JSON.stringify({reason:"no_due_unresolved_matches",durationMs:Date.now()-alternateStarted}));
  return [];
 }
 const leagues=selectEspnLeagues(due);
 const dateRange=startDate.replace(/-/g,"")+(startDate===endDate?"":"-"+endDate.replace(/-/g,""));
 const espnStarted=Date.now();
 const espn=await limitedSettled(leagues,12,async league=>{
  const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+league+"/scoreboard?dates="+dateRange;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 MoneyballGlobal/2.0","Accept":"application/json"},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("ESPN "+league+" HTTP "+r.status);
  const j=await r.json();return {league,url,events:j.events||[]};
 });
 const espnFailures=espn.filter((x:any)=>x.status==="rejected").map((x:any)=>String(x.reason));
 let espnEvents=0;
 for(const x of espn){if(x.status!=="fulfilled")continue;espnEvents+=(x.value.events||[]).length;for(const e of x.value.events||[]){
  const comps=e.competitions?.[0]?.competitors||[];
  const h=comps.find((c:any)=>c.homeAway==="home"),a=comps.find((c:any)=>c.homeAway==="away");
  const state=String(e.status?.type?.name||e.status?.type?.state||"").toLowerCase();
  const postponed=/postponed|canceled|cancelled|suspended/.test(state);
  const finished=!!e.status?.type?.completed||/final/.test(state);
  if(!h||!a)continue;
  out.push({source:"ESPN",external_id:String(e.id),home:h.team?.displayName||h.team?.name||"",away:a.team?.displayName||a.team?.name||"",home_score:finished?Number(h.score):null,away_score:finished?Number(a.score):null,status:postponed?"postponed":finished?"finished":state.includes("in")?"live":"scheduled",date:e.date||startDate,url:x.value.url,raw:e});
 }}
 console.log("[moneyball-results-sync] ESPN selection",JSON.stringify({dueFixtures:due.length,leagues,successfulLeagues:espn.filter((x:any)=>x.status==="fulfilled").length,events:espnEvents,failures:espnFailures,durationMs:Date.now()-espnStarted}));
 // TheSportsDB public v1 feed: no signup or paid key; one request per date, with the free tier returning a small sample.
 const eventDates=[...new Set(due.map((m:any)=>m.kickoff_at?day(new Date(m.kickoff_at)):String(m.kickoff_date||"").slice(0,10)).filter((date:string)=>date>=startDate&&date<=endDate))].sort();
 const sportsDbStarted=Date.now();
 const sportsDb=await limitedSettled(eventDates,4,async date=>{
  const url="https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d="+date+"&s=Soccer";
  const r=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"MoneyballGlobal/2.0"},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("TheSportsDB "+date+" HTTP "+r.status);
  const j=await r.json();
  return (j.events||[]).flatMap((e:any)=>{
   const state=String(e.strStatus||"").toLowerCase(),postponed=String(e.strPostponed||"").toLowerCase()==="yes"||/postponed|cancelled|canceled/.test(state);
   const finished=/^(ft|aet|pen|finished|match finished)$/.test(state)||/full time/.test(state);
   const hs=e.intHomeScore==null||e.intHomeScore===""?null:Number(e.intHomeScore),as=e.intAwayScore==null||e.intAwayScore===""?null:Number(e.intAwayScore);
   return e.strHomeTeam&&e.strAwayTeam?[{source:"TheSportsDB",external_id:String(e.idEvent),home:String(e.strHomeTeam),away:String(e.strAwayTeam),home_score:finished&&Number.isInteger(hs)?hs:null,away_score:finished&&Number.isInteger(as)?as:null,status:postponed?"postponed":finished?"finished":state.includes("live")?"live":"scheduled",date:String(e.dateEvent||date),url,raw:e} as ScoreFeed]:[];
  });
 });
 for(const x of sportsDb){if(x.status==="fulfilled")out.push(...x.value);}
 console.log("[moneyball-results-sync] TheSportsDB",JSON.stringify({dates:eventDates,successful:sportsDb.filter((x:any)=>x.status==="fulfilled").length,events:sportsDb.reduce((n:number,x:any)=>n+(x.status==="fulfilled"?x.value.length:0),0),durationMs:Date.now()-sportsDbStarted}));
 // OpenMatchday publishes public results CSVs for dozens of competitions; query only leagues containing overdue fixtures.
 const openMatchdayStarted=Date.now();
 try{
  const ir=await fetch("https://raw.githubusercontent.com/oladeeayo/open-matchday/master/LEAGUE_INDEX.md",{headers:{"User-Agent":"MoneyballGlobal/2.0","Accept":"text/plain"},signal:AbortSignal.timeout(8000)});
  if(ir.ok){
   const indexText=await ir.text();
   const registry=[...indexText.matchAll(/^\|\s*(.+?)\s*\|\s*([^|]+)\|\s*([^|]+)\|/gm)].map((m:any)=>({folder:m[1].trim().replace(/^\x60|\x60$/g,"").replace(/\\_/g,"_"),league:clean(m[2]),country:clean(m[3])}));
   const countryNames:Record<string,string>={eng:"england",england:"england",esp:"spain",spain:"spain",ger:"germany",germany:"germany",ita:"italy",italy:"italy",fra:"france",france:"france",bel:"belgium",belgium:"belgium",ned:"netherlands",netherlands:"netherlands",por:"portugal",portugal:"portugal",sco:"scotland",scotland:"scotland",bra:"brazil",brazil:"brazil",arg:"argentina",argentina:"argentina",usa:"united states","united states":"united states",tur:"turkey",turkey:"turkey",gre:"greece",greece:"greece",aut:"austria",austria:"austria",sui:"switzerland",switzerland:"switzerland",pol:"poland",poland:"poland",ukr:"ukraine",ukraine:"ukraine"};
   const folderSet=new Set<string>();
   for(const m of due){
    const lk=teamKey(m.league||""),rawCountry=teamKey(m.country||""),ck=countryNames[rawCountry]||rawCountry;
    for(const item of registry){
     const folderKey=teamKey(item.folder),titleKey=teamKey(item.league),itemCountry=teamKey(item.country);
     if(folderKey===lk||(titleKey===lk&&(!ck||itemCountry===ck)))folderSet.add(item.folder);
    }
   }
   const folders=[...folderSet];
   const csvRows=(text:string)=>{
    const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(cell);cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(v=>v.trim()))rows.push(row);row=[];}else cell+=c;}
    if(cell.length||row.length){row.push(cell);rows.push(row);}return rows;
   };
   const feeds=await limitedSettled(folders,8,async folder=>{
    let url="https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/"+folder+"/results_2627.csv";
    let r=await fetch(url,{headers:{"User-Agent":"MoneyballGlobal/2.0","Accept":"text/csv"},signal:AbortSignal.timeout(8000)});
    if(!r.ok){
     url="https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data/"+folder+"/results_2026.csv";
     r=await fetch(url,{headers:{"User-Agent":"MoneyballGlobal/2.0","Accept":"text/csv"},signal:AbortSignal.timeout(8000)});
    }
    if(!r.ok)throw new Error("OpenMatchday "+folder+" HTTP "+r.status);
    const rows=csvRows(await r.text());if(!rows.length)return [] as ScoreFeed[];
    const h=rows[0].map(x=>x.trim().toLowerCase()),at=(row:string[],key:string)=>row[h.indexOf(key)]||"";
    return rows.slice(1).flatMap(row=>{
     const dt=at(row,"date"),home=at(row,"home"),away=at(row,"away"),hs=at(row,"ft_home"),as=at(row,"ft_away");
     if(!dt||dt<startDate||dt>endDate||!home||!away||hs===""||as===""||!Number.isInteger(Number(hs))||!Number.isInteger(Number(as)))return [];
     return [{source:"OpenMatchday",external_id:"om:"+folder+":"+dt+":"+home+":"+away,home,away,home_score:Number(hs),away_score:Number(as),status:"finished",date:dt,url,raw:{folder,header:rows[0],row}} as ScoreFeed];
    });
   });
   for(const f of feeds){if(f.status==="fulfilled")out.push(...f.value);}
  }
 }catch(e){console.log("[moneyball-results-sync] OpenMatchday error",String(e));}
 console.log("[moneyball-results-sync] OpenMatchday",JSON.stringify({durationMs:Date.now()-openMatchdayStarted,feeds:out.filter((x:any)=>x.source==="OpenMatchday").length}));
 const openLigaStarted=Date.now();
 const hasGermanDue=due.some((m:any)=>/^(germany|deu|ger)$/i.test(String(m.country||"").trim())||/\b(1\.? bundesliga|2\.? bundesliga|bundesliga)\b/i.test(String(m.league||"")));
 if(hasGermanDue){
  const year=Number(startDate.slice(0,4));
  for(const league of ["bl1","bl2"]){
   const url="https://api.openligadb.de/getmatchdata/"+league+"/"+year;
   try{
    const r=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"MoneyballGlobal/2.0"},signal:AbortSignal.timeout(8000)});
    if(!r.ok)continue;const arr=await r.json();
    for(const e of arr||[]){
     const dt=e.matchDateTimeUTC||e.matchDateTime;if(!dt||day(new Date(dt))<startDate||day(new Date(dt))>endDate)continue;
     const final=e.matchResults?.find((z:any)=>z.resultTypeKind==="After90Minutes")||e.matchResults?.find((z:any)=>z.resultOrderID===2);
     out.push({source:"OpenLigaDB",external_id:String(e.matchID),home:e.team1?.teamName||"",away:e.team2?.teamName||"",home_score:e.matchIsFinished&&final?Number(final.pointsTeam1):null,away_score:e.matchIsFinished&&final?Number(final.pointsTeam2):null,status:e.matchIsFinished?"finished":"scheduled",date:dt,url,raw:e});
    }
   }catch(_){}
  }
 }
 console.log("[moneyball-results-sync] OpenLigaDB",JSON.stringify({durationMs:Date.now()-openLigaStarted,feeds:out.filter((x:any)=>x.source==="OpenLigaDB").length,skipped:!hasGermanDue}));
 console.log("[moneyball-results-sync] alternate total",JSON.stringify({feeds:out.length,durationMs:Date.now()-alternateStarted}));
 return out;
}
function matchFeedToDb(feed:ScoreFeed,matches:any[]){
 const when=new Date(feed.date).getTime();
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(String(feed.date||""));const found=matches.filter(m=>{if(!similarTeam(feed.home,m.home_team)||!similarTeam(feed.away,m.away_team))return false;if(!Number.isFinite(when)||!m.kickoff_at)return true;if(dateOnly)return day(new Date(m.kickoff_at))===String(feed.date)||Math.abs(new Date(m.kickoff_at).getTime()-when)<=30*60*60*1000;return Math.abs(new Date(m.kickoff_at).getTime()-when)<=6*60*60*1000;});
 return found.length===1?found[0]:null;
}
async function saveSourceObservation(m:any,f:ScoreFeed){
 const row={match_id:m.id,source:f.source,external_match_id:f.external_id,source_status:f.status,home_score:f.home_score,away_score:f.away_score,source_url:f.url,fetched_at:new Date().toISOString(),raw:f.raw};
 await dbUpsert("match_result_sources",row,"match_id,source,external_match_id");
}

function outcome(h:number,a:number){return h>a?"1":h<a?"2":"X";}
function won(selection:string,result:string):boolean|null{if(selection==="1X")return result!=="2";if(selection==="X2")return result!=="1";if(selection==="12")return result!=="X";if(["1","X","2"].includes(selection))return selection===result;return null;}
async function markVoid(m:any,reason:string){
 const now=new Date().toISOString();
 await db("matches?id=eq."+m.id,"PATCH",{status:reason,updated_at:now});
 const preds=await db("predictions?select=id,selection,pick&match_id=eq."+m.id);
 for(const p of preds||[]){
  const pick=String(p.selection||p.pick||"").trim();if(!pick||pick==="—"){await db("predictions?id=eq."+p.id,"PATCH",{settlement_status:"void",result_status:"void",verified:true,settled_at:now,note:"Brak poprawnego typu — wyłączono z rozliczenia skuteczności."});continue;}
  await db("predictions?id=eq."+p.id,"PATCH",{settlement_status:"void",result_status:"void",verified:true,settled_at:now});
  const legs=await db("coupon_legs?select=id,coupon_id&prediction_id=eq."+p.id);
  for(const leg of legs||[]){
   await db("coupon_legs?id=eq."+leg.id,"PATCH",{status:"void",result_status:"void"});
   const all=await db("coupon_legs?select=status&coupon_id=eq."+leg.coupon_id),statuses=(all||[]).map((x:any)=>x.status);
   const cs=statuses.includes("lost")?"lost":statuses.length&&statuses.every((x:string)=>x==="won"||x==="void")?(statuses.every((x:string)=>x==="void")?"void":"won"):"pending";
   await db("coupons?id=eq."+leg.coupon_id,"PATCH",{status:cs,settled_at:cs==="pending"?null:now});
   await reconcileCouponMoney(String(leg.coupon_id),now);
  }
 }
}
async function fixturePostponed(id:string){
 const r=await fetch("https://footynomad.com/fixture/"+id,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MoneyballGlobal/2.0)","Accept":"text/html"}});
 if(!r.ok)return false;
 const html=await r.text();
 const ts=html.indexOf("<title"),te=html.indexOf("</title>",ts);
 const title=ts>=0&&te>ts?clean(html.slice(html.indexOf(">",ts)+1,te)):"";
 const dm=html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i);
 const desc=clean(dm?.[1]||"");
 return /was postponed|has been postponed|cancelled|canceled/i.test(title+" "+desc);
}
function goalsWon(selection:string,home:number,away:number):boolean|null{
 const total=home+away;
 switch(selection){
  case "BTTS_YES":return home>0&&away>0;case "BTTS_NO":return home===0||away===0;
  case "OVER_1.5":return total>=2;case "UNDER_1.5":return total<=1;
  case "OVER_2.5":return total>=3;case "UNDER_2.5":return total<=2;
  case "OVER_3.5":return total>=4;case "UNDER_3.5":return total<=3;
  default:return null;
 }
}
async function reconcileCouponMoney(couponId:string,now:string){
 // All coupon status, payout and bankroll mutations run in one Postgres transaction.
 // The RPC locks the coupon and serializes balance rebuilds per owner; unique ledger indexes
 // are the final idempotency guard for repeated or concurrent cron deliveries.
 const rows=await db("rpc/moneyball_reconcile_coupon_finance","POST",{p_coupon_id:couponId});
 const result=Array.isArray(rows)?rows[0]:rows;
 if(!result?.ok && result?.reason!=="coupon_missing_or_cancelled"){
  throw new Error("Atomic coupon finance reconciliation failed for "+couponId+": "+JSON.stringify(result));
 }
 return result;
}

async function processFixture(f:any,m:any,source="FootyNomad",externalId?:string){
 const processStarted=Date.now();
 const result=outcome(f.home_score,f.away_score),now=new Date().toISOString();
 const old=await db("match_results?select=id&match_id=eq."+m.id);
 const resultRow={owner_id:m.owner_id,home_score:f.home_score,away_score:f.away_score,home_goals:f.home_score,away_goals:f.away_score,outcome_1x2:result,verified:true,source,finished_at:m.kickoff_at||now,verified_at:now,settled_at:now};
 if(old?.length)await db("match_results?id=eq."+old[0].id,"PATCH",resultRow);else await db("match_results","POST",{match_id:m.id,...resultRow});
 await saveSourceObservation(m,{source,external_id:String(externalId||f.external_id||""),home:m.home_team,away:m.away_team,home_score:f.home_score,away_score:f.away_score,status:"finished",date:m.kickoff_at||now,url:f.url||f.source_url||(source==="FootyNomad"?"https://footynomad.com/fixture/"+String(externalId||f.external_id||""):""),raw:f});
 await db("matches?id=eq."+m.id,"PATCH",{status:"finished",updated_at:now});
 const preds=await db("predictions?select=id,market,selection,prediction_type,pick,verdict,stake,odds&match_id=eq."+m.id);
 const settledRows:any[]=[];
 for(const p of preds||[]){
  const selection=String(p.selection||p.pick||"").trim(),market=String(p.market||"").toUpperCase();
  const isWon=market==="GOALS"?goalsWon(selection,Number(f.home_score),Number(f.away_score)):won(selection,result);
  if(isWon===null)continue;
  settledRows.push({p,status:isWon?"won":"lost"});
 }
 const wonIds=settledRows.filter(x=>x.status==="won").map(x=>x.p.id);
 const lostIds=settledRows.filter(x=>x.status==="lost").map(x=>x.p.id);
 if(wonIds.length)await db("predictions?id=in.("+wonIds.join(",")+")","PATCH",{settlement_status:"won",result_status:"won",verified:true,settled_at:now});
 if(lostIds.length)await db("predictions?id=in.("+lostIds.join(",")+")","PATCH",{settlement_status:"lost",result_status:"lost",verified:true,settled_at:now});
 const selectedRows=settledRows.filter(x=>String(x.p.verdict||"").toUpperCase()==="WYBRANY");
 for(const x of selectedRows){
  const p=x.p,stake=Number(p.stake??4),odds=p.odds==null?null:Number(p.odds);
  const financial={stake,potential_return:odds!=null&&odds>1?Math.round(stake*odds*100)/100:null,profit_loss:x.status==="won"?(odds!=null&&odds>1?Math.round(stake*(odds-1)*100)/100:null):-stake};
  await db("predictions?id=eq."+p.id,"PATCH",financial);
 }
 const predictionIds=settledRows.map(x=>String(x.p.id));
 const linked=predictionIds.length?await db("coupon_legs?select=id,coupon_id,prediction_id&prediction_id=in.("+predictionIds.join(",")+")"):[];
 const touched=new Set<string>();
 for(const x of settledRows){
  for(const leg of (linked||[]).filter((l:any)=>String(l.prediction_id)===String(x.p.id)))touched.add(String(leg.coupon_id));
 }
 for(const status of ["won","lost"]){
  const ids=(linked||[]).filter((l:any)=>settledRows.some(x=>String(x.p.id)===String(l.prediction_id)&&x.status===status)).map((l:any)=>String(l.id));
  if(ids.length)await db("coupon_legs?id=in.("+ids.join(",")+")","PATCH",{status,result_status:status});
 }
 for(const couponId of touched){
  const all=await db("coupon_legs?select=status&coupon_id=eq."+couponId),statuses=(all||[]).map((x:any)=>x.status);
  const cs=statuses.includes("lost")?"lost":statuses.length&&statuses.every((x:string)=>x==="won"||x==="void")?(statuses.every((x:string)=>x==="void")?"void":"won"):"pending";
  await db("coupons?id=eq."+couponId,"PATCH",{status:cs,settled_at:cs==="pending"?null:now});
  await reconcileCouponMoney(couponId,now);
 }
 const legsSettled=(linked||[]).length;
 console.log("[moneyball-results-sync] processFixture",JSON.stringify({matchId:m.id,predictions:preds?.length||0,settled:settledRows.length,legsSettled,coupons:touched.size,durationMs:Date.now()-processStarted}));
 return {settled:settledRows.length,legsSettled};
}

async function reconcileRescheduledMatches(ownerId:string|null=null){
 // This seven-day HTML lookup is ancillary; keep it off the five-minute results-sync hot path.
 // The database lease is atomic across overlapping invocations and permits one check per 15 minutes.
 const claim=await db("rpc/moneyball_claim_reschedule_sync","POST",{});
 if(claim!==true)return {updated:0,errors:[],skipped:true};
 const today=day(new Date()),cursor=new Date(today+"T12:00:00Z"),futureDates:string[]=[];
 for(let i=1;i<=7;i++){cursor.setUTCDate(cursor.getUTCDate()+1);futureDates.push(day(cursor));}
 const reads=await limitedSettled(futureDates,4,readDay);
 const futureById=new Map<string,any>();
 const readErrors:string[]=[];
 for(let i=0;i<reads.length;i++){
  const item=reads[i];
  if(item.status!=="fulfilled"){readErrors.push(futureDates[i]+": "+String(item.reason));continue;}
  for(const fixture of item.value){
   if(!fixture.kickoff_at||!["scheduled","live"].includes(fixture.status))continue;
   if(day(new Date(fixture.kickoff_at))<=today)continue;
   const id=String(fixture.external_id),prior=futureById.get(id);
   if(!prior||new Date(fixture.kickoff_at).getTime()<new Date(prior.kickoff_at).getTime())futureById.set(id,fixture);
  }
 }
 if(!futureById.size)return {updated:0,errors:readErrors};
 const cutoff=new Date(Date.now()-3*60*60*1000).toISOString();
 const stale=await db("matches?select=id,external_id,source,kickoff_at,status,home_team,away_team,country,league,notes&kickoff_at=lt."+encodeURIComponent(cutoff)+"&status=in.(scheduled,unknown,live)"+(ownerId?"&owner_id=eq."+encodeURIComponent(ownerId):""));
 const candidates=(stale||[]).filter((m:any)=>String(m.source||"").toLowerCase()==="footynomad"&&m.external_id&&isEuropeanFixture(m.country,m.league,m.home_team,m.away_team)&&futureById.has(String(m.external_id)));
 if(!candidates.length)return {updated:0,errors:readErrors};
 const ids=candidates.map((m:any)=>m.id);
 const existing:any[]=[];
 for(let offset=0;offset<ids.length;offset+=100){
  const chunk=ids.slice(offset,offset+100);
  const rows=await db("match_results?select=match_id&match_id=in.("+chunk.join(",")+")");
  existing.push(...(rows||[]));
 }
 const settled=new Set((existing||[]).map((r:any)=>String(r.match_id)));
 let updated=0;
 for(const m of candidates){
  if(settled.has(String(m.id)))continue;
  const f=futureById.get(String(m.external_id)),next=new Date(f.kickoff_at).getTime(),previous=new Date(m.kickoff_at).getTime();
  if(!Number.isFinite(next)||next<=Date.now()||Math.abs(next-previous)<6*60*60*1000)continue;
  const note="Termin automatycznie zaktualizowany na podstawie przyszłego terminarza FootyNomad: "+m.kickoff_at+" → "+f.kickoff_at;
  await db("matches?id=eq."+m.id,"PATCH",{kickoff_at:f.kickoff_at,status:f.status==="live"?"live":"scheduled",updated_at:new Date().toISOString(),notes:(String(m.notes||"")+"\\n"+note).trim()});
  updated++;
 }
 return {updated,errors:readErrors};
}
async function reconcileAllSettledCoupons(ownerId:string|null=null){
 const ownerFilter=ownerId?"&owner_id=eq."+encodeURIComponent(ownerId):"";
 const coupons=await db("coupons?select=id,status,settled_at,stake,target_legs&status=in.(won,lost,void)&settled_at=not.is.null"+ownerFilter+"&order=created_at.asc");
 const ids=(coupons||[]).map((x:any)=>String(x.id));
 if(!ids.length)return {checked:0,reconciled:0,failed:0,errors:[] as string[]};
 const [legs,transactions]=await Promise.all([
  db("coupon_legs?select=coupon_id,status,odds&coupon_id=in.("+ids.join(",")+")"),
  db("bankroll_transactions?select=coupon_id,transaction_type&coupon_id=in.("+ids.join(",")+")")
 ]);
 const legsByCoupon=new Map<string,any[]>(),txByCoupon=new Map<string,any[]>();
 for(const leg of legs||[]){const key=String(leg.coupon_id),arr=legsByCoupon.get(key)||[];arr.push(leg);legsByCoupon.set(key,arr);}
 for(const tx of transactions||[]){const key=String(tx.coupon_id),arr=txByCoupon.get(key)||[];arr.push(tx);txByCoupon.set(key,arr);}
 const repair=(coupons||[]).filter((coupon:any)=>{
  const couponLegs=legsByCoupon.get(String(coupon.id))||[];
  if(couponLegs.length!==Number(coupon.target_legs||3))return false;
  const statuses=couponLegs.map((x:any)=>String(x.status||"pending"));
  const lost=statuses.includes("lost"),pending=statuses.includes("pending"),allVoid=statuses.every((x:string)=>x==="void");
  const expectedStatus=lost?"lost":pending?"pending":allVoid?"void":"won";
  if(expectedStatus!==coupon.status||!coupon.settled_at)return true;
  const tx=txByCoupon.get(String(coupon.id))||[];
  if(Number(coupon.stake)>0&&!tx.some((x:any)=>x.transaction_type==="stake"))return true;
  const active=couponLegs.filter((x:any)=>x.status!=="void");
  const oddsComplete=active.length>0&&active.every((x:any)=>x.odds!=null&&Number.isFinite(Number(x.odds))&&Number(x.odds)>1);
  const payoutExpected=!pending&&!lost&&(allVoid||oddsComplete);
  return payoutExpected&&!tx.some((x:any)=>x.transaction_type==="return");
 });
 let checked=0,failed=0;const errors:string[]=[];
 for(let offset=0;offset<repair.length;offset+=3){
  const batch=repair.slice(offset,offset+3);
  const settled=await Promise.allSettled(batch.map((coupon:any)=>reconcileCouponMoney(String(coupon.id),new Date().toISOString())));
  for(let i=0;i<settled.length;i++){checked++;if(settled[i].status==="rejected"){failed++;errors.push(String(batch[i].id)+": "+String((settled[i] as PromiseRejectedResult).reason));}}
 }
 return {checked:coupons.length,reconciled:repair.length,failed,errors};
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const cronToken=req.headers.get("x-cron-token")||"";
 const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!SERVICE_KEY)return new Response(JSON.stringify({ok:false,error:"Server configuration error"}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 let ownerId:string|null=null,authorizedCron=false;
 if(cronToken){
  try{
   const authResponse=await fetch(SUPABASE_URL+"/rest/v1/rpc/moneyball_cron_token_valid",{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_token:cronToken})});
   authorizedCron=authResponse.ok&&(await authResponse.json())===true;
  }catch(_){authorizedCron=false;}
 }
 if(!authorizedCron){
  if(!bearer)return new Response(JSON.stringify({ok:false,error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  try{
   const userResponse=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+bearer}});
   if(!userResponse.ok)return new Response(JSON.stringify({ok:false,error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
   const user=await userResponse.json();ownerId=typeof user.id==="string"?user.id:null;
   if(!ownerId)return new Response(JSON.stringify({ok:false,error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  }catch(_){return new Response(JSON.stringify({ok:false,error:"Unauthorized"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});}
 }
 try{
  const u=new URL(req.url),requested=u.searchParams.get("date"),span=Math.min(7,Math.max(1,Number(u.searchParams.get("days")||4)));
  const today=new Date(),dates:string[]=[];
  if(requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested))dates.push(requested);
  else for(let i=span-1;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);dates.push(day(d));}
  let fetched=0,matched=0,matchedById=0,matchedByNames=0,resultsSaved=0,predictionsSettled=0,couponLegsSettled=0,voided=0,alternateFetched=0,alternateMatched=0,rescheduledMatches=0;const errors:string[]=[],rescheduleErrors:string[]=[];
  const rescheduleStarted=Date.now();
  let reconciledSkipped=false;
  try{const reconciled=await reconcileRescheduledMatches(ownerId);rescheduledMatches=reconciled.updated;reconciledSkipped=reconciled.skipped===true;rescheduleErrors.push(...reconciled.errors);}catch(e){rescheduleErrors.push(String(e));}
  console.log("[moneyball-results-sync] reschedule reconciliation",JSON.stringify({updated:rescheduledMatches,skipped:reconciledSkipped,errors:rescheduleErrors.length,durationMs:Date.now()-rescheduleStarted}));
  const allAlternateFeeds=await readAlternateResults(dates[0],dates[dates.length-1]).catch(e=>{errors.push("Źródła zapasowe: "+String(e));return [] as ScoreFeed[];});
  for(const date of dates){
   try{
    // Query a wide UTC window, then filter by the actual Brussels calendar day.
    const start=new Date(Date.parse(date+"T00:00:00.000Z")-86400000),end=new Date(Date.parse(date+"T00:00:00.000Z")+2*86400000);
     const matchFields="select=id,external_id,source,home_team,away_team,country,league,gender,kickoff_at,kickoff_date,status,owner_id";
     const ownerFilter=ownerId?"&owner_id=eq."+encodeURIComponent(ownerId):"";
     const matchLoadStarted=Date.now();
     const rawMatches=await db("matches?"+matchFields+"&kickoff_at=gte."+encodeURIComponent(start.toISOString())+"&kickoff_at=lt."+encodeURIComponent(end.toISOString())+ownerFilter);
     const rawDateOnly=await db("matches?"+matchFields+"&kickoff_at=is.null&kickoff_date=eq."+encodeURIComponent(date)+ownerFilter);
     const matches=[...(rawMatches||[]).filter((m:any)=>m.kickoff_at&&day(new Date(m.kickoff_at))===date),...(rawDateOnly||[]).filter((m:any)=>String(m.kickoff_date||"").slice(0,10)===date)].filter((m:any)=>isEuropeanFixture(m.country,m.league,m.home_team,m.away_team));
    const existingResults:any[]=[];
    // Bound every IN query to avoid PostgREST gateway URL limits on large match days.
    for(let offset=0;offset<matches.length;offset+=100){
     const ids=matches.slice(offset,offset+100).map((m:any)=>m.id);
     if(!ids.length)continue;
     const rows=await db("match_results?select=match_id,home_score,away_score,verified&match_id=in.("+ids.join(",")+")");
     existingResults.push(...(rows||[]));
    }
    const existingResultByMatch=new Map<string,any>((existingResults||[]).map((r:any)=>[r.match_id,r]));
    console.log("[moneyball-results-sync] main match load",JSON.stringify({rawMatches:rawMatches?.length||0,dateOnly:rawDateOnly?.length||0,eligibleDayMatches:matches.length,existingResults:existingResults.length,durationMs:Date.now()-matchLoadStarted}));
    const map=new Map(matches.filter((m:any)=>m.external_id&&String(m.source||"").toLowerCase()==="footynomad").map((m:any)=>[String(m.external_id),m]));
    const normTeam=(v:string)=>String(v||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\\s+/g," ");
    const genderOf=(m:any)=>["men","women"].includes(String(m?.gender||"").toLowerCase())?String(m.gender).toLowerCase():"unknown";
    const genderSafeRows=(rows:any[],targetGender:string)=>{const known=new Set(rows.map(genderOf).filter((g:string)=>g!=="unknown"));if(targetGender!=="unknown")return rows.filter((x:any)=>genderOf(x)===targetGender||(genderOf(x)==="unknown"&&known.size<=1));return known.size<=1?rows:[];};
    const byTeams=new Map<string,any[]>();
    for(const m of (matches||[])){
     const key=normTeam(m.home_team)+"|"+normTeam(m.away_team);
     const arr=byTeams.get(key)||[];arr.push(m);byTeams.set(key,arr);
    }
    const footyNomadStarted=Date.now();
    const fixtures=await readDay(date);fetched+=fixtures.length;
    console.log("[moneyball-results-sync] FootyNomad",JSON.stringify({date,fixtures:fixtures.length,durationMs:Date.now()-footyNomadStarted}));
    const alternateFeeds=allAlternateFeeds.filter(feed=>day(new Date(feed.date))===date);alternateFetched+=alternateFeeds.length;
    const alternateByMatch=new Map<string,ScoreFeed[]>();
    const alternateObservationStarted=Date.now();
    const observationRows=new Map<string,any>();
    for(const feed of alternateFeeds){
     const fm=matchFeedToDb(feed,matches);if(!fm)continue;
     alternateMatched++;
     const arr=alternateByMatch.get(fm.id)||[];arr.push(feed);alternateByMatch.set(fm.id,arr);
     const row={match_id:fm.id,source:feed.source,external_match_id:feed.external_id,source_status:feed.status,home_score:feed.home_score,away_score:feed.away_score,source_url:feed.url,fetched_at:new Date().toISOString(),raw:feed.raw};
     observationRows.set(fm.id+"|"+feed.source+"|"+feed.external_id,row);
    }
    const observationBatch=[...observationRows.values()];
    if(observationBatch.length){
     try{await dbUpsert("match_result_sources",observationBatch,"match_id,source,external_match_id");}
     catch(e){
      const fallback=await limitedSettled(observationBatch,5,async row=>dbUpsert("match_result_sources",row,"match_id,source,external_match_id"));
      for(const x of fallback){if(x.status==="rejected")errors.push("Zapis obserwacji źródła: "+String(x.reason));}
     }
    }
    console.log("[moneyball-results-sync] alternate observation persistence",JSON.stringify({feeds:alternateFeeds.length,matched:alternateMatched,upsertRows:observationBatch.length,durationMs:Date.now()-alternateObservationStarted}));
    // Synchronize live status before the final whistle.
    for(const f of fixtures){
     if(f.status!=="live")continue;
     const m=map.get(String(f.external_id));
     if(m&&m.status!=="live")await db("matches?id=eq."+m.id,"PATCH",{status:"live",updated_at:new Date().toISOString()});
    }
    const eligible:any[]=[];
    for(const f of fixtures){
     if(f.status!=="finished"||!Number.isInteger(f.home_score)||!Number.isInteger(f.away_score))continue;
     let exact=map.get(String(f.external_id));
     const exactTeamMatches=byTeams.get(normTeam(f.home_team)+"|"+normTeam(f.away_team))||[];
     const feedGender=genderOf(f);
     if(exact&&feedGender!=="unknown"&&genderOf(exact)!=="unknown"&&genderOf(exact)!==feedGender)exact=null;
     let safeTeamMatches:any[]=[];
     if(exact){
      const anchorGender=genderOf(exact);
      safeTeamMatches=genderSafeRows(exactTeamMatches,anchorGender).filter((x:any)=>x.id!==exact.id);
     }else safeTeamMatches=genderSafeRows(exactTeamMatches,feedGender);
     const fallbackMatch=exactTeamMatches.length===0?matchFeedToDb({source:"FootyNomad",external_id:String(f.external_id),home:f.home_team,away:f.away_team,home_score:f.home_score,away_score:f.away_score,status:f.status,date,url:"https://footynomad.com/fixture/"+String(f.external_id),raw:f},matches):null;
     // Never settle men's and women's fixtures together. If a feed has no gender and same-team candidates span both genders, leave name-only matches unresolved rather than guess.
     const candidates=exact?[exact,...safeTeamMatches]:(safeTeamMatches.length?safeTeamMatches:(fallbackMatch?[fallbackMatch]:[]));
     for(const m of candidates)eligible.push({f,m,matchMethod:exact?"external_id":"team_names"});
    }
    matched+=eligible.length;matchedById+=eligible.filter((x:any)=>x.matchMethod==="external_id").length;matchedByNames+=eligible.filter((x:any)=>x.matchMethod==="team_names").length;
    const resultProcessingStarted=Date.now();
    for(let i=0;i<eligible.length;i+=5){
     const batch=eligible.slice(i,i+5);
     const done=await Promise.allSettled(batch.map(async(x:any)=>{
      const alternates=alternateByMatch.get(x.m.id)||[];
      const conflicts=alternates.filter(a=>a.status==="finished"&&Number.isInteger(a.home_score)&&Number.isInteger(a.away_score)&&(a.home_score!==x.f.home_score||a.away_score!==x.f.away_score));
      if(conflicts.length)throw new Error("ROZBIEŻNOŚĆ WYNIKÓW: FootyNomad vs "+conflicts.map(a=>a.source).join(", ")+" — wstrzymano rozliczenie");
      const prior=existingResultByMatch.get(x.m.id);
      if(prior?.verified===true&&Number(prior.home_score)===Number(x.f.home_score)&&Number(prior.away_score)===Number(x.f.away_score)){
       const storedPredictions=await db("predictions?select=id,settlement_status,verified&match_id=eq."+x.m.id);
       const pendingLegs=await db("coupon_legs?select=id,status&match_id=eq."+x.m.id+"&status=eq.pending");
       const needsSettlement=(storedPredictions||[]).some((p:any)=>p.settlement_status==="pending"||p.verified!==true)||(pendingLegs||[]).length>0;
       if(!needsSettlement){
        if(x.m.status!=="finished")await db("matches?id=eq."+x.m.id,"PATCH",{status:"finished",updated_at:new Date().toISOString()});
        return {settled:0,legsSettled:0,skipped:true};
       }
      }
      // A result may have been saved before late predictions/coupon legs were created.
      // Re-run settlement whenever any linked prediction or leg is still pending.
      return processFixture(x.f,x.m,"FootyNomad",x.f.external_id);
     }));
     for(let j=0;j<done.length;j++){const d=done[j];if(d.status==="fulfilled"){if(!(d.value as any).skipped)resultsSaved++;predictionsSettled+=d.value.settled;couponLegsSettled+=d.value.legsSettled;}else errors.push(date+" "+batch[j].f.external_id+": "+String(d.reason));}
    }
    console.log("[moneyball-results-sync] result processing",JSON.stringify({eligible:eligible.length,durationMs:Date.now()-resultProcessingStarted}));
    const fixtureMap=new Map(fixtures.map((f:any)=>[String(f.external_id),f]));
    const oldMatches=(matches||[]).filter((m:any)=>!["finished","postponed","cancelled"].includes(m.status)&&(m.kickoff_at?new Date(m.kickoff_at).getTime()<Date.now()-3*60*60*1000:!!m.kickoff_date&&(String(m.kickoff_date)<date||(String(m.kickoff_date)===date&&(alternateByMatch.get(m.id)||[]).some((a:any)=>a.status==="finished"&&Number.isInteger(a.home_score)&&Number.isInteger(a.away_score)))))&&!eligible.some((x:any)=>x.m.id===m.id));
    const fallbackProcessingStarted=Date.now();
    for(let i=0;i<oldMatches.length;i+=5){
     const batch=oldMatches.slice(i,i+5);
     const done=await Promise.allSettled(batch.map(async(m:any)=>{
      const f=String(m.source||"").toLowerCase()==="footynomad"?fixtureMap.get(String(m.external_id)) as any:undefined;
      const alternates=alternateByMatch.get(m.id)||[];
      const finishedAlt=alternates.filter(a=>a.status==="finished"&&Number.isInteger(a.home_score)&&Number.isInteger(a.away_score));
      if(finishedAlt.length){
       const scoreGroups=new Map<string,ScoreFeed[]>();for(const a of finishedAlt){const k=a.home_score+":"+a.away_score;const g=scoreGroups.get(k)||[];g.push(a);scoreGroups.set(k,g);}
       const best=[...scoreGroups.entries()].sort((a,b)=>b[1].length-a[1].length)[0];
       if(best&&best[1].length>=1&&scoreGroups.size===1){
        const chosen=best[1][0];const saved=await processFixture({home_score:chosen.home_score,away_score:chosen.away_score,external_id:chosen.external_id,source_url:chosen.url},m,chosen.source,chosen.external_id);resultsSaved++;predictionsSettled+=saved.settled;couponLegsSettled+=saved.legsSettled;return false;
       }
       if(scoreGroups.size>1){await db("matches?id=eq."+m.id,"PATCH",{status:"unknown",updated_at:new Date().toISOString(),notes:(String(m.notes||"")+"\\nRozbieżne wyniki w źródłach zapasowych — wymagana kontrola ręczna.").trim()});return false;}
      }
      if(["finished","postponed","cancelled"].includes(m.status))return false;
      if(f?.status==="postponed"||f?.status==="cancelled"||await fixturePostponed(String(m.external_id))){await markVoid(m,f?.status==="cancelled"?"cancelled":"postponed");return true;}
      if(f?.status==="live"){await db("matches?id=eq."+m.id,"PATCH",{status:"live",updated_at:new Date().toISOString()});return false;}
      if(m.status!=="unknown"){await db("matches?id=eq."+m.id,"PATCH",{status:"unknown",updated_at:new Date().toISOString(),notes:(String(m.notes||"")+"\\nBrak potwierdzonego wyniku po czasie rozpoczęcia — oczekuje na wiarygodne źródło.").trim()});}
      return false;
     }));
     for(let j=0;j<done.length;j++){const d=done[j];if(d.status==="fulfilled"&&d.value)voided++;else if(d.status==="rejected")errors.push(date+" "+batch[j].external_id+": "+String(d.reason));}
    }
    console.log("[moneyball-results-sync] old match fallback",JSON.stringify({matches:oldMatches.length,durationMs:Date.now()-fallbackProcessingStarted}));
   }catch(e){errors.push(date+": "+String(e));}
  }
  const financeStarted=Date.now();
  const financialReconciliation=await reconcileAllSettledCoupons(ownerId).catch(e=>({checked:0,failed:1,errors:[String(e)]}));
  console.log("[moneyball-results-sync] financial reconciliation",JSON.stringify({...financialReconciliation,durationMs:Date.now()-financeStarted}));
  if(financialReconciliation.failed)errors.push(...financialReconciliation.errors.map(e=>"Rozliczenie finansowe: "+e));
  console.log("[moneyball-results-sync] request summary",JSON.stringify({dates,fixturesFetched:fetched,matchesMatched:matched,resultsSaved,predictionsSettled,couponLegsSettled,alternateResultsFetched:alternateFetched,alternateResultsMatched:alternateMatched,errors:errors.length}));
  return new Response(JSON.stringify({ok:errors.length===0,financial_reconciliation:financialReconciliation,dates,fixtures_fetched:fetched,matches_matched:matched,matched_by_external_id:matchedById,matched_by_team_names:matchedByNames,results_saved:resultsSaved,predictions_settled:predictionsSettled,coupon_legs_settled:couponLegsSettled,voided,rescheduled_matches:rescheduledMatches,reschedule_errors:rescheduleErrors,alternate_results_fetched:alternateFetched,alternate_results_matched:alternateMatched,errors}),{headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
 }catch(e){return new Response(JSON.stringify({ok:false,error:String(e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}});}
});