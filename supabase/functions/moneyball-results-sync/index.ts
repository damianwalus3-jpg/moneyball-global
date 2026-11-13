import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
 if(!r.ok)throw new Error("Supabase "+r.status+": "+(data?.message||raw));return data;
}
async function readDay(date:string){
 const r=await fetch("https://footynomad.com/fixtures/"+date,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MoneyballGlobal/2.0)","Accept":"text/html"}});
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
const ESPN_LEAGUES=["eng.1","esp.1","ita.1","ger.1","fra.1","bel.1","ned.1","por.1","sco.1","uefa.champions","uefa.europa","uefa.europa.conf","eng.w.1","eng.w.fa","eng.w.league_cup","eng.w.promotion.relegation","esp.w.1","fra.w.1","ned.w.1","ned.w.knvb_cup","uefa.w.nations","uefa.w.europa"];
const ESPN_COUNTRY_PREFIX:Record<string,string>={england:"eng",eng:"eng",spain:"esp",italy:"ita",germany:"ger",france:"fra",belgium:"bel",netherlands:"ned",portugal:"por",scotland:"sco",usa:"usa","united states":"usa",brazil:"bra",argentina:"arg",mexico:"mex","saudi arabia":"ksa",turkey:"tur",japan:"jpn",australia:"aus",china:"chn",sweden:"swe",denmark:"den",norway:"nor",austria:"aut",greece:"gre",russia:"rus",chile:"chi",colombia:"col",peru:"per",paraguay:"par",ecuador:"ecu",venezuela:"ven",bolivia:"bol",uruguay:"uru","south africa":"rsa",india:"ind","el salvador":"slv",guatemala:"gua","costa rica":"crc",honduras:"hon"};
function teamKey(s:string){return clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|sc|afc|club|football|de|the)\b/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
function editDistance(a:string,b:string){const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=old;}}return prev[b.length];}
function similarTeam(a:string,b:string){const x=teamKey(a),y=teamKey(b);if(!x||!y)return false;if(x===y||x.includes(y)||y.includes(x))return true;const A=new Set(x.split(" ")),B=new Set(y.split(" "));const overlap=[...A].filter(t=>B.has(t)&&t.length>2).length;if(overlap>=2&&overlap/Math.max(1,Math.min(A.size,B.size))>=0.7)return true;const max=Math.max(x.length,y.length);return Math.min(x.length,y.length)>=8&&max>0&&editDistance(x,y)/max<=0.16;}
async function limitedSettled<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<PromiseSettledResult<R>[]>{const out:any[]=new Array(items.length);let cursor=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=cursor++;if(i>=items.length)return;try{out[i]={status:"fulfilled",value:await fn(items[i])};}catch(reason){out[i]={status:"rejected",reason};}}});await Promise.all(workers);return out;}
async function readAlternateResults(startDate:string,endDate:string):Promise<ScoreFeed[]>{
 const out:ScoreFeed[]=[];
 const matchFields="select=id,external_id,home_team,away_team,owner_id,country,league,gender,kickoff_at,kickoff_date,status";
 const timedMatches=await db("matches?"+matchFields+"&kickoff_at=gte."+encodeURIComponent(startDate+"T00:00:00Z")+"&kickoff_at=lt."+encodeURIComponent(endDate+"T23:59:59Z")).catch(()=>[]);
 const dateOnlyMatches=await db("matches?"+matchFields+"&kickoff_at=is.null&kickoff_date=gte."+encodeURIComponent(startDate)+"&kickoff_date=lte."+encodeURIComponent(endDate)).catch(()=>[]);
 const unresolved=[...(timedMatches||[]),...(dateOnlyMatches||[])],todayKey=day(new Date());
 const due=unresolved.filter((m:any)=>isEuropeanFixture(m.country,m.league,m.home_team,m.away_team)&&((m.kickoff_at&&new Date(m.kickoff_at).getTime()<Date.now())||(!m.kickoff_at&&m.kickoff_date&&String(m.kickoff_date)<=todayKey))&& !["finished","postponed","cancelled"].includes(String(m.status||"").toLowerCase()));
 const prefixes=new Set<string>(),worldHints:string[]=[];
 for(const m of due){const c=teamKey(m.country||"");const prefix=ESPN_COUNTRY_PREFIX[c];if(prefix)prefixes.add(prefix);if(c==="world")worldHints.push(String(m.league||""));}
 let leagues=[...ESPN_LEAGUES];
 try{
  const ir=await fetch("https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000",{headers:{"Accept":"application/json","User-Agent":"MoneyballGlobal/2.0"},signal:AbortSignal.timeout(8000)});
  if(ir.ok){
   const ix=await ir.json(),allCodes=(ix.items||[]).map((x:any)=>String(x.$ref||"").match(/\/leagues\/([^/?]+)/)?.[1]).filter(Boolean) as string[];
   const dynamic=allCodes.filter(code=>{
    const prefix=code.split(".")[0];
    if(prefixes.has(prefix)&&["eng","esp","ita","ger","fra","bel","ned","por","sco","aut","gre","tur","rus","swe","den","nor","pol","ukr","sui","uefa"].includes(prefix))return true;
    if(["afc","fifa","uefa","caf","concacaf","conmebol"].includes(prefix)){
     const hints=worldHints.join(" ").toLowerCase();
     if(!hints)return false;
     if(prefix==="uefa")return /uefa|champions|europa|conference|women/.test(hints);
     if(prefix==="caf")return /africa|afcon|caf|nations cup/.test(hints);
     if(prefix==="concacaf")return /concacaf|gold cup|caribbean|nations league/.test(hints);
     if(prefix==="conmebol")return /conmebol|copa|libertadores|sudamericana/.test(hints);
     if(prefix==="afc")return /asia|asian|afc|u17|u20|u21/.test(hints);
     return /world|fifa|u17|u20|u21/.test(hints);
    }
    return false;
   });
   leagues=[...new Set([...leagues,...dynamic])];
  }
 }catch(_){}
 const dateRange=startDate.replace(/-/g,"")+(startDate===endDate?"":"-"+endDate.replace(/-/g,""));
 const espn=await limitedSettled(leagues,12,async league=>{
  const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+league+"/scoreboard?dates="+dateRange;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 MoneyballGlobal/2.0","Accept":"application/json"},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error("ESPN "+league+" HTTP "+r.status);
  const j=await r.json();return {league,url,events:j.events||[]};
 });
 for(const x of espn){if(x.status!=="fulfilled")continue;for(const e of x.value.events||[]){
  const comps=e.competitions?.[0]?.competitors||[];
  const h=comps.find((c:any)=>c.homeAway==="home"),a=comps.find((c:any)=>c.homeAway==="away");
  const state=String(e.status?.type?.name||e.status?.type?.state||"").toLowerCase();
  const postponed=/postponed|canceled|cancelled|suspended/.test(state);
  const finished=!!e.status?.type?.completed||/final/.test(state);
  if(!h||!a)continue;
  out.push({source:"ESPN",external_id:String(e.id),home:h.team?.displayName||h.team?.name||"",away:a.team?.displayName||a.team?.name||"",home_score:finished?Number(h.score):null,away_score:finished?Number(a.score):null,status:postponed?"postponed":finished?"finished":state.includes("in")?"live":"scheduled",date:e.date||startDate,url:x.value.url,raw:e});
 }}
 // TheSportsDB public v1 feed: no signup or paid key; one request per date, with the free tier returning a small sample.
 const eventDates:string[]=[];const cursor=new Date(startDate+"T00:00:00Z"),last=new Date(endDate+"T00:00:00Z");
 for(;cursor<=last;cursor.setUTCDate(cursor.getUTCDate()+1))eventDates.push(cursor.toISOString().slice(0,10));
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
 // OpenMatchday publishes public results CSVs for dozens of competitions; query only leagues containing overdue fixtures.
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
 }catch(_){}
 const year=Number(startDate.slice(0,4));
 for(const league of ["bl1","bl2"]){
  const url="https://api.openligadb.de/getmatchdata/"+league+"/"+year;
  try{
   const r=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"MoneyballGlobal/2.0"},signal:AbortSignal.timeout(12000)});
   if(!r.ok)continue;const arr=await r.json();
   for(const e of arr||[]){
    const dt=e.matchDateTimeUTC||e.matchDateTime;if(!dt||day(new Date(dt))<startDate||day(new Date(dt))>endDate)continue;
    const final=e.matchResults?.find((z:any)=>z.resultTypeKind==="After90Minutes")||e.matchResults?.find((z:any)=>z.resultOrderID===2);
    out.push({source:"OpenLigaDB",external_id:String(e.matchID),home:e.team1?.teamName||"",away:e.team2?.teamName||"",home_score:e.matchIsFinished&&final?Number(final.pointsTeam1):null,away_score:e.matchIsFinished&&final?Number(final.pointsTeam2):null,status:e.matchIsFinished?"finished":"scheduled",date:dt,url,raw:e});
   }
  }catch(_){}
 }
 return out;
}
function matchFeedToDb(feed:ScoreFeed,matches:any[]){
 const when=new Date(feed.date).getTime();
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(String(feed.date||""));const found=matches.filter(m=>{if(!similarTeam(feed.home,m.home_team)||!similarTeam(feed.away,m.away_team))return false;if(!Number.isFinite(when)||!m.kickoff_at)return true;if(dateOnly)return day(new Date(m.kickoff_at))===String(feed.date)||Math.abs(new Date(m.kickoff_at).getTime()-when)<=30*60*60*1000;return Math.abs(new Date(m.kickoff_at).getTime()-when)<=6*60*60*1000;});
 return found.length===1?found[0]:null;
}
async function saveSourceObservation(m:any,f:ScoreFeed){
 const row={match_id:m.id,source:f.source,external_match_id:f.external_id,source_status:f.status,home_score:f.home_score,away_score:f.away_score,source_url:f.url,fetched_at:new Date().toISOString(),raw:f.raw};
 const q=await db("match_result_sources?select=id&match_id=eq."+m.id+"&source=eq."+encodeURIComponent(f.source)+"&external_match_id=eq."+encodeURIComponent(f.external_id));
 if(q?.length)await db("match_result_sources?id=eq."+q[0].id,"PATCH",row);else await db("match_result_sources","POST",row);
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
async function processFixture(f:any,m:any,source="FootyNomad",externalId?:string){
 const result=outcome(f.home_score,f.away_score),now=new Date().toISOString();
 const old=await db("match_results?select=id&match_id=eq."+m.id);
 const row={owner_id:m.owner_id,home_score:f.home_score,away_score:f.away_score,home_goals:f.home_score,away_goals:f.away_score,outcome_1x2:result,verified:true,source,finished_at:m.kickoff_at||now,verified_at:now,settled_at:now};
 if(old?.length)await db("match_results?id=eq."+old[0].id,"PATCH",row);else await db("match_results","POST",{match_id:m.id,...row});
 await saveSourceObservation(m,{source,external_id:String(externalId||f.external_id||""),home:m.home_team,away:m.away_team,home_score:f.home_score,away_score:f.away_score,status:"finished",date:m.kickoff_at||now,url:f.url||f.source_url||(source==="FootyNomad"?"https://footynomad.com/fixture/"+String(externalId||f.external_id||""):""),raw:f});
 await db("matches?id=eq."+m.id,"PATCH",{status:"finished",updated_at:now});
 const preds=await db("predictions?select=id,market,selection,prediction_type,pick&match_id=eq."+m.id);
 let settled=0,legsSettled=0;
 for(const p of preds||[]){
  const selection=String(p.selection||p.pick||"").trim();if(!selection||selection==="—"){await db("predictions?id=eq."+p.id,"PATCH",{settlement_status:"void",result_status:"void",verified:true,settled_at:now,note:"Brak poprawnego typu — wyłączono z rozliczenia skuteczności."});settled++;continue;}
  const isDc=String(p.market||p.prediction_type||"").toUpperCase().includes("DOUBLE")||String(p.prediction_type||"").toUpperCase()==="DC"||["1X","X2","12"].includes(selection);
  if(isDc&&!["1X","X2","12"].includes(selection))continue;
  if(!isDc&&!["1","X","2"].includes(selection))continue;
  const isWon=won(selection,result);if(isWon===null)continue;
  await db("predictions?id=eq."+p.id,"PATCH",{settlement_status:isWon?"won":"lost",result_status:isWon?"won":"lost",verified:true,settled_at:now});settled++;
  const legs=await db("coupon_legs?select=id,coupon_id&prediction_id=eq."+p.id);
  for(const leg of legs||[]){
   await db("coupon_legs?id=eq."+leg.id,"PATCH",{status:isWon?"won":"lost",result_status:isWon?"won":"lost"});legsSettled++;
   const all=await db("coupon_legs?select=status&coupon_id=eq."+leg.coupon_id),statuses=(all||[]).map((x:any)=>x.status);
   const cs=statuses.includes("lost")?"lost":statuses.length&&statuses.every((x:string)=>x==="won"||x==="void")?(statuses.every((x:string)=>x==="void")?"void":"won"):"pending";
   await db("coupons?id=eq."+leg.coupon_id,"PATCH",{status:cs,settled_at:cs==="pending"?null:now});
  }
 }
 return {settled,legsSettled};
}

async function reconcileRescheduledMatches(ownerId:string|null=null){
 const today=day(new Date()),cursor=new Date(today+"T12:00:00Z"),futureDates:string[]=[];
 for(let i=1;i<=7;i++){cursor.setUTCDate(cursor.getUTCDate()+1);futureDates.push(day(cursor));}
 const reads=await limitedSettled(futureDates,3,readDay);
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
 const existing=await db("match_results?select=match_id&match_id=in.("+ids.join(",")+")");
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
  try{const reconciled=await reconcileRescheduledMatches(ownerId);rescheduledMatches=reconciled.updated;rescheduleErrors.push(...reconciled.errors);}catch(e){rescheduleErrors.push(String(e));}
  const allAlternateFeeds=await readAlternateResults(dates[0],dates[dates.length-1]).catch(e=>{errors.push("Źródła zapasowe: "+String(e));return [] as ScoreFeed[];});
  for(const date of dates){
   try{
    // Query a wide UTC window, then filter by the actual Brussels calendar day.
    const start=new Date(Date.parse(date+"T00:00:00.000Z")-86400000),end=new Date(Date.parse(date+"T00:00:00.000Z")+2*86400000);
     const matchFields="select=id,external_id,source,home_team,away_team,country,league,gender,kickoff_at,kickoff_date,status,owner_id";
     const ownerFilter=ownerId?"&owner_id=eq."+encodeURIComponent(ownerId):"";
     const rawMatches=await db("matches?"+matchFields+"&kickoff_at=gte."+encodeURIComponent(start.toISOString())+"&kickoff_at=lt."+encodeURIComponent(end.toISOString())+ownerFilter);
     const rawDateOnly=await db("matches?"+matchFields+"&kickoff_at=is.null&kickoff_date=eq."+encodeURIComponent(date)+ownerFilter);
     const matches=[...(rawMatches||[]).filter((m:any)=>m.kickoff_at&&day(new Date(m.kickoff_at))===date),...(rawDateOnly||[]).filter((m:any)=>String(m.kickoff_date||"").slice(0,10)===date)].filter((m:any)=>isEuropeanFixture(m.country,m.league,m.home_team,m.away_team));
    const existingResults=matches.length?await db("match_results?select=match_id,home_score,away_score,verified&match_id=in.("+matches.map((m:any)=>m.id).join(",")+")"):[];
    const existingResultByMatch=new Map((existingResults||[]).map((r:any)=>[r.match_id,r]));
    const map=new Map(matches.filter((m:any)=>m.external_id&&String(m.source||"").toLowerCase()==="footynomad").map((m:any)=>[String(m.external_id),m]));
    const normTeam=(v:string)=>String(v||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\\s+/g," ");
    const genderOf=(m:any)=>["men","women"].includes(String(m?.gender||"").toLowerCase())?String(m.gender).toLowerCase():"unknown";
    const genderSafeRows=(rows:any[],targetGender:string)=>{const known=new Set(rows.map(genderOf).filter((g:string)=>g!=="unknown"));if(targetGender!=="unknown")return rows.filter((x:any)=>genderOf(x)===targetGender||(genderOf(x)==="unknown"&&known.size<=1));return known.size<=1?rows:[];};
    const byTeams=new Map<string,any[]>();
    for(const m of (matches||[])){
     const key=normTeam(m.home_team)+"|"+normTeam(m.away_team);
     const arr=byTeams.get(key)||[];arr.push(m);byTeams.set(key,arr);
    }
    const fixtures=await readDay(date);fetched+=fixtures.length;
    const alternateFeeds=allAlternateFeeds.filter(feed=>day(new Date(feed.date))===date);alternateFetched+=alternateFeeds.length;
    const alternateByMatch=new Map<string,ScoreFeed[]>();
    for(const feed of alternateFeeds){const fm=matchFeedToDb(feed,matches);if(!fm)continue;alternateMatched++;const arr=alternateByMatch.get(fm.id)||[];arr.push(feed);alternateByMatch.set(fm.id,arr);await saveSourceObservation(fm,feed);}
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
    const fixtureMap=new Map(fixtures.map((f:any)=>[String(f.external_id),f]));
    const oldMatches=(matches||[]).filter((m:any)=>!["finished","postponed","cancelled"].includes(m.status)&&(m.kickoff_at?new Date(m.kickoff_at).getTime()<Date.now()-3*60*60*1000:!!m.kickoff_date&&(String(m.kickoff_date)<date||(String(m.kickoff_date)===date&&(alternateByMatch.get(m.id)||[]).some((a:any)=>a.status==="finished"&&Number.isInteger(a.home_score)&&Number.isInteger(a.away_score)))))&&!eligible.some((x:any)=>x.m.id===m.id));
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
   }catch(e){errors.push(date+": "+String(e));}
  }
  return new Response(JSON.stringify({ok:errors.length===0,dates,fixtures_fetched:fetched,matches_matched:matched,matched_by_external_id:matchedById,matched_by_team_names:matchedByNames,results_saved:resultsSaved,predictions_settled:predictionsSettled,coupon_legs_settled:couponLegsSettled,voided,rescheduled_matches:rescheduledMatches,reschedule_errors:rescheduleErrors,alternate_results_fetched:alternateFetched,alternate_results_matched:alternateMatched,errors}),{headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
 }catch(e){return new Response(JSON.stringify({ok:false,error:String(e)}),{status:500,headers:{...cors,"Content-Type":"application/json"}});}
});