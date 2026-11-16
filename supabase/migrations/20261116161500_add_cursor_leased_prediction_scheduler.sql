-- Durable cursor + lease scheduler for MONEYBALL GLOBAL prediction scans.
-- pg_cron invokes the Edge Function every minute; the database lease prevents overlap.
create table if not exists public.moneyball_prediction_scan_state (
  owner_id uuid not null references auth.users(id) on delete cascade,
  scan_date date not null,
  cursor_kickoff_at timestamptz,
  cursor_match_id uuid,
  lease_token uuid,
  lease_until timestamptz,
  status text not null default 'idle' check (status in ('idle','running','completed','failed')),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  next_scan_at timestamptz,
  batches_completed integer not null default 0,
  fixtures_processed integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key(owner_id, scan_date)
);
create index if not exists moneyball_prediction_scan_lease_idx
  on public.moneyball_prediction_scan_state(lease_until) where lease_token is not null;
alter table public.moneyball_prediction_scan_state enable row level security;

create or replace function public.moneyball_claim_prediction_scan(p_owner_id uuid,p_date date,p_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare s public.moneyball_prediction_scan_state%rowtype; v_lease uuid:=gen_random_uuid();
begin
 if not public.moneyball_cron_token_valid(p_token) then raise exception 'invalid cron token' using errcode='42501'; end if;
 if p_owner_id is distinct from public.moneyball_cron_owner_id(p_token) then raise exception 'owner mismatch' using errcode='42501'; end if;
 insert into public.moneyball_prediction_scan_state(owner_id,scan_date) values(p_owner_id,p_date) on conflict(owner_id,scan_date) do nothing;
 select * into s from public.moneyball_prediction_scan_state where owner_id=p_owner_id and scan_date=p_date for update;
 if s.lease_token is not null and s.lease_until>now() then
  return jsonb_build_object('claimed',false,'reason','lease_active','lease_until',s.lease_until);
 end if;
 if s.status='completed' and s.next_scan_at is not null and s.next_scan_at>now() then
  return jsonb_build_object('claimed',false,'reason','cooldown','next_scan_at',s.next_scan_at,'fixtures_processed',s.fixtures_processed,'batches_completed',s.batches_completed);
 end if;
 update public.moneyball_prediction_scan_state set lease_token=v_lease,lease_until=now()+interval '5 minutes',
  status='running',last_started_at=now(),updated_at=now(),
  cursor_kickoff_at=case when status='completed' then null else cursor_kickoff_at end,
  cursor_match_id=case when status='completed' then null else cursor_match_id end,
  batches_completed=case when status='completed' then 0 else batches_completed end,
  fixtures_processed=case when status='completed' then 0 else fixtures_processed end,last_error=null
 where owner_id=p_owner_id and scan_date=p_date returning * into s;
 return jsonb_build_object('claimed',true,'lease_token',v_lease,'cursor_kickoff_at',s.cursor_kickoff_at,
  'cursor_match_id',s.cursor_match_id,'batches_completed',s.batches_completed,'fixtures_processed',s.fixtures_processed);
end $$;

create or replace function public.moneyball_prediction_scan_page(
 p_owner_id uuid,p_date date,p_cursor_kickoff_at timestamptz,p_cursor_match_id uuid,p_limit integer,p_token text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_rows jsonb; v_count integer; v_limit integer:=greatest(1,least(coalesce(p_limit,10),10));
begin
 if not public.moneyball_cron_token_valid(p_token) then raise exception 'invalid cron token' using errcode='42501'; end if;
 if p_owner_id is distinct from public.moneyball_cron_owner_id(p_token) then raise exception 'owner mismatch' using errcode='42501'; end if;
 with ranked as (
  select m.*,row_number() over(partition by
   coalesce(m.kickoff_at at time zone 'Europe/Brussels',m.kickoff_date::timestamp,p_date::timestamp)::date,
   regexp_replace(lower(coalesce(m.home_team,'')),'[^a-z0-9]+','','g'),
   regexp_replace(lower(coalesce(m.away_team,'')),'[^a-z0-9]+','','g'),
   coalesce(nullif(lower(m.gender),''),'men')
   order by (lower(coalesce(m.source,''))='footynomad') desc,(m.kickoff_at is not null) desc,m.updated_at desc,m.id) duplicate_rank
  from public.matches m where m.owner_id=p_owner_id
   and ((m.kickoff_at>=(p_date::timestamp at time zone 'Europe/Brussels') and m.kickoff_at<((p_date+1)::timestamp at time zone 'Europe/Brussels'))
     or (m.kickoff_at is null and m.kickoff_date=p_date))
   and public.moneyball_is_european_top_two_league(m.country,coalesce(m.competition,m.league))
   and (lower(coalesce(m.gender,''))='men' or (coalesce(m.gender,'')='' and
    concat_ws(' ',m.competition,m.league,m.home_team,m.away_team) !~* '\\m(women|womens|woman|frauen|femenina|femenino|feminin|female|damallsvenskan|wsl|liga[ -]?f|u(15|16|17|18|19|20|21|23)|under[ -]?(15|16|17|18|19|20|21|23)|reserves?|academy|youth|b team)\\M'))
   and concat_ws(' ',m.competition,m.league,m.home_team,m.away_team) !~* '\\m(reserves?|academy|youth|b team|ii|iii)\\M'
 ), eligible as (select * from ranked where duplicate_rank=1),
 page as (
  select * from eligible e where p_cursor_match_id is null
   or (p_cursor_kickoff_at is not null and ((e.kickoff_at is not null and (e.kickoff_at,e.id)>(p_cursor_kickoff_at,p_cursor_match_id)) or e.kickoff_at is null))
   or (p_cursor_kickoff_at is null and e.kickoff_at is null and e.id>p_cursor_match_id)
  order by e.kickoff_at asc nulls last,e.id asc limit v_limit+1
 )
 select count(*),coalesce(jsonb_agg(to_jsonb(x) order by x.kickoff_at asc nulls last,x.id asc) filter(where x.rn<=v_limit),'[]'::jsonb)
 into v_count,v_rows from (select p.*,row_number() over(order by p.kickoff_at asc nulls last,p.id asc) rn from page p) x;
 return jsonb_build_object('rows',v_rows,'has_more',v_count>v_limit,'count',least(v_count,v_limit));
end $$;

create or replace function public.moneyball_finish_prediction_scan(
 p_owner_id uuid,p_date date,p_lease_token uuid,p_cursor_kickoff_at timestamptz,p_cursor_match_id uuid,
 p_has_more boolean,p_processed integer,p_token text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare s public.moneyball_prediction_scan_state%rowtype;
begin
 if not public.moneyball_cron_token_valid(p_token) then raise exception 'invalid cron token' using errcode='42501'; end if;
 if p_owner_id is distinct from public.moneyball_cron_owner_id(p_token) then raise exception 'owner mismatch' using errcode='42501'; end if;
 update public.moneyball_prediction_scan_state set cursor_kickoff_at=p_cursor_kickoff_at,cursor_match_id=p_cursor_match_id,
  lease_token=null,lease_until=null,updated_at=now(),batches_completed=batches_completed+1,
  fixtures_processed=fixtures_processed+greatest(coalesce(p_processed,0),0),
  status=case when p_has_more then 'running' else 'completed' end,
  last_completed_at=case when p_has_more then last_completed_at else now() end,
  next_scan_at=case when p_has_more then null else now()+interval '15 minutes' end
 where owner_id=p_owner_id and scan_date=p_date and lease_token=p_lease_token returning * into s;
 if not found then return jsonb_build_object('ok',false,'reason','lease_lost'); end if;
 return jsonb_build_object('ok',true,'status',s.status,'batches_completed',s.batches_completed,
  'fixtures_processed',s.fixtures_processed,'next_scan_at',s.next_scan_at);
end $$;
revoke all on function public.moneyball_claim_prediction_scan(uuid,date,text) from public,anon,authenticated;
revoke all on function public.moneyball_prediction_scan_page(uuid,date,timestamptz,uuid,integer,text) from public,anon,authenticated;
revoke all on function public.moneyball_finish_prediction_scan(uuid,date,uuid,timestamptz,uuid,boolean,integer,text) from public,anon,authenticated;
grant execute on function public.moneyball_claim_prediction_scan(uuid,date,text) to anon,service_role;
grant execute on function public.moneyball_prediction_scan_page(uuid,date,timestamptz,uuid,integer,text) to anon,service_role;
grant execute on function public.moneyball_finish_prediction_scan(uuid,date,uuid,timestamptz,uuid,boolean,integer,text) to anon,service_role;
