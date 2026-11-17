create or replace function public.moneyball_is_eligible_european_match(
  p_country text,
  p_competition text,
  p_gender text,
  p_home_team text,
  p_away_team text
)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select public.moneyball_is_european_top_two_league(p_country,p_competition)
    and coalesce(nullif(lower(p_gender),''),'men')='men'
    and coalesce(p_competition,'') !~* '(^|[^a-z0-9])(uefa|nations league|national team|international|world cup|euro|friendly|cup|copa|trophy|qualification|qualifying)([^a-z0-9]|$)'
    and concat_ws(' ',p_competition,p_home_team,p_away_team) !~* '(^|[^a-z0-9])(women|womens|woman|frauen|femenina|femenino|feminin|female|ladies|girls|academy|youth|juniors?|u[[:space:]]*(15|16|17|18|19|20|21|23)|under[[:space:]-]*(15|16|17|18|19|20|21|23))([^a-z0-9]|$)'
    and coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(ii|iii|b)$'
    and coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(ii|iii|b)$';
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_dashboard_selected_picks()
 RETURNS TABLE(prediction_id uuid, market text, selection text, probability numeric, odds numeric, settlement_status text, match_id uuid, home_team text, away_team text, competition text, league text, kickoff_at timestamp with time zone, kickoff_date date, match_status text, home_score integer, away_score integer, rationale text, confidence text, data_coverage jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    p.id, p.market, p.selection, p.probability, p.odds, p.settlement_status,
    m.id, m.home_team, m.away_team, m.competition, m.league, m.kickoff_at,
    m.kickoff_date, m.status, r.home_score, r.away_score,
    p.rationale, p.confidence, p.data_coverage
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
  left join public.match_results r on r.match_id = m.id and r.owner_id = m.owner_id
  where p.owner_id = (select auth.uid())
    and m.owner_id = (select auth.uid())
    and (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    and p.verdict = 'WYBRANY'
    and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
    and m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
    and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
  order by m.kickoff_at asc nulls last, p.created_at desc
  limit 100;
$function$


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
  join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id
  join owner_scope o on p.owner_id = o.owner_id
  where (p.model_version = 'MONEYBALL GLOBAL 3.8' or p.model_version like 'MANUAL%')
    and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
    and m.kickoff_at >= (((now() at time zone 'Europe/Brussels')::date)::timestamp at time zone 'Europe/Brussels')
    and m.kickoff_at < ((((now() at time zone 'Europe/Brussels')::date + 1)::timestamp) at time zone 'Europe/Brussels')
    and m.status not in ('finished','postponed','cancelled','live')
    and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
      and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
      and coalesce(m.gender, 'men') = 'men' and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
$function$


CREATE OR REPLACE FUNCTION public.moneyball_prediction_scan_page(p_owner_id uuid, p_date date, p_cursor_kickoff_at timestamp with time zone, p_cursor_match_id uuid, p_limit integer, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare v_rows jsonb; v_count integer; v_limit integer:=greatest(1,least(coalesce(p_limit,10),10));
begin
  if not public.moneyball_cron_token_valid(p_token) then raise exception 'invalid cron token' using errcode='42501'; end if;
  if p_owner_id is distinct from public.moneyball_cron_owner_id(p_token) then raise exception 'owner mismatch' using errcode='42501'; end if;
  with ranked as (
    select m.*,
      row_number() over (
        partition by coalesce(m.kickoff_at at time zone 'Europe/Brussels',m.kickoff_date::timestamp,p_date::timestamp)::date,
          regexp_replace(lower(coalesce(m.home_team,'')),'[^a-z0-9]+','','g'),
          regexp_replace(lower(coalesce(m.away_team,'')),'[^a-z0-9]+','','g'),
          coalesce(nullif(lower(m.gender),''),'men')
        order by (lower(coalesce(m.source,''))='footynomad') desc,(m.kickoff_at is not null) desc,m.updated_at desc,m.id
      ) duplicate_rank
    from public.matches m
    where m.owner_id=p_owner_id
      and ((m.kickoff_at >= (p_date::timestamp at time zone 'Europe/Brussels') and m.kickoff_at < ((p_date+1)::timestamp at time zone 'Europe/Brussels'))
        or (m.kickoff_at is null and m.kickoff_date=p_date))
      and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
      and (lower(coalesce(m.gender,''))='men' or coalesce(m.gender,'')='')
      and concat_ws(' ',m.competition,m.league,m.home_team,m.away_team) !~* '\m(women|womens|woman|frauen|femenina|femenino|feminin|female|damallsvenskan|wsl|liga[ -]?f|u(15|16|17|18|19|20|21|23)|under[ -]?(15|16|17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|ii|iii|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico)\M'
  ), eligible as (select * from ranked where duplicate_rank=1),
  page as (
    select * from eligible e
    where p_cursor_match_id is null
       or (p_cursor_kickoff_at is not null and ((e.kickoff_at is not null and (e.kickoff_at,e.id)>(p_cursor_kickoff_at,p_cursor_match_id)) or e.kickoff_at is null))
       or (p_cursor_kickoff_at is null and e.kickoff_at is null and e.id>p_cursor_match_id)
    order by e.kickoff_at asc nulls last,e.id asc limit v_limit+1
  )
  select count(*),coalesce(jsonb_agg(to_jsonb(x) order by x.kickoff_at asc nulls last,x.id asc) filter (where x.rn<=v_limit),'[]'::jsonb)
    into v_count,v_rows
  from (select p.*,row_number() over(order by p.kickoff_at asc nulls last,p.id asc) rn from page p) x;
  return jsonb_build_object('rows',v_rows,'has_more',v_count>v_limit,'count',least(v_count,v_limit));
end
$function$

