import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-cron-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}});

async function db(path:string,method="GET",body?:unknown,prefer="return=representation"){
 const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{method,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text();let value:any;try{value=raw?JSON.parse(raw):null}catch{value=raw;}
 if(!r.ok)throw new Error("Supabase "+r.status+": "+String(value?.message||value).slice(0,400));
 return value;
}
async function authorized(token:string){
 if(!token)return false;
 const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/moneyball_cron_token_valid",{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},body:JSON.stringify({p_token:token})});
 return r.ok&&(await r.json())===true;
}
function brusselsDate(){
 return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function ageMs(value:string|null|undefined){const t=value?Date.parse(value):NaN;return Number.isFinite(t)?Date.now()-t:Infinity;}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method==="GET")return json({ok:true,service:"MONEYBALL automatic daily analysis",batch_size:30,batches_per_run:3,schedule:"every 2 minutes",timezone:"Europe/Brussels"});
 if(req.method!=="POST")return json({ok:false,error:"POST required"},405);
 try{
  if(!(await authorized(req.headers.get("x-cron-token")||"")))return json({ok:false,error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({}));
  const ownerId=String(body.owner_id||"");
  const date=String(body.date||brusselsDate());
  if(!ownerId)return json({ok:false,error:"Missing owner_id"},400);
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return json({ok:false,error:"Invalid date"},400);

  const scanPath="scan_runs?select=id,source,scan_date,status,started_at&owner_id=eq."+encodeURIComponent(ownerId)+"&scan_date=eq."+encodeURIComponent(date)+"&source=ilike.*FootyNomad*&order=started_at.desc&limit=1";
  const scans=await db(scanPath);
  const latest=scans?.[0];
  if(!latest)return json({ok:true,skipped:true,reason:"no_today_footynomad_scan",date});
  if(latest.status==="started")return json({ok:true,skipped:true,reason:"fixture_sync_still_running",date,scan_run_id:latest.id});

  const statePath="moneyball_auto_scan_state?select=owner_id,scan_date,scan_run_id,next_offset,status,last_started_at,last_completed_at,last_error,last_summary&owner_id=eq."+encodeURIComponent(ownerId)+"&scan_date=eq."+encodeURIComponent(date);
  let state=(await db(statePath))?.[0]||null;
  const newScan=!state||String(state.scan_run_id||"")!==String(latest.id);
  const refreshDue=state?.status==="completed"&&ageMs(state.last_completed_at)>=15*60*1000;
  if(newScan||refreshDue){
   await db("moneyball_auto_scan_state?on_conflict=owner_id,scan_date","POST",{owner_id:ownerId,scan_date:date,scan_run_id:latest.id,next_offset:0,status:"queued",last_started_at:null,last_completed_at:null,last_error:null,last_summary:{}}, "resolution=merge-duplicates,return=minimal");
   state={owner_id:ownerId,scan_date:date,scan_run_id:latest.id,next_offset:0,status:"queued",last_started_at:null,last_completed_at:null};
  }
  if(state?.status==="completed")return json({ok:true,skipped:true,reason:"today_analysis_complete",date,scan_run_id:latest.id,last_completed_at:state.last_completed_at,summary:state.last_summary});
  if(state?.status==="running"&&ageMs(state.last_started_at)<4*60*1000)return json({ok:true,skipped:true,reason:"analysis_batch_in_progress",date,next_offset:state.next_offset});

  const offset=Math.max(0,Number(state?.next_offset)||0);
  const startedAt=new Date().toISOString();
  await db("moneyball_auto_scan_state?owner_id=eq."+encodeURIComponent(ownerId)+"&scan_date=eq."+encodeURIComponent(date),"PATCH",{scan_run_id:latest.id,status:"running",last_started_at:startedAt,last_error:null},"return=minimal");

  const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
  const apiKey=req.headers.get("apikey")||SERVICE_KEY;
  if(!bearer)return json({ok:false,error:"Missing scheduled Authorization token"},401);
  const offsets=[offset,offset+30,offset+60];
  const pageResults=await Promise.all(offsets.map(async(pageOffset)=>{
   const response=await fetch(SUPABASE_URL+"/functions/v1/moneyball-predict",{method:"POST",headers:{apikey:apiKey,Authorization:"Bearer "+bearer,"x-cron-token":req.headers.get("x-cron-token")||"","Content-Type":"application/json"},body:JSON.stringify({owner_id:ownerId,date,offset:pageOffset}),signal:AbortSignal.timeout(115000)});
   const raw=await response.text();let result:any;try{result=raw?JSON.parse(raw):null}catch{result={error:raw.slice(0,500)};}
   if(!response.ok||!result?.ok)throw new Error("Predict offset "+pageOffset+" failed ("+response.status+"): "+String(result?.error||raw).slice(0,400));
   return result;
  }));

  const totals={matches:0,predictions:0,created:0,updated:0,preserved:0,selected:0,covered:0,missing:0,footy_form_matches:0,github_form_matches:0};
  for(const result of pageResults)for(const key of Object.keys(totals) as (keyof typeof totals)[])totals[key]+=Number(result[key]||0);
  const done=pageResults.some((result)=>result.has_more!==true);
  const nextOffset=done?0:offset+30*pageResults.length;
  const completedAt=done?new Date().toISOString():null;
  await db("moneyball_auto_scan_state?owner_id=eq."+encodeURIComponent(ownerId)+"&scan_date=eq."+encodeURIComponent(date),"PATCH",{next_offset:nextOffset,status:done?"completed":"running",last_started_at:startedAt,last_completed_at:completedAt,last_error:null,last_summary:{...totals,batches:pageResults.length,from_offset:offset,to_offset:offset+30*(pageResults.length-1),done,source_scan_run_id:latest.id},updated_at:new Date().toISOString()},"return=minimal");
  return json({ok:true,date,scan_run_id:latest.id,status:done?"completed":"running",from_offset:offset,next_offset:nextOffset,batches:pageResults.length,done,totals});
 }catch(error){
  const message=String(error);
  return json({ok:false,error:message.slice(0,1200)},500);
 }
});
