-- Correct PostgreSQL word-boundary escapes in the league and fixture filters.
-- PostgreSQL ARE word boundaries use a single backslash (\m, \M).
-- Previous double-escaped forms silently failed to exclude some reserves/youth teams.

CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(p_country text, p_competition text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH normalized AS (
    SELECT
      translate(lower(coalesce(p_competition,'')), 'áéíóúüñç', 'aeiouunc') AS raw_comp,
      regexp_replace(translate(lower(coalesce(p_competition,'')), 'áéíóúüñç', 'aeiouunc'), '[^a-z0-9]+', ' ', 'g') AS comp
  )
  SELECT lower(coalesce(p_country,'')) = ANY (ARRAY[
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
  AND normalized.comp <> ''
  AND normalized.comp !~* $youth$(\m(u(15|16|17|18|19|20|21|23)|under ?(15|16|17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|cup|copa|trophy|play-?offs?|women|woman|female|frauen|damen|feminine|femminile|femenina|ladies|girls)\M)$youth$
  AND normalized.comp !~* $lower$(\mdruha liga\M|\m(3|4|5|6|7|8|9|iii|iv|v|vi)\s*(liga|league|division|div|bundesliga|serie|snl|hnl|federal|federation)\M|\m(third|fourth|fifth|regional|regionalliga|oberliga|national league north|national league south|non league|non-league)\M)$lower$
  AND normalized.comp ~* $top$(\m(premier league|premiership|championship|super league 2|super league|superliga|super lig|pro league|jupiler pro league|challenger pro league|bundesliga|2 bundesliga|ligue 1|ligue 2|serie a|serie b|la liga|laliga|2 segunda division|segunda division|segunda liga|eredivisie|keuken kampioen divisie|primeira liga|ekstraklasa|1 lig|2 lig|1 liga|2 liga|liga i|liga ii|liga 1|liga 2|prva liga|persha liga|liga e pare|hnl|1 hnl|2 hnl|first league|second league|first division|second division|division 1|division 2|div 1|div 2|1st division|2nd division|1st league|2nd league|a lyga|virsliga|meistriliiga|veikkausliiga|ykkosliiga|allsvenskan|superettan|eliteserien|obos ligaen|premier division|league of ireland premier|league of ireland first|scottish championship)\M)$top$
  FROM normalized;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_prediction_scan_page(
  p_owner_id uuid, p_date date, p_cursor_kickoff_at timestamptz, p_cursor_match_id uuid, p_limit integer, p_token text
)
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
      and public.moneyball_is_european_top_two_league(m.country,coalesce(m.competition,m.league))
      and (lower(coalesce(m.gender,''))='men' or coalesce(m.gender,'')='')
      and concat_ws(' ',m.competition,m.league,m.home_team,m.away_team) !~* '\m(women|womens|woman|frauen|femenina|femenino|feminin|female|damallsvenskan|wsl|liga[ -]?f|u(15|16|17|18|19|20|21|23)|under[ -]?(15|16|17|18|19|20|21|23)|youth|juniors?|academy|juvenil|jugend|reserves?|b team|ii|iii)\M'
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
$function$;
