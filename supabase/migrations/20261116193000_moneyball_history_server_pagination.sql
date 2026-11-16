create or replace function public.moneyball_history_page(
  p_tab text default 'todo',
  p_search text default '',
  p_before_sort_at timestamptz default null,
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
  if coalesce(p_tab, 'todo') not in ('todo', 'done') then
    raise exception 'Invalid history tab';
  end if;
  if (p_before_sort_at is null) <> (p_before_id is null) then
    raise exception 'Cursor must contain both sort_at and id';
  end if;

  with pending_selected as materialized (
    select p.owner_id, p.match_id
    from public.predictions p
    where p.owner_id = (select auth.uid())
      and p.verdict = 'WYBRANY'
      and p.settlement_status = 'pending'
    group by p.owner_id, p.match_id
  ),
  pending_coupon as materialized (
    select cl.owner_id, cl.match_id
    from public.coupon_legs cl
    join public.predictions p on p.id = cl.prediction_id and p.owner_id = cl.owner_id
    where cl.owner_id = (select auth.uid())
      and cl.status = 'pending'
      and cl.match_id is not null
      and p.verdict = 'WYBRANY'
    group by cl.owner_id, cl.match_id
  ),
  verified_results as materialized (
    select r.owner_id, r.match_id
    from public.match_results r
    where r.owner_id = (select auth.uid())
      and r.verified
    group by r.owner_id, r.match_id
  ),
  history_candidates as materialized (
    select
      m.*,
      coalesce(m.kickoff_at, '0001-01-01 00:00:00+00'::timestamptz) as sort_at,
      (
        m.kickoff_at < now()
        and m.status not in ('cancelled', 'postponed')
        and vr.match_id is null
        and (ps.match_id is not null or pc.match_id is not null)
      ) as is_todo,
      (vr.match_id is not null or m.status in ('cancelled', 'postponed')) as is_done
    from public.matches m
    left join pending_selected ps on ps.owner_id = m.owner_id and ps.match_id = m.id
    left join pending_coupon pc on pc.owner_id = m.owner_id and pc.match_id = m.id
    left join verified_results vr on vr.owner_id = m.owner_id and vr.match_id = m.id
    where m.owner_id = (select auth.uid())
  ),
  scoped as materialized (
    select * from history_candidates
    where (p_tab = 'todo' and is_todo) or (p_tab = 'done' and is_done)
  ),
  filtered as materialized (
    select * from scoped
    where nullif(btrim(coalesce(p_search, '')), '') is null
      or concat_ws(' ', home_team, away_team, competition, league)
        ilike '%' || btrim(p_search) || '%'
  ),
  page_plus as (
    select f.*
    from filtered f
    where p_before_sort_at is null
      or (p_tab = 'todo' and (f.sort_at, f.id) > (p_before_sort_at, p_before_id))
      or (p_tab = 'done' and (f.sort_at, f.id) < (p_before_sort_at, p_before_id))
    order by
      case when p_tab = 'todo' then f.sort_at end asc,
      case when p_tab = 'done' then f.sort_at end desc,
      case when p_tab = 'todo' then f.id end asc,
      case when p_tab = 'done' then f.id end desc
    limit v_page_size + 1
  ),
  page_matches as (
    select * from page_plus
    order by
      case when p_tab = 'todo' then sort_at end asc,
      case when p_tab = 'done' then sort_at end desc,
      case when p_tab = 'todo' then id end asc,
      case when p_tab = 'done' then id end desc
    limit v_page_size
  ),
  page_rows as (
    select
      jsonb_build_object(
        'match', to_jsonb(pm) - 'sort_at' - 'is_todo' - 'is_done',
        'result', (
          select jsonb_build_object(
            'id', r.id, 'owner_id', r.owner_id, 'match_id', r.match_id,
            'home_score', r.home_score, 'away_score', r.away_score,
            'outcome_1x2', r.outcome_1x2, 'verified', r.verified,
            'source', r.source, 'finished_at', r.finished_at,
            'verified_at', r.verified_at, 'created_at', r.created_at
          )
          from public.match_results r
          where r.owner_id = pm.owner_id and r.match_id = pm.id
          order by r.created_at desc
          limit 1
        ),
        'predictions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id, 'owner_id', p.owner_id, 'match_id', p.match_id,
            'model_version', p.model_version, 'market', p.market, 'selection', p.selection,
            'probability', p.probability, 'confidence', p.confidence, 'verdict', p.verdict,
            'rationale', p.rationale, 'created_at', p.created_at, 'group_name', p.group_name,
            'odds', p.odds, 'settlement_status', p.settlement_status, 'verified', p.verified,
            'stake', p.stake, 'potential_return', p.potential_return, 'profit_loss', p.profit_loss
          ) order by p.created_at desc, p.id desc)
          from public.predictions p
          where p.owner_id = pm.owner_id and p.match_id = pm.id
        ), '[]'::jsonb)
      ) as item,
      pm.sort_at,
      pm.id
    from page_matches pm
  ),
  counts as (
    select
      count(*) filter (where is_todo)::integer as todo_count,
      count(*) filter (where is_done)::integer as done_count,
      (select count(*)::integer from filtered) as matches_count
    from history_candidates
  ),
  cursor_row as (
    select sort_at, id
    from page_matches
    order by
      case when p_tab = 'todo' then sort_at end desc,
      case when p_tab = 'done' then sort_at end asc,
      case when p_tab = 'todo' then id end desc,
      case when p_tab = 'done' then id end asc
    limit 1
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(item order by
        case when p_tab = 'todo' then sort_at end asc,
        case when p_tab = 'done' then sort_at end desc,
        case when p_tab = 'todo' then id end asc,
        case when p_tab = 'done' then id end desc
      ) from page_rows
    ), '[]'::jsonb),
    'has_more', (select count(*) > v_page_size from page_plus),
    'next_cursor', case
      when (select count(*) > v_page_size from page_plus)
      then (select jsonb_build_object('sort_at', sort_at, 'id', id) from cursor_row)
      else null
    end,
    'todo_count', (select todo_count from counts),
    'done_count', (select done_count from counts),
    'matches_count', (select matches_count from counts)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.moneyball_history_page(text, text, timestamptz, uuid, integer) from public;
revoke all on function public.moneyball_history_page(text, text, timestamptz, uuid, integer) from anon;
grant execute on function public.moneyball_history_page(text, text, timestamptz, uuid, integer) to authenticated;
