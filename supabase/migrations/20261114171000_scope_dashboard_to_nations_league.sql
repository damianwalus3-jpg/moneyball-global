CREATE OR REPLACE FUNCTION public.moneyball_dashboard_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
with owner_scope as (select auth.uid() as owner_id),
active_predictions as (
  select p.market, p.settlement_status, p.verified
  from public.predictions p
  join owner_scope o on p.owner_id = o.owner_id
  where p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%'
),
market_stats as (
  select market,
    count(*) filter (where verified and settlement_status = 'won')::integer as won,
    count(*) filter (where verified and settlement_status in ('won','lost'))::integer as settled
  from active_predictions group by market
),
candidate_count as (
  select count(distinct p.match_id)::integer as total
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
  join owner_scope o on p.owner_id = o.owner_id
  where (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    and p.verdict = 'WYBRANY' and p.settlement_status = 'pending'
    and p.probability > 75 and p.selection <> '—'
    and m.kickoff_at > now()
    and m.status not in ('finished','postponed','cancelled','live')
    and (m.competition ilike '%Nations League%' or m.league ilike '%Nations League%')
),
bankroll as (
  select case when count(*) = 0 then null
    else coalesce(
      (array_agg(balance_after order by occurred_at desc) filter (where balance_after is not null))[1],
      sum(case
        when transaction_type in ('deposit','return') then abs(amount)
        when transaction_type in ('withdrawal','stake') then -abs(amount)
        else amount end)
    ) end as balance
  from public.bankroll_transactions b
  join owner_scope o on b.owner_id = o.owner_id
)
select jsonb_build_object(
  'matches_today', (
    select count(*)::integer from public.matches m
    join owner_scope o on m.owner_id = o.owner_id
    where m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
      and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
      and (m.competition ilike '%Nations League%' or m.league ilike '%Nations League%')
  ),
  'bankroll', (select balance from bankroll),
  'coupons_in_play', (
    select count(*)::integer from public.coupons c
    join owner_scope o on c.owner_id = o.owner_id
    where coalesce(c.status, 'pending') = 'pending'
  ),
  'candidates', coalesce((select total from candidate_count), 0),
  'to_settle', (
    select count(*)::integer from public.matches m
    join owner_scope o on m.owner_id = o.owner_id
    where m.kickoff_at < now() and m.status not in ('finished','postponed','cancelled')
      and (m.competition ilike '%Nations League%' or m.league ilike '%Nations League%')
      and not exists (
        select 1 from public.match_results r
        where r.match_id = m.id and r.owner_id = m.owner_id and r.verified
      )
  ),
  'hit_rates', coalesce((
    select jsonb_object_agg(market, jsonb_build_object(
      'won', won, 'settled', settled,
      'rate', case when settled > 0 then round((won::numeric / settled::numeric) * 1000) / 10 else null end
    )) from market_stats
  ), '{}'::jsonb)
);
$function$;
