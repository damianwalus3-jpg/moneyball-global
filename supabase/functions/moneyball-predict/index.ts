import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const S="https://gzgeklcukrclgwbsmbsp.supabase.co",K=Deno.env.get("SUPABASE_ANON_KEY")||"",V="MONEYBALL GLOBAL 3.8";
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-requested-with, prefer, cache-control, pragma","Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"};
const out=(x:any,n=200)=>new Response(JSON.stringify(x),{status:n,headers:{...C,"Content-Type":"application/json"}});

const EUROPE_ISO3 = new Set(["ALB","AND","ARM","AUT","AZE","BLR","BEL","BIH","BUL","CRO","CYP","CZE","DNK","ENG","EST","FRO","FIN","FRA","GEO","DEU","GER","GIB","GRC","GRE","HUN","ISL","IRL","ITA","KAZ","KOS","LVA","LIE","LTU","LUX","MLT","MDA","MNE","NLD","MKD","NIR","NOR","POL","PRT","POR","ROU","RUS","SMR","SCO","SRB","SVK","SVN","ESP","SWE","CHE","SUI","TUR","UKR","WAL","GBR","UK"]);
const EUROPE_COUNTRIES = new Set(["albania","andorra","armenia","austria","azerbaijan","belarus","belgium","bosnia and herzegovina","bulgaria","croatia","cyprus","czechia","czech republic","denmark","england","estonia","faroe islands","finland","france","georgia","germany","gibraltar","greece","hungary","iceland","ireland","isle of man","italy","kazakhstan","kosovo","latvia","liechtenstein","lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","northern ireland","norway","poland","portugal","romania","russia","san marino","scotland","serbia","slovakia","slovenia","spain","sweden","switzerland","turkey","türkiye","ukraine","wales","united kingdom","uk","europe","uefa"]);
function isEuropeanFixture(country: unknown, competition: unknown, home?: unknown, away?: unknown): boolean {
 const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const c=norm(country), comp=norm(competition), teams=norm(String(home??"")+" "+String(away??""));
 const parts=c.split(/[\/,;|]+/).map((x:string)=>x.trim()).filter(Boolean);
 if(EUROPE_COUNTRIES.has(c)||parts.some((x:string)=>EUROPE_COUNTRIES.has(x)||EUROPE_ISO3.has(x.toUpperCase()))||EUROPE_ISO3.has(String(country??"").trim().toUpperCase()))return true;
 if(/\buefa\b|european (championship|qualif|league)|uefa nations|uefa champions|uefa europa|uefa conference/.test(comp))return true;
 if(/\bu20 elite league\b/.test(comp)&&/\b(england|italy|portugal|czech republic|germany|france|spain|netherlands|belgium|sweden|norway|denmark|finland|iceland|poland|croatia|serbia|austria|switzerland|scotland|wales|ireland)\b/.test(teams))return true;
 return false;
}

