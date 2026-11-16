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

  with window_matches as materialized (
    select m.* from public.matches m
    where m.owner_id=(select auth.uid())
      and m.kickoff_at>=now()-interval '72 hours'
      and m.kickoff_at<=now()+interval '24 hours'
  ),
  active_by_match as materialized (
    select p.owner_id,p.match_id,count(*)::integer picks_count,
      count(*) filter(where p.verdict='WYBRANY')::integer selected_picks,
      bool_or(p.verdict='WYBRANY') has_final,
      bool_or(p.verdict='ODRZUCONY') has_rejected,
      bool_or(p.group_name ilike '%jackpot%') has_jackpot
    from public.predictions p join window_matches wm on wm.id=p.match_id and wm.owner_id=p.owner_id
    where p.owner_id=(select auth.uid()) and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    group by p.owner_id,p.match_id
  ),
  scoped_matches as materialized (
    select wm.*,abm.picks_count,abm.selected_picks,
      exists(select 1 from public.match_results r where r.owner_id=wm.owner_id and r.match_id=wm.id and r.verified) has_verified_result
    from window_matches wm join active_by_match abm on abm.owner_id=wm.owner_id and abm.match_id=wm.id
    where (p_filter='all' or (p_filter='final' and abm.has_final) or (p_filter='rejected' and abm.has_rejected) or (p_filter='jackpot' and abm.has_jackpot))
      and (nullif(btrim(coalesce(p_search,'')),'') is null or concat_ws(' ',wm.home_team,wm.away_team,wm.competition,wm.league) ilike '%'||btrim(p_search)||'%')
  ),
  page_plus as (
    select sm.* from scoped_matches sm
    where p_before_kickoff is null or (sm.kickoff_at,sm.id)<(p_before_kickoff,p_before_id)
    order by sm.kickoff_at desc,sm.id desc limit v_page_size+1
  ),
  page_matches as (select * from page_plus order by kickoff_at desc,id desc limit v_page_size),
  page_rows as (
    select jsonb_build_object(
      'match',to_jsonb(pm)-'picks_count'-'selected_picks'-'has_verified_result',
      'result',(select jsonb_build_object('id',r.id,'owner_id',r.owner_id,'match_id',r.match_id,'home_score',r.home_score,'away_score',r.away_score,'outcome_1x2',r.outcome_1x2,'verified',r.verified,'source',r.source,'finished_at',r.finished_at,'verified_at',r.verified_at,'created_at',r.created_at)
        from public.match_results r where r.owner_id=pm.owner_id and r.match_id=pm.id order by r.verified desc,r.created_at desc limit 1),
      'picks',coalesce((select jsonb_agg(jsonb_build_object(
        'id',p.id,'owner_id',p.owner_id,'match_id',p.match_id,'model_version',p.model_version,'market',p.market,'selection',p.selection,
        'probability',p.probability,'confidence',p.confidence,'verdict',p.verdict,'rationale',p.rationale,'created_at',p.created_at,'group_name',p.group_name,
        'odds',p.odds,'settlement_status',p.settlement_status,'verified',p.verified,'stake',p.stake,'potential_return',p.potential_return,'profit_loss',p.profit_loss
      ) order by p.created_at desc,p.id desc) from public.predictions p
        where p.owner_id=pm.owner_id and p.match_id=pm.id and (p.model_version='MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')),'[]'::jsonb)
    ) item,pm.kickoff_at,pm.id from page_matches pm
  ),
  counts as (
    select count(*)::integer matches_count,coalesce(sum(picks_count),0)::integer picks_count,coalesce(sum(selected_picks),0)::integer selected_picks,
      count(*) filter(where has_verified_result)::integer verified,
      count(*) filter(where status='finished' and not has_verified_result)::integer needs_result
    from scoped_matches
  ),
  cursor_row as (select kickoff_at,id from page_matches order by kickoff_at asc,id asc limit 1)
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(item order by kickoff_at desc,id desc) from page_rows),'[]'::jsonb),
    'has_more',(select count(*)>v_page_size from page_plus),
    'next_cursor',case when (select count(*)>v_page_size from page_plus) then (select jsonb_build_object('kickoff_at',kickoff_at,'id',id) from cursor_row) else null end,
    'matches_count',(select matches_count from counts),'picks_count',(select picks_count from counts),
    'selected_picks',(select selected_picks from counts),'verified',(select verified from counts),'needs_result',(select needs_result from counts)
  ) into v_result;
  return v_result;
end;
$function$;

revoke all on function public.moneyball_results_page(text,text,timestamptz,uuid,integer) from public;
revoke all on function public.moneyball_results_page(text,text,timestamptz,uuid,integer) from anon;
grant execute on function public.moneyball_results_page(text,text,timestamptz,uuid,integer) to authenticated;
