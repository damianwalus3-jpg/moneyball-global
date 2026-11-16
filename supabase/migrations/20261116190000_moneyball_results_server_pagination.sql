create or replace function public.moneyball_results_page(
  p_filter text default 'all',
  p_search text default '',
  p_before_kickoff timestamptz default null,
  p_before_id uuid default null,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  v_page_size integer := least(greatest(coalesce(p_page_size, 30), 1), 50);
  v_result jsonb;
begin
  if coalesce(p_filter, 'all') not in ('all', 'final', 'rejected', 'jackpot') then
    raise exception 'Invalid results filter';
  end if;
  if (p_before_kickoff is null) <> (p_before_id is null) then
    raise exception 'Cursor must contain both kickoff_at and id';
  end if;

  with scoped_matches as not materialized (
    select m.*
    from public.matches m
    where m.owner_id = (select auth.uid())
      and m.kickoff_at >= now() - interval '72 hours'
      and m.kickoff_at <= now() + interval '24 hours'
      and exists (
        select 1 from public.predictions p
        where p.owner_id = m.owner_id and p.match_id = m.id
          and (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
      )
      and (
        p_filter = 'all'
        or (p_filter = 'final' and exists (select 1 from public.predictions p where p.owner_id=m.owner_id and p.match_id=m.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%') and p.verdict='WYBRANY'))
        or (p_filter = 'rejected' and exists (select 1 from public.predictions p where p.owner_id=m.owner_id and p.match_id=m.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%') and p.verdict='ODRZUCONY'))
        or (p_filter = 'jackpot' and exists (select 1 from public.predictions p where p.owner_id=m.owner_id and p.match_id=m.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%') and p.group_name ilike '%jackpot%'))
      )
      and (nullif(btrim(coalesce(p_search,'')),'') is null
        or concat_ws(' ',m.home_team,m.away_team,m.competition,m.league) ilike '%'||btrim(p_search)||'%')
  ),
  page_plus as (
    select sm.* from scoped_matches sm
    where p_before_kickoff is null or (sm.kickoff_at,sm.id)<(p_before_kickoff,p_before_id)
    order by sm.kickoff_at desc,sm.id desc limit v_page_size+1
  ),
  page_matches as (
    select * from page_plus order by kickoff_at desc,id desc limit v_page_size
  ),
  page_rows as (
    select jsonb_build_object(
      'match',to_jsonb(pm),
      'result',(select to_jsonb(r) from public.match_results r where r.owner_id=pm.owner_id and r.match_id=pm.id order by r.verified desc,r.created_at desc limit 1),
      'picks',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id desc) from public.predictions p where p.owner_id=pm.owner_id and p.match_id=pm.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')),'[]'::jsonb)
    ) as item,pm.kickoff_at,pm.id
    from page_matches pm
  ),
  counts as (
    select count(*)::integer matches_count,
      coalesce(sum((select count(*) from public.predictions p where p.owner_id=sm.owner_id and p.match_id=sm.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%'))),0)::integer picks_count,
      coalesce(sum((select count(*) from public.predictions p where p.owner_id=sm.owner_id and p.match_id=sm.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%') and p.verdict='WYBRANY')),0)::integer selected_picks,
      count(*) filter(where exists(select 1 from public.match_results r where r.owner_id=sm.owner_id and r.match_id=sm.id and r.verified))::integer verified,
      count(*) filter(where sm.status='finished' and not exists(select 1 from public.match_results r where r.owner_id=sm.owner_id and r.match_id=sm.id and r.verified))::integer needs_result
    from scoped_matches sm
  ),
  cursor_row as (select kickoff_at,id from page_matches order by kickoff_at asc,id asc limit 1)
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(item order by kickoff_at desc,id desc) from page_rows),'[]'::jsonb),
    'has_more',(select count(*)>v_page_size from page_plus),
    'next_cursor',case when (select count(*)>v_page_size from page_plus) then (select jsonb_build_object('kickoff_at',kickoff_at,'id',id) from cursor_row) else null end,
    'matches_count',(select matches_count from counts),
    'picks_count',(select picks_count from counts),
    'selected_picks',(select selected_picks from counts),
    'verified',(select verified from counts),
    'needs_result',(select needs_result from counts)
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.moneyball_results_page(text,text,timestamptz,uuid,integer) from public;
revoke all on function public.moneyball_results_page(text,text,timestamptz,uuid,integer) from anon;
grant execute on function public.moneyball_results_page(text,text,timestamptz,uuid,integer) to authenticated;
