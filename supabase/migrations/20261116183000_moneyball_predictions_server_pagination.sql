create or replace function public.moneyball_predictions_page(
  p_market text,
  p_model_scope text default 'current',
  p_verdict text default 'all',
  p_search text default '',
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_result jsonb;
begin
  if p_market not in ('1X2', 'DOUBLE_CHANCE', 'GOALS') then
    raise exception 'Invalid market';
  end if;
  if coalesce(p_model_scope, 'current') not in ('current', 'all') then
    raise exception 'Invalid model scope';
  end if;
  if coalesce(p_verdict, 'all') not in ('all', 'WYBRANY', 'ODRZUCONY') then
    raise exception 'Invalid verdict';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'Cursor must contain both created_at and id';
  end if;

  with base as (
    select p.*
    from public.predictions p
    where p.owner_id = (select auth.uid())
      and p.market = p_market
      and (
        p_model_scope = 'all'
        or p.model_version = 'MONEYBALL GLOBAL 3.8'
        or p.model_version like 'MANUAL%'
      )
  ),
  filtered as (
    select b.*
    from base b
    where (p_verdict = 'all' or b.verdict = p_verdict)
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or exists (
          select 1
          from public.matches m
          where m.id = b.match_id
            and m.owner_id = b.owner_id
            and concat_ws(' ', m.home_team, m.away_team, m.competition, m.league, m.country)
              ilike '%' || btrim(p_search) || '%'
        )
      )
  ),
  page_plus as (
    select f.*, row_number() over (order by f.created_at desc, f.id desc) as rn
    from filtered f
    where p_before_created_at is null
      or (f.created_at, f.id) < (p_before_created_at, p_before_id)
    order by f.created_at desc, f.id desc
    limit v_page_size + 1
  ),
  page_rows as (
    select to_jsonb(p) - 'rn' as item, p.created_at, p.id, p.rn
    from page_plus p
    where p.rn <= v_page_size
  ),
  counts as (
    select
      count(*)::integer as total_count,
      count(*) filter (where settlement_status = 'pending')::integer as pending_count
    from filtered
  ),
  stats as (
    select
      count(*) filter (where verdict = 'WYBRANY' and verified and settlement_status = 'won')::integer as won,
      count(*) filter (where verdict = 'WYBRANY' and verified and settlement_status in ('won', 'lost'))::integer as settled
    from base
  ),
  cursor_row as (
    select created_at, id
    from page_rows
    order by created_at asc, id asc
    limit 1
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(item order by created_at desc, id desc) from page_rows), '[]'::jsonb),
    'has_more', (select count(*) > v_page_size from page_plus),
    'next_cursor', case
      when (select count(*) > v_page_size from page_plus)
      then (select jsonb_build_object('created_at', created_at, 'id', id) from cursor_row)
      else null
    end,
    'total_count', (select total_count from counts),
    'pending_count', (select pending_count from counts),
    'won', (select won from stats),
    'settled', (select settled from stats)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.moneyball_predictions_page(text, text, text, text, timestamptz, uuid, integer) from public;
revoke all on function public.moneyball_predictions_page(text, text, text, text, timestamptz, uuid, integer) from anon;
grant execute on function public.moneyball_predictions_page(text, text, text, text, timestamptz, uuid, integer) to authenticated;