async function db(p:string,t:string,m="GET",b?:any,prefer="return=representation"){const r=await fetch(S+"/rest/v1/"+p,{method:m,headers:{apikey:K,Authorization:"Bearer "+t,"Content-Type":"application/json",Prefer:prefer},body:b===undefined?undefined:JSON.stringify(b)});const s=await r.text();let j:any;try{j=s?JSON.parse(s):null}catch{j=s}if(!r.ok)throw Error(j?.message||j?.details||"DB HTTP "+r.status);return j;}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function normTeam(v:any){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(fc|cf|sc|ac|afc|club)\b/g," ").replace(/\b(wfc|women|w)\b/g," women ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
function fixtureTeamKey(v:any){const key=normTeam(v);const aliases:Record<string,string>={"turkiye":"turkey"};return aliases[key]||key;}
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
 const source=f?.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":[f?.source,f?.home_form?.source,f?.away_form?.source].includes("ESPN_WOMEN_LAST10")?"ESPN_WOMEN_LAST10":"OPENMATCHDAY_LAST10";
 return {w,d,l,matches:games.length,goals_for:gf,goals_against:ga,source,last10:games,elo:f?.elo==null?null:Number(f.elo),rd:f?.rd==null?null:Number(f.rd),hfa:f?.hfa==null?null:Number(f.hfa),elo_as_of:f?.elo_as_of||null};
}
async function readPublicSourceForms(date:string){
 const byPair=new Map<string,any>(),byTeam=new Map<string,any[]>(),eloByTeam=new Map<string,any>();
 try{
  const r=await fetch(S+"/functions/v1/moneyball-public-sources?date="+encodeURIComponent(date),{headers:{apikey:K,Accept:"application/json"},signal:AbortSignal.timeout(55000)});
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
    if(h&&a)byPair.set(normTeam(f.home_team)+"|"+normTeam(f.away_team)+"|"+genderKey,{home:h,away:a,source:h.source==="ESPN_WOMEN_LAST10"||a.source==="ESPN_WOMEN_LAST10"?"ESPN_WOMEN_LAST10":h.source==="ESPN_FORM_LAST5"||a.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":"OPENMATCHDAY_LAST10"});
    // Preserve one-sided form when the opponent has no tracked league results.
    for(const [team,form] of [[f.home_team,h],[f.away_team,a]] as any[]){if(!form)continue;const key=normTeam(team),arr=byTeam.get(key)||[];arr.push({form,country:String(f.country||"").toLowerCase(),competition:String(f.competition||"").toLowerCase(),gender:genderKey});byTeam.set(key,arr);}
   }
  return {byPair,byTeam,eloByTeam,eloMeta,fixtures:Number(j?.european_fixtures||0),error:null};
 }catch(e){console.error("OpenMatchday supplemental form unavailable:",String(e));return {byPair,byTeam,eloByTeam,eloMeta:null,fixtures:0,error:String(e)};}
}
function publicFormForMatch(m:any,index:any){
 const rawGender=String(m.gender||"unknown").toLowerCase();if(rawGender!=="men"&&rawGender!=="women")return null;const targetGender=rawGender;
 const exact=index.byPair.get(normTeam(m.home_team)+"|"+normTeam(m.away_team)+"|"+targetGender);if(exact)return exact;
 const choose=(team:string)=>{const rows=(index.byTeam.get(normTeam(team))||[]).filter((x:any)=>targetGender==="women"?x.gender==="women":x.gender!=="women");if(!rows.length)return null;const country=String(m.country||"").toLowerCase(),comp=String(m.competition||"").toLowerCase();const ranked=rows.map((x:any)=>({...x,score:(country&&x.country.includes(country)?3:0)+(comp&&(x.competition.includes(comp)||comp.includes(x.competition))?2:0)})).sort((a:any,b:any)=>b.score-a.score);if(ranked.length>1&&ranked[0].score===ranked[1].score)return null;return ranked[0].form;};
  const home=choose(String(m.home_team)),away=choose(String(m.away_team));return home||away?{home,away,source:home?.source==="ESPN_WOMEN_LAST10"||away?.source==="ESPN_WOMEN_LAST10"?"ESPN_WOMEN_LAST10":home?.source==="ESPN_FORM_LAST5"||away?.source==="ESPN_FORM_LAST5"?"ESPN_FORM_LAST5":"OPENMATCHDAY_LAST10"}:null;
}
function poisson(lambda:number,k:number){let p=Math.exp(-lambda);for(let i=1;i<=k;i++)p*=lambda/i;return p;}
function historyModel(home:string,away:string,kickoff:string,history:any[],footyForm:any=null,publicForm:any=null,gender:string="men"){
 const cutoff=new Date(kickoff).getTime();
 const targetGender=String(gender||"unknown").toLowerCase();const teamRows=(team:string)=>history.filter((x:any)=>{const historyGender=String(x.gender||"unknown").toLowerCase();if(targetGender==="women"&&historyGender!=="women")return false;if(targetGender==="men"&&historyGender==="women")return false;if(targetGender==="unknown"&&historyGender!=="unknown")return false;const t=x.kickoff_at?new Date(x.kickoff_at).getTime():NaN;if(!Number.isFinite(t)||t>=cutoff)return false;const rr=Array.isArray(x.match_results)?x.match_results[0]:x.match_results;if(!rr||rr.verified!==true||rr.home_score==null||rr.away_score==null||!Number.isInteger(Number(rr.home_score))||!Number.isInteger(Number(rr.away_score)))return false;return normTeam(x.home_team)===team||normTeam(x.away_team)===team;}).sort((a:any,b:any)=>new Date(b.kickoff_at||0).getTime()-new Date(a.kickoff_at||0).getTime()).filter((x:any)=>{const t=x.kickoff_at?new Date(x.kickoff_at).getTime():NaN;return Number.isFinite(t)&&cutoff-t<=240*24*60*60*1000;}).slice(0,10).map((x:any)=>{const rr=Array.isArray(x.match_results)?x.match_results[0]:x.match_results;const isHome=normTeam(x.home_team)===team,gf=Number(isHome?rr.home_score:rr.away_score),ga=Number(isHome?rr.away_score:rr.home_score);return {date:String(x.kickoff_at||"").slice(0,10),opponent:isHome?x.away_team:x.home_team,gf,ga,pts:gf>ga?3:gf===ga?1:0};});
 const hLocal=teamRows(normTeam(home)),aLocal=teamRows(normTeam(away)),hf={...(footyForm?.home||{}),...(publicForm?.home||{})},af={...(footyForm?.away||{}),...(publicForm?.away||{})};
 const choose=(local:any[],fallback:any)=>{
  const supplemental=Array.isArray(fallback?.last10)?fallback.last10:(Array.isArray(fallback?.last5)?fallback.last5:[]);
  const externalRows=supplemental.map((x:any)=>({date:String(x.date||"").slice(0,10),opponent:String(x.opponent||""),gf:Number(x.goals_for||0),ga:Number(x.goals_against||0),xg_for:x.xg_for==null?null:Number(x.xg_for),xg_against:x.xg_against==null?null:Number(x.xg_against),pts:x.result==="W"?3:x.result==="D"?1:0}));
  const merged=[...local,...externalRows].filter((x:any)=>Number.isFinite(x.gf)&&Number.isFinite(x.ga)).sort((a:any,b:any)=>String(b.date||"").localeCompare(String(a.date||"")));
  const seen=new Set<string>(),rows=merged.filter((x:any)=>{const k=[x.date,normTeam(x.opponent),x.gf,x.ga].join("|");if(seen.has(k))return false;seen.add(k);return true;}).slice(0,10);
  if(rows.length>=3)return {rows,matches:rows.length,form:fallback||null,source:fallback?.source||"VERIFIED_MATCH_HISTORY"};
   const fallbackMatches=Number(fallback?.matches||((Number(fallback?.w)||0)+(Number(fallback?.d)||0)+(Number(fallback?.l)||0)));if(fallback&&fallbackMatches>=3)return {rows,matches:fallbackMatches,form:fallback,source:fallback.source||"FOOTYNOMAD_LAST5"};
  if(local.length)return {rows:local,matches:local.length,form:null,source:"PARTIAL_VERIFIED_HISTORY"};
  return {rows:[],matches:0,form:null,source:"BASELINE_ONLY"};
 };
 const hs=choose(hLocal,hf),as=choose(aLocal,af),avg=(xs:any[],k:string)=>xs.length?xs.reduce((s,x)=>s+Number(x[k]||0),0)/xs.length:0,hn=hs.matches,an=as.matches,n=Math.min(hn,an);
 let p1:number,px:number,p2:number,method:string,xgUsed=false,xgHomeMatches=0,xgAwayMatches=0,xgHomeSourceCounts:Record<string,number>={},xgAwaySourceCounts:Record<string,number>={};
 if(hs.rows.length>=3&&as.rows.length>=3){
  const hxgRows=Array.isArray(hf?.xg_last10)?hf.xg_last10.filter((x:any)=>String(x.date||"")<String(kickoff||"").slice(0,10)):hs.rows.filter((x:any)=>x.xg_for!=null&&x.xg_against!=null),axgRows=Array.isArray(af?.xg_last10)?af.xg_last10.filter((x:any)=>String(x.date||"")<String(kickoff||"").slice(0,10)):as.rows.filter((x:any)=>x.xg_for!=null&&x.xg_against!=null),hxg=hxgRows.length,axg=axgRows.length,useXg=hxg>=3&&axg>=3; xgUsed=useXg; xgHomeMatches=hxg; xgAwayMatches=axg; const countSources=(rows:any[])=>rows.reduce((acc:Record<string,number>,row:any)=>{const source=String(row.source||"historical_xg").toLowerCase();acc[source]=(acc[source]||0)+1;return acc;},{});xgHomeSourceCounts=countSources(hxgRows);xgAwaySourceCounts=countSources(axgRows); const homeAttack=useXg?0.65*avg(hxgRows,"xg_for")+0.35*avg(hs.rows,"gf"):avg(hs.rows,"gf"),homeDefence=useXg?0.65*avg(hxgRows,"xg_against")+0.35*avg(hs.rows,"ga"):avg(hs.rows,"ga"),awayAttack=useXg?0.65*avg(axgRows,"xg_for")+0.35*avg(as.rows,"gf"):avg(as.rows,"gf"),awayDefence=useXg?0.65*avg(axgRows,"xg_against")+0.35*avg(as.rows,"ga"):avg(as.rows,"ga"),lh=clamp(((homeAttack+awayDefence)/2)*1.06,0.15,3.6),la=clamp(((awayAttack+homeDefence)/2)*0.94,0.15,3.6),hp=Array.from({length:9},(_,i)=>poisson(lh,i)),ap=Array.from({length:9},(_,i)=>poisson(la,i));
  p1=0;px=0;p2=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){const q=hp[i]*ap[j];if(i>j)p1+=q;else if(i===j)px+=q;else p2+=q;}const sum=p1+px+p2;p1/=sum;px/=sum;p2/=sum;
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
  const xgSources=[...new Set([...(hf?.xg_last10||[]),...(af?.xg_last10||[])].map((x:any)=>String(x.source||"HISTORICAL_XG")))];
  let calibrationTemperature=1,calibrationMethod="none";
  if(targetGender!=="women"&&!eloUsed){
   if(xgUsed&&xgSources.length===1&&xgSources[0].toLowerCase().includes("openplay")){calibrationTemperature=0.67;calibrationMethod="chronological_holdout_temperature_openplay_xg";}
   else if(!xgUsed){calibrationTemperature=0.90;calibrationMethod="chronological_holdout_temperature_goals_only";}
  }
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
  else if(hs.source==="ESPN_WOMEN_LAST10"||as.source==="ESPN_WOMEN_LAST10")source="ESPN_WOMEN_LAST10";
  else if(hs.source==="ESPN_FORM_LAST5"||as.source==="ESPN_FORM_LAST5")source="ESPN_FORM_LAST5";
   else if(hs.source==="OPENMATCHDAY_LAST10"||as.source==="OPENMATCHDAY_LAST10")source="OPENMATCHDAY_LAST10";
  else if(hs.source==="VERIFIED_MATCH_HISTORY"&&as.source==="VERIFIED_MATCH_HISTORY")source="VERIFIED_MATCH_HISTORY";
  else if(footyForm)source="FOOTYNOMAD_LAST5";
  else if(hn>0||an>0)source="PARTIAL_VERIFIED_HISTORY";
  if(eloUsed&&hn===0&&an===0)source="BEYONDELO_ONLY";
  const coverage=source==="BEYONDELO_ONLY"?35:source==="ESPN_FORM_LAST5"?45:(n>0?Math.min(75,n*15):(eloUsed?35:0));
  return {p1:+(p1/total*100).toFixed(1),px:+(px/total*100).toFixed(1),p2:+(p2/total*100).toFixed(1),coverage,home_matches:hn,away_matches:an,home_form:Object.keys(hf).length?hf:null,away_form:Object.keys(af).length?af:null,source,footyForm:!!footyForm,publicForm:source==="OPENMATCHDAY_LAST10"||source==="ESPN_WOMEN_LAST10"||source==="ESPN_FORM_LAST5",espnWomenForm:source==="ESPN_WOMEN_LAST10",pitchForm:source==="PITCHAPI_LAST5",method,xg_used:xgUsed,xg_home_matches:xgHomeMatches,xg_away_matches:xgAwayMatches,xg_home_source_counts:xgHomeSourceCounts,xg_away_source_counts:xgAwaySourceCounts,xg_sources:xgSources,calibration_temperature:calibrationTemperature,calibration_method:calibrationMethod,elo_used:eloUsed,elo_home:eloHome,elo_away:eloAway,elo_diff:eloDiff,elo_weight:eloWeight,elo_as_of:eloAsOf};
 return {p1:+(p1/total*100).toFixed(1),px:+(px/total*100).toFixed(1),p2:+(p2/total*100).toFixed(1),coverage:Math.min(75,n*15),home_matches:hn,away_matches:an,home_form:hf||null,away_form:af||null,source,footyForm:!!footyForm,publicForm:source==="OPENMATCHDAY_LAST10",pitchForm:source==="PITCHAPI_LAST5",method};
}
async function readGitHubPublicTeamHistory(){
 try{
  const r=await fetch("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/team-history.json",{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(18000)});
  if(!r.ok)throw new Error("GitHub public history HTTP "+r.status);
  const data=await r.json();
  if(data?.schema_version!==1||!data?.teams||Object.keys(data.teams).length<100)throw new Error("GitHub public history validation failed");
  return data;
 }catch(e){return {teams:{},error:String(e),generated_at:null,coverage:null};}
}
let historicalXgCache:any=null;let historicalXgCacheAt=0;
async function readOpenPlayXgData(){
 if(historicalXgCache&&Date.now()-historicalXgCacheAt<30*60*1000)return historicalXgCache;
 const teams:Record<string,any>={};let openplay:any=null,statsbomb:any=null,asa:any=null;
 try{const r=await fetch("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/openplay-xg.json",{headers:{"Accept":"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(18000)});if(r.ok){const data=await r.json();if(data?.schema_version===1&&data?.teams&&Object.keys(data.teams).length>=100)openplay=data;else throw new Error("OpenPlay xG validation failed");}}catch(e){console.error("OpenPlay xG history unavailable:",String(e));}
 try{const r=await fetch("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/statsbomb-xg.json",{headers:{"Accept":"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(18000)});if(r.ok){const data=await r.json();if(data?.schema_version===1&&data?.teams&&Object.keys(data.teams).length>=80)statsbomb=data;}}catch(e){console.error("StatsBomb xG history unavailable:",String(e));}
 try{const r=await fetch("https://raw.githubusercontent.com/damianwalus3-jpg/moneyball-global-web/main/public-data/asa-xg.json",{headers:{"Accept":"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(18000)});if(r.ok){const data=await r.json();if(data?.schema_version===1&&data?.teams&&Object.keys(data.teams).length>=20)asa=data;}}catch(e){console.error("American Soccer Analysis xG history unavailable:",String(e));}
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
 const token=req.headers.get("Authorization")?.replace("Bearer ","");if(!token)throw Error("Zaloguj się ponownie.");
 const jwtParts=token.split(".");
 const jwtPayload=jwtParts.length>1?JSON.parse(atob(jwtParts[1].replace(/-/g,"+").replace(/_/g,"/"))):{};
 const ownerId=String(jwtPayload.sub||"");
 if(!ownerId)throw Error("Nie można odczytać właściciela sesji.");
 const body=await req.json().catch(()=>({})),date=String(body.date||new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
 const all=await db("matches?select=id,owner_id,scan_run_id,external_id,source,competition,league,country,gender,home_team,away_team,kickoff_at,kickoff_date,status&owner_id=eq."+encodeURIComponent(ownerId)+"&order=kickoff_at.asc",token);
 const dateFromExternalId=(m:any)=>/:(\d{4}-\d{2}-\d{2}):/.exec(String(m.external_id||""))?.[1]||null;
  const matchDate=(m:any)=>m.kickoff_at?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(m.kickoff_at)):(String(m.kickoff_date||"").slice(0,10)||dateFromExternalId(m));
  const rawDateMatches=all.filter((m:any)=>isEuropeanFixture(m.country,m.competition||m.league,m.home_team,m.away_team)&&matchDate(m)===date);
  const deduped=dedupeFixturesByDate(rawDateMatches,matchDate);const matches=deduped.matches;const duplicatesRemoved=deduped.duplicatesRemoved;
 const historyFields="select=id,home_team,away_team,kickoff_at,gender,match_results(home_score,away_score,verified)";
 const historyTimed=await db("matches?"+historyFields+"&owner_id=eq."+encodeURIComponent(ownerId)+"&kickoff_at=lt."+encodeURIComponent(date+"T23:59:59Z")+"&order=kickoff_at.desc&limit=3000",token).catch((e:any)=>{console.error("Timed history query unavailable:",String(e));return [];});
 const history=historyTimed||[];
 const footyCacheRows=await db("match_market_data?select=match_id,provider_data,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&source=eq.FootyNomad",token).catch(()=>[]);
 const footyCacheMap=new Map((footyCacheRows||[]).map((row:any)=>[row.match_id,row.provider_data]));
 const footyForms=new Map<string,any>(),formCandidates:any[]=[];
 for(const m of matches){
  if(!["scheduled","unknown"].includes(m.status)||!m.kickoff_at||new Date(m.kickoff_at).getTime()<=Date.now()||m.source!=="FootyNomad"||!/^\d+$/.test(String(m.external_id||"")))continue;
  const cached=readCachedFootyForm(footyCacheMap.get(m.id),String(m.home_team),String(m.away_team));
  if(cached)footyForms.set(m.id,cached);else formCandidates.push(m);
 }
 const formResults=await limitedSettled(formCandidates,10,async(m:any)=>{
  const form=await readFootyNomadForm(String(m.external_id),String(m.home_team),String(m.away_team));
  if(form){
   const capturedAt=new Date().toISOString();
   const provider_data={footy_nomad_form:{home_name:m.home_team,away_name:m.away_team,home:form.home,away:form.away,fetched_at:capturedAt}};
   await db("match_market_data?on_conflict=owner_id,match_id,source",token,"POST",{owner_id:ownerId,match_id:m.id,source:"FootyNomad",provider_data,captured_at:capturedAt},"resolution=merge-duplicates,return=minimal").catch((e:any)=>console.error("FootyNomad cache write failed:",String(e)));
  }
  return {id:m.id,form};
 });
 const publicForms=await readPublicSourceForms(date);
 const githubPublic=await readGitHubPublicTeamHistory();
 const openPlayXg=await readOpenPlayXgData();
 const marketRows=await db("match_market_data?select=match_id,provider_data,captured_at&owner_id=eq."+encodeURIComponent(ownerId)+"&source=eq.StrikerAPI",token);const marketMap=new Map((marketRows||[]).map((x:any)=>[x.match_id,x.provider_data]));
 if(!matches.length)return out({ok:true,date,total:0,created:0,updated:0,selected:0,message:"Brak zaplanowanych meczów w bazie."});
 const rows:any[]=[];let covered=0,missing=0;
 for(const m of matches){
  const market:any=marketMap.get(m.id);let model:any=null,coverage:any={market_odds:false,elo:false,verified_history:false};
  if(market?.market_probabilities){const mp=market.market_probabilities,stamp=Date.parse(String(market.captured_at||market.provider_data?.captured_at||"")),fresh=Number.isFinite(stamp)&&Date.now()-stamp>=0&&Date.now()-stamp<=48*60*60*1000,vals=[Number(mp.home),Number(mp.draw),Number(mp.away)],sum=vals.reduce((a,b)=>a+b,0);if(fresh&&vals.every(x=>Number.isFinite(x)&&x>0)&&sum>0){model={p1:+(vals[0]/sum*100).toFixed(1),px:+(vals[1]/sum*100).toFixed(1),p2:+(vals[2]/sum*100).toFixed(1),coverage:80,market:true};coverage={market_odds:true,books:market.books,league:market.league,market_captured_at:market.captured_at||market.provider_data?.captured_at};}}
  if(!model){
   const modelKickoff=String(m.kickoff_at||`${matchDate(m)}T00:00:00.000Z`);const isWomen=String(m.gender||"").toLowerCase()==="women";const githubHome=githubTeamForm(String(m.home_team),modelKickoff,githubPublic,openPlayXg,String(m.gender||"unknown")),githubAway=githubTeamForm(String(m.away_team),modelKickoff,githubPublic,openPlayXg,String(m.gender||"unknown"));const githubForm={home:githubHome,away:githubAway,source:"KEYLESS_GITHUB_LAST10"};const publicMatchForm=publicFormForMatch(m,publicForms);const knownGender=["men","women"].includes(String(m.gender||"").toLowerCase());const homeElo=knownGender&&!isWomen?findEloRating(String(m.home_team),publicForms.eloByTeam||new Map()):null,awayElo=knownGender&&!isWomen?findEloRating(String(m.away_team),publicForms.eloByTeam||new Map()):null;const homeSupplement={...(publicMatchForm?.home||{}),...(githubForm.home||{})},awaySupplement={...(publicMatchForm?.away||{}),...(githubForm.away||{})};if(homeElo)Object.assign(homeSupplement,{elo:Number(homeElo.elo),rd:Number(homeElo.rd),hfa:Number(homeElo.hfa),elo_as_of:homeElo.as_of});if(awayElo)Object.assign(awaySupplement,{elo:Number(awayElo.elo),rd:Number(awayElo.rd),hfa:Number(awayElo.hfa),elo_as_of:awayElo.as_of});const supplemental={home:Object.keys(homeSupplement).length?homeSupplement:null,away:Object.keys(awaySupplement).length?awaySupplement:null,source:githubForm.home||githubForm.away?githubForm.source:publicMatchForm?.source||"OPENMATCHDAY_LAST10"};
   model=historyModel(m.home_team,m.away_team,modelKickoff,history||[],footyForms.get(m.id)||null,supplemental,String(m.gender||"unknown"));
   coverage={verified_history:model.source==="VERIFIED_MATCH_HISTORY",partial_verified_history:model.source==="PARTIAL_VERIFIED_HISTORY",baseline_only:model.source==="BASELINE_ONLY",footynomad_last5:model.footyForm,openmatchday_last10:model.source==="OPENMATCHDAY_LAST10",espn_women_last10:model.espnWomenForm,keyless_github_last10:githubForm.source==="KEYLESS_GITHUB_LAST10"&&!!(githubForm.home||githubForm.away),statsbomb_open_data:(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("statsbomb")),statsbomb_xg_used:(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("statsbomb")),openplay_xg_used:(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("openplay")),asa_xg_used:(model.xg_sources||[]).some((x:string)=>String(x).toLowerCase().includes("american_soccer_analysis")),historical_xg_used:model.xg_used||false,historical_xg_sources:model.xg_sources||[],calibration_temperature:model.calibration_temperature||1,calibration_method:model.calibration_method||"none",elo_used:model.elo_used,home_elo:model.elo_home,away_elo:model.elo_away,elo_diff:model.elo_diff,elo_weight:model.elo_weight,elo_as_of:model.elo_as_of,elo_ratings_count:publicForms.eloMeta?.ratings_count||0,github_data_generated_at:githubPublic.generated_at||null,github_data_coverage:githubPublic.coverage||null,openplay_xg_generated_at:openPlayXg.openplay_generated_at||null,statsbomb_xg_generated_at:openPlayXg.statsbomb_generated_at||null,asa_xg_generated_at:openPlayXg.asa_generated_at||null,xg_data_coverage:openPlayXg.coverage||null,historical_xg_home_matches:model.xg_home_matches||0,historical_xg_away_matches:model.xg_away_matches||0,openplay_xg_home_matches:model.xg_home_source_counts?.openplay||0,openplay_xg_away_matches:model.xg_away_source_counts?.openplay||0,statsbomb_xg_home_matches:model.xg_home_source_counts?.statsbomb_open_data||0,statsbomb_xg_away_matches:model.xg_away_source_counts?.statsbomb_open_data||0,asa_xg_home_matches:model.xg_home_source_counts?.american_soccer_analysis||0,asa_xg_away_matches:model.xg_away_source_counts?.american_soccer_analysis||0,home_form:model.home_form,away_form:model.away_form,method:model.method};
   model.history=model.source!=="BASELINE_ONLY";
  }
  const hasModel=!!model;
  if(!model){coverage={market_odds:false,elo:false,reason:"BRAK POTWIERDZONYCH DANYCH — nie generujemy sztucznego prawdopodobieństwa."};}
  const bothTeamsCovered=!!(model.market||(model.history&&model.home_matches>=3&&model.away_matches>=3));const dataCovered=bothTeamsCovered;if(dataCovered)covered++;else missing++;
  const preds:any[]=[];
  if(hasModel){const opts=[["1",model.p1],["X",model.px],["2",model.p2]];const best=opts.sort((x:any,y:any)=>y[1]-x[1])[0];preds.push({market:"1X2",selection:best[0],probability:best[1]});for(const [sel,val] of [["1X",model.p1+model.px],["X2",model.px+model.p2],["12",model.p1+model.p2]])preds.push({market:"DOUBLE_CHANCE",selection:sel,probability:+val.toFixed(1)});}
  else{preds.push({market:"1X2",selection:"—",probability:null},{market:"DOUBLE_CHANCE",selection:"1X",probability:null},{market:"DOUBLE_CHANCE",selection:"X2",probability:null},{market:"DOUBLE_CHANCE",selection:"12",probability:null});}
   const reasonBase=model.market?"Rzeczywiste prawdopodobieństwa rynkowe dostawcy.":model.source==="BEYONDELO_ONLY"?"Prognoza oparta na ratingach Elo obu klubów z publicznego źródła BeyondELO; brak wystarczającej historii formy, więc typ jest odrzucony.":model.source==="STATSBOMB_OPEN_DATA"?"Forma z publicznych danych StatsBomb Open Data; zakres rozgrywek jest selektywny i historyczny.":model.source==="AMERICAN_SOCCER_ANALYSIS"?"Forma i historyczne xG z publicznego American Soccer Analysis; dane obejmują wybrane ligi Ameryki Północnej.":model.source==="KEYLESS_GITHUB_LAST10"?"Model Poissona na podstawie ostatnich maksymalnie 10 wyników z publicznych baz GitHub: OpenMatchday i OpenFootball.":model.source==="ESPN_WOMEN_LAST10"?"Model Poissona na podstawie ostatnich dostępnych wyników ligi kobiecej z publicznych scoreboardów ESPN.":model.source==="ESPN_FORM_LAST5"?"Model formy W/D/L na podstawie ostatnich pięciu wyników widocznych w publicznym scoreboardzie ESPN; bez dopisywania nieudostępnionych goli ani xG.":model.history?"Szacunek Moneyball na podstawie zweryfikowanej historii i formy z publicznych baz. Nie jest to kurs bukmachera ani gwarancja.":"Neutralny prior techniczny bez danych o formie; zapisany wyłącznie jako ODRZUCONY.";const xgNote=model.market?"":model.xg_used?` Uwzględniono świeże historyczne xG ze źródeł: ${(model.xg_sources||[]).join(", ")}.`:" Nie wykorzystano xG: brak co najmniej 3 świeżych meczów z xG dla obu drużyn.";const calibrationNote=model.calibration_temperature&&model.calibration_temperature!==1?` Prawdopodobieństwa skalowano temperaturą ${model.calibration_temperature.toFixed(2)}.`:"";const reason=reasonBase+xgNote+calibrationNote+(model.elo_used&&model.source!=="BEYONDELO_ONLY"?` Rating Elo: ${model.elo_home}–${model.elo_away} (różnica ${model.elo_diff}), snapshot ${model.elo_as_of}.`:"");
  for(const p of preds){
   const futureEligible=!!m.kickoff_at&&["scheduled","unknown"].includes(m.status)&&new Date(m.kickoff_at).getTime()>Date.now();
   const verdict=futureEligible&&bothTeamsCovered&&model.source!=="BASELINE_ONLY"&&p.probability>=75&&model.coverage>=55?"WYBRANY":"ODRZUCONY";
   const type=p.market==="DOUBLE_CHANCE"?"DC":"1X2";
    const baseSource=model.market?"VERIFIED_MARKET_DATA":model.source==="BASELINE_ONLY"?"NO_VERIFIED_SOURCE":model.source==="BEYONDELO_ONLY"?"BEYONDELO_ELO_ONLY":model.source==="KEYLESS_GITHUB_LAST10"?"KEYLESS_GITHUB_LAST10_FORM":model.source==="STATSBOMB_OPEN_DATA"?"STATSBOMB_OPEN_DATA_FORM":model.source==="AMERICAN_SOCCER_ANALYSIS"?"AMERICAN_SOCCER_ANALYSIS_FORM":model.source==="ESPN_WOMEN_LAST10"?"ESPN_WOMEN_LAST10_FORM":model.publicForm?"OPENMATCHDAY_LAST10_FORM":model.footyForm?"FOOTYNOMAD_LAST5_FORM":"MONEYBALL_VERIFIED_HISTORY";const xgSources=model.xg_sources||[];const xgSuffix=model.xg_used?"+HISTORICAL_XG"+(xgSources.some((x:string)=>x.toLowerCase().includes("openplay"))?"+OPENPLAY_XG":"")+(xgSources.some((x:string)=>x.toLowerCase().includes("statsbomb"))?"+STATSBOMB_XG":"")+(xgSources.some((x:string)=>x.toLowerCase().includes("american_soccer_analysis"))?"+ASA_XG":""):"";const dataSource=(model.elo_used&&model.source!=="BEYONDELO_ONLY"?baseSource+"+BEYONDELO_ELO":baseSource)+xgSuffix;
    rows.push({owner_id:ownerId,match_id:m.id,scan_run_id:m.scan_run_id||null,model_version:V,market:p.market,selection:p.selection,probability:p.probability,odds:null,confidence:hasModel&&model.source!=="BASELINE_ONLY"?String(model.coverage):null,verdict,rationale:reason,group_name:p.market==="1X2"?"MAIN":"MEGA",data_source:dataSource,data_coverage:coverage,note:JSON.stringify({source:dataSource,coverage}),settlement_status:"pending",verified:false});
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
 return out({ok:true,date,model:V,provider:"Keyless OpenMatchday + OpenFootball + OpenPlay historical xG + StatsBomb Open Data xG + BeyondELO Elo + verified results + FootyNomad + fresh market probabilities",matches:matches.length,fixtures_before_deduplication:rawDateMatches.length,duplicates_removed:duplicatesRemoved,predictions:rows.length,created,updated,preserved,covered,missing,footy_form_candidates:formCandidates.length,footy_form_matches:footyForms.size,openmatchday_fixtures:publicForms.fixtures,openmatchday_error:publicForms.error||null,github_public_teams:Object.keys(githubPublic.teams||{}).length,github_public_competitions:githubPublic.coverage?.competitions_with_results||0,github_openfootball_matches:githubPublic.coverage?.openfootball_league_matches_read||0,github_openfootball_files:githubPublic.coverage?.openfootball_league_files_loaded||0,github_public_generated_at:githubPublic.generated_at||null,github_public_error:githubPublic.error||null,github_form_matches:new Set(rows.filter((x:any)=>String(x.note).includes("KEYLESS_GITHUB_LAST10_FORM")).map((x:any)=>x.match_id)).size,selected:rows.filter(x=>x.verdict==="WYBRANY").length,couponCreated,couponLegs,limitations:["Model korzysta z publicznych baz OpenMatchday, OpenFootball, OpenPlay, StatsBomb Open Data i American Soccer Analysis (ASA). ASA obejmuje wybrane ligi Ameryki Północnej: MLS, NWSL i rozgrywki USL; nie jest globalnym źródłem xG.","Publiczne bazy wyników nie zapewniają xG, potwierdzonych składów ani kontuzji dla wszystkich rozgrywek. Rating Elo jest dostępny tylko dla części klubów UEFA i nie zastępuje xG. Brakujące dane pozostają puste; nie są symulowane. Kursy rynkowe są używane wyłącznie, gdy zapis ma maksymalnie 48 godzin.","Dane publiczne odświeżane przez GitHub Actions zgodnie z harmonogramem poszczególnych źródeł.","Kupony tworzy użytkownik przyciskiem generatora; skan nie zapisuje automatycznie kuponów."]});
}catch(e){return out({ok:false,error:String(e)},400)}});