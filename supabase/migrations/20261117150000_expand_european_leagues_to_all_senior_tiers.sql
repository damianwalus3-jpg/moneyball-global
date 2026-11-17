-- Expand from domestic tiers 1-2 to ALL senior men's domestic league tiers.
-- Keep the historical function name as a compatibility wrapper for existing RPCs.
-- Historical rows are intentionally preserved.

CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(
  p_country text, p_competition text
) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT public.moneyball_is_geographic_europe_country(p_country)
    AND nullif(btrim(coalesce(p_competition,'')), '') IS NOT NULL
    AND coalesce(p_competition,'') !~* '(^|[^a-z0-9])(uefa|fifa|nations league|champions league|europa league|conference league|international|world cup|euro|friendly|cup|copa|coppa|supercopa|supercoppa|supercup|coupe|pokal|trophy|shield|super cup|ta[cç]a|kupa|kup|puchar|cupa|qualification|qualifying|play ?offs?)([^a-z0-9]|$)';
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_is_eligible_european_match(
  p_country text, p_competition text, p_gender text, p_home_team text, p_away_team text
) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $function$
  SELECT public.moneyball_is_geographic_europe_country(p_country)
    AND nullif(btrim(coalesce(p_competition,'')), '') IS NOT NULL
    AND coalesce(nullif(lower(p_gender),''),'men') = 'men'
    AND coalesce(p_competition,'') !~* '(^|[^a-z0-9])(uefa|fifa|nations league|champions league|europa league|conference league|national team|international|world cup|euro|friendly|cup|copa|coppa|coupe|pokal|trophy|shield|super cup|ta[cç]a|kupa|kup|puchar|cupa|qualification|qualifying|play ?offs?)([^a-z0-9]|$)'
    AND concat_ws(' ',p_competition,p_home_team,p_away_team) !~* '(^|[^a-z0-9])(women|womens|woman|frauen|femenina|femenino|feminin|female|damen|ladies|girls|academy|youth|juniors?|u[[:space:]]*[0-9]{1,2}|under[[:space:]-]*[0-9]{1,2}|premier league 2|professional development league)([^a-z0-9]|$)'
    AND concat_ws(' ',p_home_team,p_away_team) !~* '(^|[^a-z0-9])(reserves?|academy|youth|b[[:space:]]+team|celta[[:space:]]+fortuna|real[[:space:]]+madrid[[:space:]]+castilla|valencia[[:space:]]+mestalla|betis[[:space:]]+deportivo|sevilla[[:space:]]+atletico)([^a-z0-9]|$)'
    AND coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(ii|iii|b)$'
    AND coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(ii|iii|b)$';
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_guard_european_top_two_insert_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public, pg_temp
AS $function$
DECLARE
  fixture record;
  v_country text;
  v_competition text;
  v_gender text;
  v_home text;
  v_away text;
BEGIN
  IF tg_table_name = 'matches' THEN
    v_country := coalesce(new.country, '');
    v_competition := coalesce(new.competition, new.league, '');
    v_gender := coalesce(nullif(lower(new.gender), ''), 'men');
    v_home := coalesce(new.home_team, '');
    v_away := coalesce(new.away_team, '');
  ELSIF tg_table_name = 'predictions' THEN
    SELECT m.country, coalesce(m.competition, m.league, '') AS competition,
           coalesce(nullif(lower(m.gender), ''), 'men') AS gender,
           m.home_team, m.away_team
      INTO fixture FROM public.matches m
     WHERE m.id = new.match_id AND m.owner_id = coalesce(new.owner_id, new.user_id);
    IF NOT found THEN RETURN null; END IF;
    v_country := coalesce(fixture.country, '');
    v_competition := coalesce(fixture.competition, '');
    v_gender := fixture.gender;
    v_home := coalesce(fixture.home_team, '');
    v_away := coalesce(fixture.away_team, '');
  ELSE
    RETURN new;
  END IF;
  IF NOT public.moneyball_is_eligible_european_match(v_country,v_competition,v_gender,v_home,v_away) THEN
    RETURN null;
  END IF;
  RETURN new;
END;
$function$;

COMMENT ON FUNCTION public.moneyball_is_european_top_two_league(text,text)
IS 'Legacy compatibility predicate, broadened to all geographic-European domestic competition tiers; excludes cups and international competitions.';
COMMENT ON FUNCTION public.moneyball_is_eligible_european_match(text,text,text,text,text)
IS 'Canonical eligibility predicate for all geographic-European senior men's domestic league tiers; excludes cups, international, youth, women's and reserve fixtures.';
COMMENT ON FUNCTION public.moneyball_guard_european_top_two_insert_scope()
IS 'Legacy trigger name; enforces canonical all-tier geographic-European senior men's domestic league scope for new matches and predictions.';

DO $validation$
BEGIN
  IF public.moneyball_is_eligible_european_match('France','National 2 - Group C','men','Andrezieux','Chateauroux') IS DISTINCT FROM true THEN RAISE EXCEPTION 'French National 2 must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Czech Republic','3. liga - CFL B','men','Pardubice','Horni Redice') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Czech third league must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('England','National League - North','men','Oxford City','Macclesfield') IS DISTINCT FROM true THEN RAISE EXCEPTION 'English National League North must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Scotland','Football League - Lowland League','men','Brechin','Stirling University') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Scottish Lowland League must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Northern Ireland','Championship','men','Rathfriland','Moyola Park') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Northern Ireland Championship must remain eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Israel','Liga Leumit','men','Team A','Team B') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Israel must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('World','UEFA Nations League','men','Wales','Portugal') IS DISTINCT FROM false THEN RAISE EXCEPTION 'UEFA Nations League must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('England','EFL Trophy','men','Luton','Peterborough') IS DISTINCT FROM false THEN RAISE EXCEPTION 'EFL Trophy must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('Portugal','Liga Revelacao U23','men','Vizela U23','Santa Clara U23') IS DISTINCT FROM false THEN RAISE EXCEPTION 'U23 fixtures must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('Ukraine','Persha Liga','men','UCSA','Polissya II') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Polissya II must remain excluded'; END IF;
END;
$validation$;
