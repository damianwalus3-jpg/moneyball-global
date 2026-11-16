-- Use one consistent dashboard scope: European domestic top-two divisions only.
CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(p_country text, p_competition text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT
    lower(coalesce(p_country,'')) = ANY (ARRAY[
      'albania','andorra','armenia','austria','azerbaijan','belarus','belgium','bosnia and herzegovina',
      'bulgaria','croatia','cyprus','czechia','czech republic','denmark','england','estonia','faroe islands',
      'finland','france','georgia','germany','gibraltar','greece','hungary','iceland','ireland','isle of man',
      'italy','kazakhstan','kosovo','latvia','liechtenstein','lithuania','luxembourg','malta','moldova',
      'monaco','montenegro','netherlands','north macedonia','northern ireland','norway','poland','portugal',
      'romania','russia','san marino','scotland','serbia','slovakia','slovenia','spain','sweden','switzerland',
      'turkey','türkiye','ukraine','wales','united kingdom','uk',
      'alb','and','arm','aut','aze','blr','bel','bih','bul','cro','cyp','cze','dnk','eng','est','fro','fin',
      'fra','geo','deu','ger','gib','grc','gre','hun','isl','irl','ita','kaz','kos','lva','lie','ltu','lux',
      'mlt','mda','mne','nld','mkd','nir','nor','pol','prt','por','rou','rus','smr','sco','srb','svk','svn',
      'esp','swe','che','sui','tur','ukr','wal','gbr','uk'
    ])
    AND coalesce(p_competition,'') <> ''
    AND coalesce(p_competition,'') !~* $youth$(\m(u(17|18|19|20|21|23)|under ?(17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team)\M)$youth$
    AND coalesce(p_competition,'') !~* $lower$(\m(3|4|5|6|7|8|9|iii|iv|v|vi)\s*\.?\s*(liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)\M|\m(third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\M)$lower$
    AND coalesce(p_competition,'') ~* $top$(\m(premier league|premiership|championship|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|2 bundesliga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|segunda division|segunda liga|eredivisie|keuken kampioen divisie|primeira liga|ekstraklasa|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|prva liga|hnl|1 hnl|2 hnl|first league|second league|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|virsliga|meistriliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|premier division|league of ireland premier|league of ireland first|scottish championship)\M)$top$;
$function$;

-- Keep the dashboard candidate count aligned with the coupon generator:
-- only count active, selected predictions for matches kicking off today in Brussels.
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
    and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
    and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
      and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
      and public.moneyball_is_european_top_two_league(m.country, coalesce(m.competition,m.league))
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
