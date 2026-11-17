-- Manual dashboard scans must page over eligible fixtures, not raw match rows.
-- The old client-side filter ran after LIMIT/OFFSET and forced users through many
-- pages of out-of-scope fixtures before reaching the actual eligible matches.
create or replace function public.moneyball_manual_prediction_scan_page(
  p_date date,
  p_offset integer default 0,
  p_limit integer default 10
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_owner uuid := auth.uid();
  v_rows jsonb;
  v_count integer;
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 10));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  with ranked as (
    select
      m.*,
      row_number() over (
        partition by
          coalesce(m.kickoff_at at time zone 'Europe/Brussels', m.kickoff_date::timestamp, p_date::timestamp)::date,
          regexp_replace(lower(coalesce(m.home_team, '')), '[^a-z0-9]+', '', 'g'),
          regexp_replace(lower(coalesce(m.away_team, '')), '[^a-z0-9]+', '', 'g'),
          coalesce(nullif(lower(m.gender), ''), 'men')
        order by
          (lower(coalesce(m.source, '')) = 'footynomad') desc,
          (m.kickoff_at is not null) desc,
          m.updated_at desc,
          m.id
      ) as duplicate_rank
    from public.matches m
    where m.owner_id = v_owner
      and (
        (m.kickoff_at >= (p_date::timestamp at time zone 'Europe/Brussels')
          and m.kickoff_at < ((p_date + 1)::timestamp at time zone 'Europe/Brussels'))
        or (m.kickoff_at is null and m.kickoff_date = p_date)
      )
      and public.moneyball_is_eligible_european_match(
        m.country, coalesce(m.competition, m.league), m.gender, m.home_team, m.away_team
      )
      and concat_ws(' ', m.competition, m.league, m.home_team, m.away_team)
        !~* '\\m(reserves?|academy|youth|b team|ii|iii|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico)\\M'
  ),
  eligible as (
    select * from ranked where duplicate_rank = 1
  ),
  page as (
    select *
    from eligible
    order by kickoff_at asc nulls last, id asc
    offset v_offset
    limit v_limit + 1
  )
  select
    count(*),
    coalesce(
      jsonb_agg(to_jsonb(x) order by x.kickoff_at asc nulls last, x.id asc)
        filter (where x.rn <= v_limit),
      '[]'::jsonb
    )
  into v_count, v_rows
  from (
    select
      page.*,
      row_number() over (order by page.kickoff_at asc nulls last, page.id asc) as rn
    from page
  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'has_more', v_count > v_limit,
    'count', least(v_count, v_limit)
  );
end;
$$;

revoke all on function public.moneyball_manual_prediction_scan_page(date, integer, integer) from public, anon;
grant execute on function public.moneyball_manual_prediction_scan_page(date, integer, integer) to authenticated;

comment on function public.moneyball_manual_prediction_scan_page(date, integer, integer)
is 'Authenticated owner-scoped manual prediction pagination; filters and deduplicates eligible European senior top-two fixtures before offset/limit.';
