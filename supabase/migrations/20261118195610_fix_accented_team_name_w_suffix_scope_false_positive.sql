CREATE OR REPLACE FUNCTION public.moneyball_is_eligible_european_match(
  p_country text,
  p_competition text,
  p_gender text,
  p_home_team text,
  p_away_team text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT public.moneyball_is_european_top_two_league(p_country,p_competition)
    AND lower(btrim(coalesce(p_gender,''))) IN ('men','male','m','mens','men senior')
    AND coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|ladies|girls|wfc|fcw)([^a-z0-9]|$)'
    AND coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|ladies|girls|wfc|fcw)([^a-z0-9]|$)'
    AND coalesce(p_home_team,'') !~* '(^|[^a-z0-9])(reserves?|academy|youth|u[0-9]{1,2}|under[ -]*[0-9]{1,2}|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico|ii|iii|b)$'
    AND coalesce(p_away_team,'') !~* '(^|[^a-z0-9])(reserves?|academy|youth|u[0-9]{1,2}|under[ -]*[0-9]{1,2}|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico|ii|iii|b)$'
    -- Case-sensitive uppercase W suffix matches the actual women's marker.
    -- Do not case-fold it: legitimate men's club names such as Barycz Sułów end in lowercase w.
    AND btrim(coalesce(p_home_team,'')) !~ '(^|[[:space:]])W$'
    AND btrim(coalesce(p_away_team,'')) !~ '(^|[[:space:]])W$';
$function$;

DO $validation$
BEGIN
  IF NOT public.moneyball_is_eligible_european_match('Poland','III Liga - Group 3','men','Barycz Sułów','Polonia Nysa') THEN
    RAISE EXCEPTION 'Barycz Sułów must not be misclassified as a women''s team';
  END IF;
  IF public.moneyball_is_eligible_european_match('Sweden','Damallsvenskan','men','Häcken','Rosengård') THEN
    RAISE EXCEPTION 'Women''s competition must remain excluded';
  END IF;
  IF public.moneyball_is_eligible_european_match('Sweden','Division 1','men','Häcken W','Rosengård') THEN
    RAISE EXCEPTION 'Explicit uppercase W team suffix must remain excluded';
  END IF;
END;
$validation$;
