function isExcludedSeniorTeam(value: unknown): boolean {
 const team=String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 return /\b(reserves?|academy|youth|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico)\b/.test(team) || /(^| )(ii|iii|b)$/.test(team);
}

function isTopTwoTierLeague(competition: unknown): boolean {
 const comp=String(competition??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 if(!comp)return false;

 // UEFA Nations League is a European national-team competition, not a domestic tier.

 if (/^uefa nations league.*$/.test(comp)) return true;
 if(/\b(u(?:17|18|19|20|21|23)|under ?(?:17|18|19|20|21|23)|youth|junior(?:s)?|academy|juvenil|jugend|reserve|reserves|b team)\b/.test(comp))return false;
 if(/\b(?:3|4|5|6|7|8|9|iii|iv|v|vi)\s*(?:\.\s*)?(?:liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)\b|\b(?:third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\b/.test(comp))return false;
 return /\b(?:premier league|premiership|championship|super league 2|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|2 bundesliga|austrian 2 liga|2 liga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|primera division|segunda division|segunda liga|segunda divisao|liga portugal 2|liga portugal|eredivisie|eerste divisie|keuken kampioen divisie|primeira liga|ekstraklasa|i liga|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|liga e pare|prva liga|first league|second league|fnl|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|i lyga|virsliga|meistriliiga|esiliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|1 divisjon|premier division|league of ireland premier|league of ireland first|scottish championship|challenge league|tff first league|national football league|football league|nb i|nb ii|nemzeti bajnoksag i|nemzeti bajnoksag ii|kategoria superiore|kategoria e pare|premyer liqa|i liqa|p1 liga|1 deild|cymru premier|cymru north|cymru south|e rovnuli liga|erovnuli liga 2|persha liga|first nl|prva nl|2 snl|first professional football league|second professional football league|bulgarian second league|first division a|first division b|1 division|2 division|divizia nationala|divizia a|liga nacional|liga i|liga ii)\b/.test(comp);
}
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL="https://gzgeklcukrclgwbsmbsp.supabase.co";
const KEY=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-requested-with, prefer, cache-control, pragma","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"};


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

async function runLimited<T>(items:T[],limit:number,fn:(item:T)=>Promise<void>){let cursor=0;const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=cursor++;if(i>=items.length)return;await fn(items[i]);}});await Promise.all(workers);}
function textOf(s:string){return s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g," ").trim();}
async function readFixtures(date:string){
 const up=await fetch("https://footynomad.com/fixtures/"+date,{headers:{"User-Agent":"Mozilla/5.0"}});
 if(!up.ok)throw new Error("FootyNomad HTTP "+up.status);
 const html=await up.text(),re=/<a\b([^>]*\bhref=["'](?:https?:\/\/footynomad\.com)?\/fixture\/[^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi;
 const fixtures=[];let m;
 while((m=re.exec(html))!==null){
  const attrs=m[1],body=m[2],href=(attrs.match(/href=["']([^"']+)/i)||[])[1]||"",id=(href.match(/\/fixture\/(\d+)/)||[])[1]||null;
  const home=textOf((body.match(/<span[^>]*class=["'][^"']*ticket-home[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)||[])[1]||"");
  const away=textOf((body.match(/<span[^>]*class=["'][^"']*ticket-away[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)||[])[1]||"");
  const time=(body.match(/<time[^>]*datetime=["']([^"']+)/i)||[])[1]||null;if(!id||!home||!away)continue;
  const gs=html.lastIndexOf('<details class="league-group',m.index),se=gs>=0?html.indexOf("</summary>",gs):-1,summary=gs>=0&&se>gs?html.slice(gs,se):"";
  const league=textOf((summary.match(/href=["']\/league\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)||[])[1]||"");
  const cs=html.lastIndexOf('<h2 class="section-title',m.index),ce=cs>=0?html.indexOf("</h2>",cs):-1;
  const country=cs>=0&&ce>cs?textOf(html.slice(cs,ce)).replace(/\s+\d+$/,"").trim():null;
  if(!isEuropeanFixture(country,league,home,away)||!isTopTwoTierLeague(league))continue;\n    if (isExcludedSeniorTeam(home) || isExcludedSeniorTeam(away)) continue;
  const cls=(attrs.match(/class=["']([^"']+)/i)||[])[1]||"",status=cls.includes("ticket-live")?"live":cls.includes("ticket-ft")?"finished":cls.includes("ticket-pst")?"postponed":cls.includes("ticket-canc")?"cancelled":"scheduled";
  const hs=(body.match(/class=["'][^"']*ticket-hs[^"']*["'][^>]*>([0-9]+)</i)||[])[1],as=(body.match(/class=["'][^"']*ticket-as[^"']*["'][^>]*>([0-9]+)</i)||[])[1];
  const gender=/\bW\b|Women|female|girls/i.test(home+" "+away+" "+league)?"women":"men";
  fixtures.push({external_id:id,source:"FootyNomad",date,competition:league||null,country,gender,home_team:home,away_team:away,kickoff_at:time?new Date(time).toISOString():null,status,home_score:hs==null?null:Number(hs),away_score:as==null?null:Number(as)});
 }
 const total=fixtures.length;
 return {date,total_found:total,fixtures_count:fixtures.length,fixtures};
}
async function db(path:string,token:string,method="GET",body?:unknown,prefer="return=representation"){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{method,headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 const txt=await r.text();let data:any;try{data=txt?JSON.parse(txt):null}catch{data=txt}
 if(!r.ok)throw new Error((data?.message||data?.hint||data?.details||txt||"Supabase request failed")+" ["+r.status+"]");
 return data;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  let date=new URL(req.url).searchParams.get("date")||new Date().toISOString().slice(0,10);
  let skipResultSync=false;
  if(req.method==="POST"){const b=await req.json();date=b.date||date;skipResultSync=b.skip_result_sync===true;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Nieprawidłowa data skanu.");
  const result=await readFixtures(date);
  if(req.method==="GET")return new Response(JSON.stringify(result),{headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
  // Enrich the primary FootyNomad fixture list with independent public no-key sources.
  // A public-source outage must never block the primary scan.
  let publicSourceStatus:any={ok:false,error:"not_called"};
  let publicFixtures:any[]=[];
  try{
   const pr=await fetch("https://gzgeklcukrclgwbsmbsp.supabase.co/functions/v1/moneyball-public-sources?date="+date,{headers:{"Accept":"application/json","apikey":KEY,"Authorization":req.headers.get("Authorization")||""},signal:AbortSignal.timeout(18000)});
   const pt=await pr.text();
   if(!pr.ok)throw new Error("Public sources HTTP "+pr.status+": "+pt.slice(0,300));
   const pj=JSON.parse(pt);publicFixtures=Array.isArray(pj.fixtures)?pj.fixtures.filter((f:any)=>isEuropeanFixture(f.country,f.league||f.competition,f.home_team||f.home,f.away_team||f.away)&&isTopTwoTierLeague(f.league||f.competition)):[];
   publicSourceStatus={ok:true,source_count:pj.source_count,raw_fixtures:pj.raw_fixtures,unique_fixtures:pj.unique_fixtures,sources:pj.sources};
  }catch(e){publicSourceStatus={ok:false,error:String(e)};}
  const normTeam=(v:any)=>{const key=String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();return ({"turkiye":"turkey"} as Record<string,string>)[key]||key;};
  const localDay=(v:any)=>{const raw=String(v||"");if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const d=new Date(raw);return Number.isNaN(d.getTime())?raw.slice(0,10):new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);};
  const fixtureDate=(f:any)=>{const explicit=String(f.date||"").slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(explicit))return explicit;const fromTime=localDay(f.kickoff_at);if(fromTime)return fromTime;return /:([0-9]{4}-[0-9]{2}-[0-9]{2}):/.exec(String(f.external_id||""))?.[1]||"";};
  const fixtureBaseKey=(f:any)=>normTeam(f.home_team)+"|"+normTeam(f.away_team)+"|"+fixtureDate(f)+"|"+String(f.competition||"").trim().toLowerCase();
  const fixtureGender=(f:any)=>["men","women"].includes(String(f.gender||"").toLowerCase())?String(f.gender).toLowerCase():"unknown";
  const fixtureKey=(f:any)=>fixtureBaseKey(f)+"|"+fixtureGender(f);
  const genderCompatible=(a:any,b:any)=>fixtureGender(a)===fixtureGender(b)||fixtureGender(a)==="unknown"||fixtureGender(b)==="unknown";
  const fixturePriority=(f:any)=>(String(f.source||"").toLowerCase()==="footynomad"?100:0)+(fixtureGender(f)!=="unknown"?10:0)+(f.kickoff_at?1:0);
  const primaryByKey=new Map(result.fixtures.map((f:any)=>[fixtureKey(f),f]));
  const primaryByBase=new Map<string,any[]>();
  for(const f of result.fixtures){const k=fixtureBaseKey(f),arr=primaryByBase.get(k)||[];arr.push(f);primaryByBase.set(k,arr);}
  const combined:any[]=[...result.fixtures];
  let enriched=0,publicOnly=0;
  for(const pf of publicFixtures){
   const key=fixtureKey(pf),primary=primaryByKey.get(key)||(primaryByBase.get(fixtureBaseKey(pf))||[]).find((f:any)=>genderCompatible(f,pf));
   if(primary){
    (primary as any).public_data={...(primary as any).public_data||{},sources:[...new Set([...(primary as any).public_data?.sources||[],pf.source])],home_form:pf.home_form??(primary as any).public_data?.home_form,away_form:pf.away_form??(primary as any).public_data?.away_form};
    enriched++;
   }else{
    combined.push(pf);publicOnly++;
   }
  }
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)throw new Error("Brak sesji logowania. Zaloguj się ponownie.");
  const jwtParts=token.split(".");
  const jwtPayload=jwtParts.length>1?JSON.parse(atob(jwtParts[1].replace(/-/g,"+").replace(/_/g,"/"))):{};
  const ownerId=String(jwtPayload.sub||"");
  if(!ownerId)throw new Error("Nie można odczytać właściciela sesji.");
  const runRows=await db("scan_runs",token,"POST",{owner_id:ownerId,scan_date:date,source:"FootyNomad + public sources",status:"started",matches_found:combined.length,notes:"FootyNomad primary; public source enrichment: "+JSON.stringify(publicSourceStatus).slice(0,1500)});
  const run=runRows?.[0];if(!run?.id)throw new Error("Nie udało się utworzyć wpisu skanu.");
  let inserted=0,updated=0,settled=0,matchedByFixture=0,promotedToPrimary=0;
  try{
   const dayStart=new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString(),nextDate=new Date(Date.parse(date+"T00:00:00Z")+2*86400000).toISOString();
   const existingRows=await db("matches?select=id,owner_id,external_id,source,competition,country,gender,home_team,away_team,kickoff_at,status&owner_id=eq."+encodeURIComponent(ownerId),token);
   const existingBySourceId=new Map((existingRows||[]).map((x:any)=>[String(x.source)+"|"+String(x.external_id),x]));
   const existingByFixture=new Map<string,any[]>();
   for(const x of existingRows||[]){const k=fixtureBaseKey(x),arr=existingByFixture.get(k)||[];arr.push(x);existingByFixture.set(k,arr);}
   const toInsert:any[]=[];
   const toUpdate:any[]=[];
   const publicDataByKey=new Map<string,any>();
   const seenSourceIds=new Set<string>();
   for(const f of combined){
    const source=String(f.source||"FootyNomad"),sourceId=String(f.external_id||"");
    if(!sourceId)continue;
    const key=source+"|"+sourceId;
    if(seenSourceIds.has(key))continue;
    seenSourceIds.add(key);
    const fixtureCandidates=(existingByFixture.get(fixtureBaseKey(f))||[]).filter((x:any)=>genderCompatible(x,f)).sort((a:any,b:any)=>fixturePriority(b)-fixturePriority(a));
    const byFixture=fixtureCandidates[0],exact=existingBySourceId.get(key),existing=exact||byFixture;
    if(!exact&&byFixture)matchedByFixture++;
    const noteData={integration:"MONEYBALL_PUBLIC_AGGREGATOR",sources:(f as any).public_data?.sources||[source],home_form:(f as any).home_form||(f as any).public_data?.home_form||null,away_form:(f as any).away_form||(f as any).public_data?.away_form||null,public_data:(f as any).public_data||null};
    publicDataByKey.set(key,noteData);
    const row={owner_id:ownerId,scan_run_id:run.id,external_id:sourceId,source,competition:f.competition||f.league||null,country:f.country||null,gender:f.gender||"unknown",home_team:f.home_team,away_team:f.away_team,kickoff_at:f.kickoff_at||null,status:f.status||"scheduled"};
    if(existing){
     if(source==="FootyNomad"||String(existing.source)===source){toUpdate.push({...row,id:existing.id});if(source==="FootyNomad"&&String(existing.source)!=="FootyNomad")promotedToPrimary++;updated++;}
     continue;
    }
    toInsert.push(row);
   }
   for(let i=0;i<toUpdate.length;i+=100)await db("matches?on_conflict=id",token,"POST",toUpdate.slice(i,i+100),"resolution=merge-duplicates,return=minimal");
   for(let i=0;i<toInsert.length;i+=100){const batch=toInsert.slice(i,i+100);await db("matches?on_conflict=owner_id,source,external_id",token,"POST",batch,"resolution=ignore-duplicates,return=minimal");inserted+=batch.length;}
   const allIds=combined.map((f:any)=>String(f.external_id||"")).filter(Boolean);
   const latestRows=allIds.length?await db("matches?select=id,owner_id,external_id,source,competition,home_team,away_team,kickoff_at,gender&owner_id=eq."+encodeURIComponent(ownerId)+"&kickoff_at=gte."+encodeURIComponent(dayStart)+"&kickoff_at=lt."+encodeURIComponent(nextDate),token):[];
   const matchBySourceId=new Map<string,any>((latestRows||[]).map((row:any)=>[String(row.source)+"|"+String(row.external_id),row]));
   const cacheRows:any[]=[];
   for(const f of combined){
    const source=String(f.source||"FootyNomad"),sourceId=String(f.external_id||""),match=matchBySourceId.get(source+"|"+sourceId),data=publicDataByKey.get(source+"|"+sourceId);
    if(!match||!data)continue;
    const homeForm=data.home_form,awayForm=data.away_form;
    const validForm=(v:any)=>v&&Number.isFinite(Number(v.w))&&Number.isFinite(Number(v.d))&&Number.isFinite(Number(v.l))&&Number(v.w)+Number(v.d)+Number(v.l)===5;
    const capturedAt=new Date().toISOString(),provider_data:any={footynomad_sync:data};
    const cacheSource=validForm(homeForm)&&validForm(awayForm)?"FootyNomad":"MONEYBALL_PUBLIC_AGGREGATOR";
    if(cacheSource==="FootyNomad")provider_data.footy_nomad_form={home_name:f.home_team,away_name:f.away_team,home:homeForm,away:awayForm,fetched_at:capturedAt};
    cacheRows.push({owner_id:ownerId,match_id:match.id,source:cacheSource,provider_data,captured_at:capturedAt});
   }
   for(let i=0;i<cacheRows.length;i+=100)await db("match_market_data?on_conflict=owner_id,match_id,source",token,"POST",cacheRows.slice(i,i+100),"resolution=merge-duplicates,return=minimal").catch((e:any)=>console.error("Public data cache batch write failed:",String(e)));
   const matchByFixture=new Map<string,any[]>();
   for(const x of latestRows||[]){const k=fixtureBaseKey(x),arr=matchByFixture.get(k)||[];arr.push(x);matchByFixture.set(k,arr);}
   await runLimited(combined,8,async(f:any)=>{
    const candidates=(matchByFixture.get(fixtureBaseKey(f))||[]).filter((x:any)=>genderCompatible(x,f)).sort((a:any,b:any)=>fixturePriority(b)-fixturePriority(a));
    const row=candidates[0] as any;
    if(!row)return;
    if(!skipResultSync&&f.status==="finished"&&Number.isInteger(f.home_score)&&Number.isInteger(f.away_score)){
     const outcome=f.home_score>f.away_score?"1":f.home_score<f.away_score?"2":"X";
     const oldResults=await db("match_results?select=id&owner_id=eq."+encodeURIComponent(ownerId)+"&match_id=eq."+row.id,token);
     const finishedAt=new Date().toISOString();
     const rb={owner_id:ownerId,home_score:f.home_score,away_score:f.away_score,outcome_1x2:outcome,verified:true,source:f.source||"FootyNomad",finished_at:finishedAt,verified_at:finishedAt};
     if(oldResults?.length)await db("match_results?id=eq."+oldResults[0].id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",rb);else await db("match_results",token,"POST",{match_id:row.id,...rb});
     const ps=await db("predictions?select=id,market,selection&owner_id=eq."+encodeURIComponent(ownerId)+"&match_id=eq."+row.id,token);
     for(const p of ps||[]){const won=p.market==="1X2"?p.selection===outcome:(p.selection==="1X"?outcome!=="2":p.selection==="X2"?outcome!=="1":outcome!=="X");await db("predictions?id=eq."+p.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{settlement_status:won?"won":"lost",verified:true});settled++;}
    }
   });
   await db("scan_runs?id=eq."+run.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{status:"completed",completed_at:new Date().toISOString(),matches_found:combined.length,notes:"FootyNomad "+result.fixtures.length+"; public fixtures "+publicFixtures.length+"; enriched "+enriched+"; public-only "+publicOnly+"; inserted "+inserted+"; updated "+updated+"; settled "+settled+"; matched by fixture "+matchedByFixture+"; promoted "+promotedToPrimary+"; public source status "+JSON.stringify(publicSourceStatus).slice(0,900)});
  }catch(e){await db("scan_runs?id=eq."+run.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{status:"partial",completed_at:new Date().toISOString(),notes:"Import częściowy: "+String(e)});throw e;}
  // Run the same verified result settlement pipeline used by the scheduled synchronizer.
  // This ensures match results, predictions, coupon legs and coupon statuses stay consistent
  // after a manual fixture scan, including finished matches returned by the fixture source.
  let resultSync:any={ok:false,skipped:skipResultSync};
  if(!skipResultSync)try{
   const syncResponse=await fetch(SUPABASE_URL+"/functions/v1/moneyball-results-sync?date="+encodeURIComponent(date),{
    method:"POST",
    headers:{apikey:KEY,Authorization:"Bearer "+token,"Content-Type":"application/json",Accept:"application/json"},
    body:"{}",
   });
   const syncText=await syncResponse.text();
   try{resultSync=syncText?JSON.parse(syncText):{ok:false,error:"Empty result-sync response"};}catch(_){resultSync={ok:false,error:syncText.slice(0,500)};}
   if(!syncResponse.ok)resultSync={...resultSync,ok:false,http_status:syncResponse.status};
  }catch(e){resultSync={ok:false,error:String(e)};}
  return new Response(JSON.stringify({ok:true,date,total_found:result.total_found,fixtures_count:result.fixtures.length,combined_count:combined.length,public_fixtures:publicFixtures.length,enriched,public_only:publicOnly,public_source_status:publicSourceStatus,inserted,updated,settled,matched_by_fixture:matchedByFixture,promoted_to_primary:promotedToPrimary,scan_run_id:run.id,result_sync:resultSync}),{headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
 }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}});}
});