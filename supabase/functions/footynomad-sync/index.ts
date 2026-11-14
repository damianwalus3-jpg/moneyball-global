import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"https://xwrgfaarmwnguymresjy.supabase.co";
const KEY=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"sb_publishable_E27tyjResjElwC4AWbmILw_wbtibXhX";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
let ACTIVE_CRON_TOKEN="";
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
  if(!isEuropeanFixture(country,league,home,away))continue;
  const cls=(attrs.match(/class=["']([^"']+)/i)||[])[1]||"",status=cls.includes("ticket-live")?"live":cls.includes("ticket-ft")?"finished":cls.includes("ticket-pst")?"postponed":cls.includes("ticket-canc")?"cancelled":"scheduled";
  const bodyText=textOf(body),homeAt=bodyText.toLowerCase().indexOf(home.toLowerCase()),awayAt=bodyText.toLowerCase().lastIndexOf(away.toLowerCase()),scoreBetween=homeAt>=0&&awayAt>homeAt?bodyText.slice(homeAt+home.length,awayAt):"",scoreParts=scoreBetween.match(/[0-9]+/g)||[];
  const hs=(body.match(/class=["'][^"']*ticket-hs[^"']*["'][^>]*>([0-9]+)</i)||[])[1]||scoreParts[0],as=(body.match(/class=["'][^"']*ticket-as[^"']*["'][^>]*>([0-9]+)</i)||[])[1]||scoreParts[1],liveMinute=(bodyText.match(/([0-9]{1,3}(?:\+[0-9]{1,2})?)\s*['’]\s*live/i)||[])[1]||null;
  const gender=/\bW\b|Women|female|girls/i.test(home+" "+away+" "+league)?"women":"men";
  fixtures.push({external_id:id,source:"FootyNomad",date,competition:league||null,country,gender,home_team:home,away_team:away,kickoff_at:time?new Date(time).toISOString():null,status,home_score:hs==null?null:Number(hs),away_score:as==null?null:Number(as),live_minute:status==="live"?liveMinute:null});
 }
 const total=fixtures.length;
 return {date,total_found:total,fixtures_count:fixtures.length,fixtures};
}
async function db(path:string,token:string,method="GET",body?:unknown,prefer="return=representation"){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{method,headers:{apikey:KEY,Authorization:"Bearer "+token,...(ACTIVE_CRON_TOKEN?{"x-cron-token":ACTIVE_CRON_TOKEN}:{}),"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 const txt=await r.text();let data:any;try{data=txt?JSON.parse(txt):null}catch{data=txt}
 if(!r.ok)throw new Error((data?.message||data?.hint||data?.details||txt||"Supabase request failed")+" ["+r.status+"]");
 return data;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  let date=new URL(req.url).searchParams.get("date")||new Date().toISOString().slice(0,10);
  let requestBody:any={};
  if(req.method==="POST"){requestBody=await req.json();date=requestBody.date||date;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Nieprawidłowa data skanu.");
  const result=await readFixtures(date);
  if(req.method==="GET")return new Response(JSON.stringify(result),{headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
  // Enrich the primary FootyNomad fixture list with independent public no-key sources.
  // A public-source outage must never block the primary scan.
  let publicSourceStatus:any={ok:false,error:"not_called"};
  let publicFixtures:any[]=[];
  try{
   const pr=await fetch(SUPABASE_URL+"/functions/v1/moneyball-public-sources?date="+date,{headers:{"Accept":"application/json"}});
   const pt=await pr.text();
   if(!pr.ok)throw new Error("Public sources HTTP "+pr.status+": "+pt.slice(0,300));
   const pj=JSON.parse(pt);publicFixtures=Array.isArray(pj.fixtures)?pj.fixtures.filter((f:any)=>isEuropeanFixture(f.country,f.league||f.competition,f.home_team||f.home,f.away_team||f.away)):[];
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
  let token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";
  const cronToken=req.headers.get("x-cron-token")||"";
  let ownerId="";
  if(cronToken){
   const authResponse=await fetch(SUPABASE_URL+"/rest/v1/rpc/moneyball_cron_token_valid",{
    method:"POST",
    headers:{apikey:SERVICE_KEY||KEY,Authorization:"Bearer "+(SERVICE_KEY||token||KEY),"Content-Type":"application/json"},
    body:JSON.stringify({p_token:cronToken})
   });
   if(!authResponse.ok||(await authResponse.json())!==true)throw new Error("Nieprawidłowy token harmonogramu.");
   ownerId=String(requestBody.owner_id||"");
   if(!ownerId)throw new Error("Brak właściciela dla automatycznego skanu.");
   ACTIVE_CRON_TOKEN=cronToken;
  }else{
   if(!token)throw new Error("Brak sesji logowania. Zaloguj się ponownie.");
   const jwtParts=token.split(".");
   const jwtPayload=jwtParts.length>1?JSON.parse(atob(jwtParts[1].replace(/-/g,"+").replace(/_/g,"/"))):{};
   ownerId=String(jwtPayload.sub||"");
   if(!ownerId)throw new Error("Nie można odczytać właściciela sesji.");
  }
  const runRows=await db("scan_runs",token,"POST",{owner_id:ownerId,scan_date:date,source:"FootyNomad + public sources",status:"started",matches_found:combined.length,notes:"FootyNomad primary; public source enrichment: "+JSON.stringify(publicSourceStatus).slice(0,1500)});
  const run=runRows?.[0];if(!run?.id)throw new Error("Nie udało się utworzyć wpisu skanu.");
  let inserted=0,updated=0,settled=0,matchedByFixture=0,promotedToPrimary=0;
  try{
   const dayStart=new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString(),nextDate=new Date(Date.parse(date+"T00:00:00Z")+2*86400000).toISOString();
   const existingRows=await db("matches?select=id,owner_id,external_id,source,competition,country,gender,home_team,away_team,kickoff_at,kickoff_date,status,live_home_score,live_away_score,live_minute&owner_id=eq."+encodeURIComponent(ownerId),token);
   const existingBySourceId=new Map((existingRows||[]).map((x:any)=>[String(x.source)+"|"+String(x.external_id),x]));
   const existingByFixture=new Map<string,any[]>();
   for(const x of existingRows||[]){const k=fixtureBaseKey(x),arr=existingByFixture.get(k)||[];arr.push(x);existingByFixture.set(k,arr);}
   const toInsert:any[]=[];
   const publicDataByKey=new Map<string,any>();
   const seenSourceIds=new Set<string>();
   for(const f of combined){
    const source=String(f.source||"FootyNomad"),sourceId=String(f.external_id||"");
    if(!sourceId)continue;
    const key=source+"|"+sourceId;
    if(seenSourceIds.has(key))continue;
    seenSourceIds.add(key);
    const fixtureCandidates=(existingByFixture.get(fixtureBaseKey(f))||[]).filter((x:any)=>genderCompatible(x,f)).sort((a:any,b:any)=>fixturePriority(b)-fixturePriority(a));
    const byFixture=fixtureCandidates[0];
    const exact=existingBySourceId.get(key);
    const existing=exact||byFixture;
    if(!exact&&byFixture)matchedByFixture++;
    const noteData={integration:"MONEYBALL_PUBLIC_AGGREGATOR",sources:(f as any).public_data?.sources||[source],home_form:(f as any).home_form||(f as any).public_data?.home_form||null,away_form:(f as any).away_form||(f as any).public_data?.away_form||null,public_data:(f as any).public_data||null};
    publicDataByKey.set(key,noteData);
    const row={owner_id:ownerId,scan_run_id:run.id,external_id:sourceId,source,competition:f.competition||f.league||null,country:f.country||null,gender:f.gender||"unknown",home_team:f.home_team,away_team:f.away_team,kickoff_at:f.kickoff_at||null,kickoff_date:String(f.date||date).slice(0,10),status:f.status||"scheduled",live_home_score:f.status==="live"&&Number.isInteger(f.home_score)?f.home_score:null,live_away_score:f.status==="live"&&Number.isInteger(f.away_score)?f.away_score:null,live_minute:f.status==="live"?f.live_minute||null:null,live_updated_at:f.status==="live"?new Date().toISOString():null};
    if(existing){
     if(source==="FootyNomad"||String(existing.source)===source){
      const patch:any={scan_run_id:run.id,kickoff_at:row.kickoff_at,kickoff_date:row.kickoff_date,status:row.status,live_home_score:row.live_home_score,live_away_score:row.live_away_score,live_minute:row.live_minute,live_updated_at:row.live_updated_at,competition:row.competition,country:row.country,gender:row.gender,home_team:row.home_team,away_team:row.away_team};
      const promote=source==="FootyNomad"&&String(existing.source)!=="FootyNomad";
      if(promote){patch.source=source;patch.external_id=sourceId;}
      const same=(a:any,b:any)=>(a??null)===(b??null);
      const changed=promote||
       !same(existing.kickoff_at,row.kickoff_at)||
       !same(existing.kickoff_date,row.kickoff_date)||
       !same(existing.status,row.status)||
       !same(existing.live_home_score,row.live_home_score)||
       !same(existing.live_away_score,row.live_away_score)||
       !same(existing.live_minute,row.live_minute)||
       !same(existing.competition,row.competition)||
       !same(existing.country,row.country)||
       !same(existing.gender,row.gender)||
       !same(existing.home_team,row.home_team)||
       !same(existing.away_team,row.away_team);
      // Avoid a REST PATCH on every hourly scan when a fixture has not changed.
      if(changed){
       await db("matches?id=eq."+existing.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",patch);
       updated++;
       if(promote)promotedToPrimary++;
      }
     }
     continue;
    }
    toInsert.push(row);
   }
   for(let i=0;i<toInsert.length;i+=100){
    const batch=toInsert.slice(i,i+100);
    const insertedRows=await db("matches?on_conflict=owner_id,source,external_id",token,"POST",batch,"resolution=ignore-duplicates,return=representation");
    inserted+=Array.isArray(insertedRows)?insertedRows.length:0;
   }
   // Refresh IDs for newly inserted fixtures before settling completed results.
   const allIds=combined.map((f:any)=>String(f.external_id||"")).filter(Boolean);
   const allSources=[...new Set(combined.map((f:any)=>String(f.source||"FootyNomad")))];
   const latestRows=allIds.length?await db("matches?select=id,owner_id,external_id,source,competition,home_team,away_team,kickoff_at,gender&owner_id=eq."+encodeURIComponent(ownerId)+"&kickoff_at=gte."+encodeURIComponent(dayStart)+"&kickoff_at=lt."+encodeURIComponent(nextDate),token):[];
   const matchBySourceId=new Map((latestRows||[]).map((row:any)=>[String(row.source)+"|"+String(row.external_id),row]));
   const cacheRows:any[]=[];
   for(const f of combined){
    const source=String(f.source||"FootyNomad"),sourceId=String(f.external_id||""),match=matchBySourceId.get(source+"|"+sourceId);
    const data=publicDataByKey.get(source+"|"+sourceId);
    if(!match||!data)continue;
    const homeForm=data.home_form,awayForm=data.away_form;
    const validForm=(v:any)=>v&&Number.isFinite(Number(v.w))&&Number.isFinite(Number(v.d))&&Number.isFinite(Number(v.l))&&Number(v.w)+Number(v.d)+Number(v.l)===5;
    const capturedAt=new Date().toISOString();
    const provider_data:any={footynomad_sync:data};
    const cacheSource=validForm(homeForm)&&validForm(awayForm)?"FootyNomad":"MONEYBALL_PUBLIC_AGGREGATOR";
    if(cacheSource==="FootyNomad")provider_data.footy_nomad_form={home_name:f.home_team,away_name:f.away_team,home:homeForm,away:awayForm,fetched_at:capturedAt};
    cacheRows.push({owner_id:ownerId,match_id:match.id,source:cacheSource,provider_data,captured_at:capturedAt});
   }
   // Batch public-data cache writes instead of issuing one REST request per fixture.
   for(let i=0;i<cacheRows.length;i+=100){
    await db("match_market_data?on_conflict=owner_id,match_id,source",token,"POST",cacheRows.slice(i,i+100),"resolution=merge-duplicates,return=minimal")
     .catch((e:any)=>console.error("Public data cache batch failed:",String(e)));
   }
   // Verified score settlement is handled by the dedicated five-minute results sync.
   // This avoids repeating per-match result and prediction updates during fixture import.
   settled=0;
   await db("scan_runs?id=eq."+run.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{status:"completed",completed_at:new Date().toISOString(),matches_found:combined.length,notes:"FootyNomad "+result.fixtures.length+"; public fixtures "+publicFixtures.length+"; enriched "+enriched+"; public-only "+publicOnly+"; inserted "+inserted+"; updated "+updated+"; settled "+settled+"; matched by fixture "+matchedByFixture+"; promoted "+promotedToPrimary+"; public source status "+JSON.stringify(publicSourceStatus).slice(0,900)});
  }catch(e){await db("scan_runs?id=eq."+run.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{status:"partial",completed_at:new Date().toISOString(),notes:"Import częściowy: "+String(e)});throw e;}
  // Bookmaker odds are fetched separately by moneyball-movi-odds-sync and used only for payout calculations.
  // This removes the optional StrikerAPI dependency; no API key or secret is required.
  const oddsSync:any={ok:true,source:"TipsAudit",mode:"direct_public_feed",api_key_required:false,note:"Prognozy są liczone niezależnie; rzeczywiste kursy są pobierane osobnym synchronizatorem."};
  // Scheduled scans own the full server-side pipeline. Manual scans are
  // orchestrated by the browser, which already pages through moneyball-predict.
  // Running both here and in the browser doubled work and caused long scans.
   // Fixture import only. Predictions are owned by moneyball-auto-scan (every 2 minutes),
   // and settlement by moneyball-results-sync (every 5 minutes). This avoids a second
   // full prediction pass when the hourly fixture refresh runs.
   const predictionSync:any={ok:true,skipped:true,mode:cronToken?"dedicated_moneyball_auto_scan":"client_orchestrated"};
   const resultSync:any={ok:true,skipped:true,mode:"dedicated_five_minute_results_cron"};
const pipelineOk=predictionSync.ok&&resultSync.ok!==false;
  await db("scan_runs?id=eq."+run.id+"&owner_id=eq."+encodeURIComponent(ownerId),token,"PATCH",{
   status:pipelineOk?"completed":"partial",
   completed_at:new Date().toISOString(),
   notes:"FootyNomad "+result.fixtures.length+"; inserted "+inserted+"; updated "+updated+"; predictions "+JSON.stringify({ok:predictionSync.ok,batches:predictionSync.batches,total:predictionSync.total_predictions,selected:predictionSync.selected,error:predictionSync.error||null}).slice(0,900)+"; results "+JSON.stringify({ok:resultSync.ok,results_saved:resultSync.results_saved,predictions_settled:resultSync.predictions_settled,coupon_legs_settled:resultSync.coupon_legs_settled,error:resultSync.error||null}).slice(0,900)
  }).catch((e:any)=>console.error("Final scan status update failed:",String(e)));
  return new Response(JSON.stringify({ok:pipelineOk,date,odds_sync:oddsSync,total_found:result.total_found,fixtures_count:result.fixtures.length,combined_count:combined.length,public_fixtures:publicFixtures.length,enriched,public_only:publicOnly,public_source_status:publicSourceStatus,inserted,updated,settled,matched_by_fixture:matchedByFixture,promoted_to_primary:promotedToPrimary,scan_run_id:run.id,prediction_sync:predictionSync,result_sync:resultSync}),{status:pipelineOk?200:502,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
 }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}});}
});