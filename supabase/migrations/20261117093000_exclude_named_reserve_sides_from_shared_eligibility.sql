-- Keep the shared eligibility predicate authoritative for every dashboard and scan caller.
-- Named B/reserve sides do not always carry an II/III/B suffix or a reserve gender flag.
create or replace function public.moneyball_is_eligible_european_match(
  p_country text,
  p_competition text,
  p_gender text,
  p_home_team text,
  p_away_team text
) returns boolean
language sql
immutable
set search_path = ''
as $function$
  select public.moneyball_is_european_top_two_league(p_country,p_competition)
    and coalesce(nullif(lower(p_gender),''),'men')='men'
    and coalesce(p_competition,'') !~* '(^|[^a-z0-9])(uefa|nations league|national team|international|world cup|euro|friendly|cup|copa|trophy|qualification|qualifying)([^a-z0-9]|$)'
    and concat_ws(' ',p_competition,p_home_team,p_away_team) !~* '(^|[^a-z0-9])(women|womens|woman|frauen|femenina|femenino|feminin|female|ladies|girls|academy|youth|juniors?|u[[:space:]]*(15|16|17|18|19|20|21|23)|under[[:space:]-]*(15|16|17|18|19|20|21|23))([^a-z0-9]|$)'
    and concat_ws(' ',p_home_team,p_away_team) !~* '(^|[^a-z0-9])(reserves?|academy|youth|b[[:space:]]+team|celta[[:space:]]+fortuna|real[[:space:]]+madrid[[:space:]]+castilla|valencia[[:space:]]+mestalla|betis[[:space:]]+deportivo|sevilla[[:space:]]+atl[eé]tico)([^a-z0-9]|$)'
    and coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(ii|iii|b)$'
    and coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(ii|iii|b)$';
$function$;

comment on function public.moneyball_is_eligible_european_match(text,text,text,text,text)
is 'Shared authoritative predicate for European domestic senior men tier 1/2 fixtures; rejects women, youth, cups, lower tiers, B/reserve sides and known named Spanish reserve teams.';
