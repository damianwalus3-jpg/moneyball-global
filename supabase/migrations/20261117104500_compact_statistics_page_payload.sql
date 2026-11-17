-- Compact the statistics payload to the fields the statistics UI actually renders.
-- This avoids sending large free-form notes/rationales for every historical prediction.
create or replace function public.moneyball_statistics_page_data()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return (
    with eligible_matches as materialized (
      select
        m.id,
        m.competition,
        m.country,
        m.gender,
        m.home_team,
        m.away_team,
        m.kickoff_at,
        m.league,
        m.kickoff_date,
        result.home_score,
        result.away_score
      from public.matches m
      left join lateral (
        select r.home_score, r.away_score
        from public.match_results r
        where r.owner_id = m.owner_id
          and r.match_id = m.id
          and r.verified is true
        order by r.verified_at desc nulls last, r.created_at desc
        limit 1
      ) result on true
      where m.owner_id = v_owner
        and public.moneyball_is_eligible_european_match(
          m.country, coalesce(m.competition, m.league), m.gender, m.home_team, m.away_team
        )
    ),
    active_predictions as (
      select
        p.id,
        p.match_id,
        p.model_version,
        p.market,
        p.selection,
        p.probability,
        p.verdict,
        p.odds,
        p.settlement_status,
        p.verified,
        p.stake,
        p.potential_return,
        p.profit_loss
      from public.predictions p
      where p.owner_id = v_owner
        and (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
        and exists (select 1 from eligible_matches m where m.id = p.match_id)
    ),
    scoped_coupon_ids as (
      select c.id
      from public.coupons c
      where c.owner_id = v_owner
        and exists (
          select 1 from public.coupon_legs l
          where l.owner_id = v_owner and l.coupon_id = c.id
        )
        and not exists (
          select 1
          from public.coupon_legs l
          where l.owner_id = v_owner
            and l.coupon_id = c.id
            and not exists (select 1 from eligible_matches m where m.id = l.match_id)
        )
    ),
    scoped_coupons as (
      select c.id, c.status, c.stake
      from public.coupons c
      join scoped_coupon_ids ids on ids.id = c.id
      where c.owner_id = v_owner
    ),
    scoped_legs as (
      select l.id, l.coupon_id, l.match_id, l.odds, l.status
      from public.coupon_legs l
      join scoped_coupon_ids ids on ids.id = l.coupon_id
      where l.owner_id = v_owner
    )
    select jsonb_build_object(
      'matches', coalesce(
        (select jsonb_agg(to_jsonb(m) order by m.kickoff_at asc nulls last, m.id)
         from eligible_matches m),
        '[]'::jsonb
      ),
      'predictions', coalesce(
        (select jsonb_agg(to_jsonb(p) order by p.model_version, p.market, p.match_id, p.selection)
         from active_predictions p),
        '[]'::jsonb
      ),
      'coupons', coalesce(
        (select jsonb_agg(to_jsonb(c) order by c.id)
         from scoped_coupons c),
        '[]'::jsonb
      ),
      'legs', coalesce(
        (select jsonb_agg(to_jsonb(l) order by l.coupon_id, l.id)
         from scoped_legs l),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.moneyball_statistics_page_data() from public, anon;
grant execute on function public.moneyball_statistics_page_data() to authenticated;

comment on function public.moneyball_statistics_page_data()
is 'Compact owner-scoped statistics payload with eligible fixtures, active model predictions and stored stake/P&L fields; excludes bulky notes and coverage metadata.';
