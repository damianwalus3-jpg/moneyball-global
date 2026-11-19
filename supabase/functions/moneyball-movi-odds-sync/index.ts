import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isEligibleDomesticSeniorLeague } from "../_shared/domestic-league-scope.ts";
import { isExcludedSeniorTeam, isWomensTeam } from "../_shared/team-normalization.ts";
import { shouldSkipMoviOddsSync } from "../_shared/movi-odds-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MOVI_KEY = Deno.env.get("MOVIODDS_API_KEY") || "";
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY") || "";
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const BASE = "https://moviodds.com";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-cron-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}});
const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim();
async function db(path:string,method="GET",body?:unknown,prefer="return=representation"){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{method,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 const t=await r.text();let j:any;try{j=t?JSON.parse(t):null}catch{j=t}if(!r.ok)throw new Error("Supabase "+r.status+": "+String(j?.message||j).slice(0,500));return j;
}
async function authorized(token:string){
 if(!token)return false;
 const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/moneyball_cron_token_valid",{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_token:token})});
 return r.ok&&(await r.json())===true;
}
async function apiFootball(path:string){
 if(!API_FOOTBALL_KEY)throw new Error("API_FOOTBALL_KEY is not configured.");
 const r=await fetch(API_FOOTBALL_BASE+path,{headers:{"x-apisports-key":API_FOOTBALL_KEY},signal:AbortSignal.timeout(25000)});
 const payload=await r.json().catch(()=>({}));
 if(!r.ok||payload?.errors&&Object.keys(payload.errors).length)throw new Error("API-Football HTTP "+r.status+": "+JSON.stringify(payload?.errors||{}).slice(0,400));
 return payload;
}
async function movi(path:string){
 const headers:Record<string,string>={"Accept":"application/json","Accept-Encoding":"gzip"};
 if(shouldSkipMoviOddsSync(MOVI_KEY))throw new Error("MOVIODDS_API_KEY is not configured; provider requests are disabled.");
 if(MOVI_KEY)headers["X-API-Key"]=MOVI_KEY;
 const r=await fetch(BASE+path,{headers,signal:AbortSignal.timeout(45000)});
 const raw=await r.text();
 if(!r.ok)throw new Error("MoviOdds HTTP "+r.status+": "+raw.slice(0,200));
 return JSON.parse(raw);
}
function selectionFor(q:any,home:string,away:string):{market:string;selection:string}|null{
 const group=String(q.group_name||"").toLowerCase(),label=String(q.label||"").trim(),side=String(q.side||"").toLowerCase(),line=String(q.line||"").trim();
 if(group==="full time result"||group==="match result"){
  const l=norm(label),h=norm(home),a=norm(away);
  const s=(l==="home"||l===h)?"1":(l==="draw"||l==="the draw"||l==="x")?"X":(l==="away"||l===a)?"2":null;
  return s?{market:"1X2",selection:s}:null;
 }
 if(group==="double chance"){
  const l=norm(label),compact=l.replace(/\s/g,"");
  let s=["1x","x2","12"].includes(compact)?compact.toUpperCase():null;
  const h=norm(home),a=norm(away),hasHome=!!h&&l.includes(h),hasAway=!!a&&l.includes(a),hasDraw=l.includes("draw");
  if(!s&&hasDraw&&hasHome)s="1X";
  else if(!s&&hasDraw&&hasAway)s="X2";
  else if(!s&&hasHome&&hasAway)s="12";
  return s?{market:"DOUBLE_CHANCE",selection:s}:null;
 }
 if(group==="both teams to score"){
  const l=norm(label);
  return (l==="yes"||l==="no")?{market:"GOALS",selection:"BTTS_"+l.toUpperCase()}:null;
 }
 if(/goal(s)? over\/under|goal line|alternative total goals|match goals/.test(group)){
  const n=Number(line.replace(",","."));
  const isOver=side==="over"||side==="o"||norm(label).startsWith("over");
  const isUnder=side==="under"||side==="u"||norm(label).startsWith("under");
  if(Number.isFinite(n)&&(isOver||isUnder))return {market:"GOALS",selection:(isOver?"OVER_":"UNDER_")+String(n)};
 }
 return null;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method==="GET")return json({ok:true,service:"Moneyball odds sync",primary_provider:"MoviOdds / bet365",movi_key_configured:!!MOVI_KEY,api_football_key_configured:!!API_FOOTBALL_KEY,mode:"provider fallback diagnostics enabled",note:"No odds are fabricated; missing provider quotes remain missing."});
 if(req.method!=="POST")return json({error:"POST required"},405);
 try{
  if(!(await authorized(req.headers.get("x-cron-token")||"")))return json({error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({}));
  if(shouldSkipMoviOddsSync(MOVI_KEY)&&API_FOOTBALL_KEY&&body.mode==="diagnostic"){
   const day=String(body.date||new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
   const [status,bookmakers,odds]=await Promise.all([
    apiFootball("/status"),
    apiFootball("/odds/bookmakers?search=Bwin"),
    apiFootball("/odds?date="+encodeURIComponent(day)+"&timezone=Europe/Brussels&page=1")
   ]);
   const bookmakerNames=(bookmakers.response||[]).map((x:any)=>({id:x.id,name:x.name}));
   const fixtureSamples=(odds.response||[]).slice(0,10).map((x:any)=>({fixture_id:x.fixture?.id,date:x.fixture?.date,home:x.teams?.home?.name,away:x.teams?.away?.name,bookmakers:(x.bookmakers||[]).map((b:any)=>b.name),markets:(x.bookmakers||[]).flatMap((b:any)=>(b.bets||[]).map((m:any)=>m.name)).slice(0,12)}));
   return json({ok:true,mode:"diagnostic",provider:"API-Football",date:day,key_configured:true,account:status.response?.account?{plan:status.response.account.subscription?.plan,subscription_active:status.response.account.subscription?.active,requests_remaining:status.response.requests?.limit_day!=null?Number(status.response.requests.limit_day)-Number(status.response.requests.current||0):null,requests_today:status.response.requests?.current,requests_limit:status.response.requests?.limit_day}:null,bwin_bookmakers:bookmakerNames,odds_results:odds.results||0,odds_pagination:odds.paging||null,fixtures:fixtureSamples});
  }
  if(shouldSkipMoviOddsSync(MOVI_KEY))return json({ok:true,skipped:true,reason:API_FOOTBALL_KEY?"MOVIODDS_API_KEY is not configured; API-Football fallback is available but requires a diagnostic/sync request.":"Neither MOVIODDS_API_KEY nor API_FOOTBALL_KEY is configured.",provider:"MoviOdds",api_football_key_configured:!!API_FOOTBALL_KEY,provider_requests:0,key_configured:false},200);
  const now=new Date(),day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const owner=String(body.owner_id||"");
  const ownerFilter=owner?"&owner_id=eq."+encodeURIComponent(owner):"";
  const rawMatches=await db("matches?select=id,owner_id,user_id,home_team,away_team,competition,league,country,gender,kickoff_at,kickoff_date,status&kickoff_date=eq."+encodeURIComponent(day)+"&order=kickoff_at.asc"+ownerFilter);
   const matches=(rawMatches||[]).filter((match:any)=>{
   const gender=String(match.gender??"").toLowerCase();
   return isEligibleDomesticSeniorLeague(match.country,match.competition||match.league)
    && (!gender||gender==="men")
    && !isWomensTeam(match.home_team)&&!isWomensTeam(match.away_team)
    && !isExcludedSeniorTeam(match.home_team)&&!isExcludedSeniorTeam(match.away_team);
  });
  const catalog=await movi("/catalog?sport=soccer");
  const fixtures=Array.isArray(catalog.fixtures)?catalog.fixtures:[];
  const pairs:any[]=[];
  const used=new Set<string>();
  for(const m of matches||[]){
   const h=norm(m.home_team),a=norm(m.away_team),kt=Date.parse(m.kickoff_at||"");
   if(!h||!a||!Number.isFinite(kt))continue;
   let best:any=null,bestScore=Infinity;
   for(const f of fixtures){
    if(used.has(String(f.id)))continue;
    if(norm(f.home)!==h||norm(f.away)!==a)continue;
    const ft=Date.parse(f.kickoff_utc||"");
    const delta=Math.abs(ft-kt);
    if(!Number.isFinite(ft)||delta>6*3600000)continue;
    const score=delta+(norm(m.competition||m.league)===norm(f.league)?0:300000);
    if(score<bestScore){best=f;bestScore=score;}
   }
   if(best){used.add(String(best.id));pairs.push({match:m,fixture:best});}
  }
  const processed:any[]=[];
  let errors=0;
  for(let i=0;i<pairs.length;i+=12){
   const batch=pairs.slice(i,i+12);
   const results=await Promise.all(batch.map(async pair=>{
    try{
     const snap=await movi("/snapshot?fi="+encodeURIComponent(String(pair.fixture.id)));
     return {pair,snap};
    }catch(e){errors++;return {pair,snap:null,error:String(e)}}
   }));
   for(const item of results){
    if(!item.snap||!Array.isArray(item.snap.quotes))continue;
    const {match,fixture}=item.pair;
    const quotes=item.snap.quotes as any[];
    const rows=quotes.filter(q=>!q.suspended&&Number(q.odds_dec)>1&&Number.isFinite(Number(q.odds_dec))).map(q=>{
     const mapped=selectionFor(q,match.home_team,match.away_team);
     return {owner_id:match.owner_id||match.user_id,match_id:match.id,provider:"MoviOdds",provider_fixture_id:String(fixture.id),bookmaker:"bet365",sport:"soccer",market_group_id:String(q.group_id||""),market_id:String(q.market_id||""),market_name:String(q.group_name||"Unknown"),selection_id:String(q.sel_id||""),selection_label:q.label??null,selection_side:q.side??null,selection_line:q.line??null,selection_handicap:q.handicap??null,odds:Number(q.odds_dec),suspended:!!q.suspended,phase:String(q.phase|| (fixture.in_play?"inplay":"prematch")),price_timestamp:q.ts||null,provider_polled_at:item.snap.polled_at||item.snap.server_time||null,captured_at:new Date().toISOString(),raw_quote:q,mapped_market:mapped?.market??null,mapped_selection:mapped?.selection??null};
    }).filter(r=>r.owner_id&&r.selection_id&&r.market_group_id);
    for(let j=0;j<rows.length;j+=250){
     await db("provider_odds?on_conflict=provider,provider_fixture_id,market_group_id,market_id,selection_id","POST",rows.slice(j,j+250),"resolution=merge-duplicates,return=minimal");
    }
    processed.push({match_id:match.id,provider_fixture_id:String(fixture.id),quotes:rows.length,home:fixture.home,away:fixture.away});
   }
  }
  return json({ok:true,provider:"MoviOdds",bookmaker:"bet365",catalog_count:fixtures.length,app_matches:matches.length,matched_fixtures:pairs.length,snapshots_ok:processed.length,quotes_saved:processed.reduce((n,x)=>n+x.quotes,0),snapshot_errors:errors,processed,server_time:catalog.server_time||new Date().toISOString(),note:"Coverage is limited to fixtures found in both catalogs and markets currently priced by bet365."});
 }catch(e){return json({ok:false,error:String(e)},500)}
});