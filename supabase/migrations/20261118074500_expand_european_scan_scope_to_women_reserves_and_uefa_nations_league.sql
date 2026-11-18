-- Expand the production scan guard to the user's Europe-only scope:
-- all domestic league tiers, women's leagues and reserve sides, plus UEFA Nations League.
-- Continue excluding non-European countries, domestic/international cups, UEFA club cups,
-- qualifiers, youth competitions and friendlies. Historical match/prediction rows are preserved.

CREATE OR REPLACE FUNCTION public.moneyball_is_geographic_europe_country(p_country text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM regexp_split_to_table(coalesce(p_country,''), '[,\\/;|]+') AS part(value)
     WHERE regexp_replace(normalize(lower(btrim(part.value)), NFD), '[^a-z0-9]+', '', 'g') = ANY (ARRAY[
       'albania','andorra','armenia','austria','azerbaijan','belarus','belgium','bosnia','bosniaandherzegovina','bosniaherzegovina',
       'bulgaria','croatia','cyprus','czechia','czechrepublic','denmark','england','estonia',
       'faroeislands','finland','france','georgia','germany','gibraltar','greece','guernsey',
       'hungary','iceland','ireland','republicofireland','isleofman','italy','jersey',
       'kosovo','latvia','liechtenstein','lithuania','luxembourg','malta','moldova',
       'monaco','montenegro','netherlands','northmacedonia','macedonia','northernireland',
       'norway','poland','portugal','romania','russia','russianfederation','sanmarino',
       'scotland','serbia','slovakia','slovenia','spain','sweden','switzerland','turkey','turkiye','ukraine','wales',
       'unitedkingdom','unitedkingdomofgreatbritainandnorthernireland','greatbritain',
       'alandislands','svalbardandjanmayenislands','holysee','vaticancity',
       'alb','and','arm','aut','aze','blr','bel','bih','bgr','bul','hrv','cro','cyp','cze','dnk','est',
       'fro','fin','fra','geo','deu','ger','gib','grc','gre','ggy','hun','isl','irl','imn',
       'ita','jey','lva','lie','ltu','lux','mlt','mda','mco','mne','nld','mkd','nor',
       'pol','prt','por','rou','rus','smr','srb','svk','svn','esp','swe','che','sui','tur','tür',
       'ukr','gbr','gb','uk','eng','sco','wal','nir','kos','xkx','ala','sjm','vat'
     ])
  );
$function$;

-- Legacy function name retained for existing RPC compatibility; it now means
-- any eligible European domestic league tier or UEFA Nations League.
CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(p_country text,p_competition text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN lower(btrim(coalesce(p_competition,''))) ~ '^uefa[[:space:]]+(women''?s[[:space:]]+)?nations league([[:space:]:-].*)?$'
      THEN true
    ELSE
      public.moneyball_is_geographic_europe_country(p_country)
      AND nullif(btrim(coalesce(p_competition,'')), '') IS NOT NULL
      AND coalesce(p_competition,'') ~* '(^|[^a-z0-9])(league|liga|ligue|lig|division|divisions|división|divizia|divizija|serie|bundesliga|eredivisie|premier|championship|superliga|premiership|ekstraliga|ekstraklasa|oberliga|regionalliga|national|deild|virsliga|meistriliiga|veikkausliiga|allsvenskan|superettan|eliteserien|toppserien|kakkonen|ykkosliiga|lowland|highland|non league|first league|second league|third league|first division|second division|third division|division 1|division 2|division 3|league one|league two|prva|hnl|2\\. lig|3\\. lig)([^a-z0-9]|$)'
      AND coalesce(p_competition,'') !~* '(^|[^a-z0-9])(cup|copa|coppa|coupe|pokal|trophy|shield|super cup|ta[cç]a|kupa|kup|puchar|cupa|qualification|qualifying|qualifier|friendly|friendlies|champions league|europa league|conference league|world cup|euro|national team|international|youth|academy|juniors?|u[[:space:]]*[0-9]{1,2}|under[[:space:]-]*[0-9]{1,2}|premier league 2|professional development league|elite league)([^a-z0-9]|$)'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_is_eligible_european_match(
  p_country text,p_competition text,p_gender text,p_home_team text,p_away_team text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT public.moneyball_is_european_top_two_league(p_country,p_competition)
    AND coalesce(p_competition,'') !~* '(^|[^a-z0-9])(youth|academy|juniors?|u[[:space:]]*[0-9]{1,2}|under[[:space:]-]*[0-9]{1,2}|development league|elite league|premier league 2)([^a-z0-9]|$)';
$function$;

COMMENT ON FUNCTION public.moneyball_is_european_top_two_league(text,text)
IS 'Legacy compatibility predicate, broadened to all European domestic league tiers and UEFA Nations League; excludes cups, qualifiers, youth and friendlies.';
COMMENT ON FUNCTION public.moneyball_is_eligible_european_match(text,text,text,text,text)
IS 'Canonical scope: European domestic league competitions at all senior tiers, all genders and reserve sides, plus UEFA Nations League; excludes cups, non-UNL international events, qualifiers, youth tournaments and friendlies.';

DO $validation$
BEGIN
  IF public.moneyball_is_geographic_europe_country('Turkey') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Turkey must be included in European football scope'; END IF;
  IF public.moneyball_is_geographic_europe_country('Cyprus') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cyprus must be included in European football scope'; END IF;
  IF public.moneyball_is_geographic_europe_country('Armenia') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Armenia must be included in European football scope'; END IF;
  IF public.moneyball_is_geographic_europe_country('Azerbaijan') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Azerbaijan must be included in European football scope'; END IF;
  IF public.moneyball_is_geographic_europe_country('Georgia') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Georgia must be included in European football scope'; END IF;
  IF public.moneyball_is_geographic_europe_country('Kazakhstan') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Kazakhstan must remain excluded from geographic Europe domestic scope'; END IF;
  IF public.moneyball_is_geographic_europe_country('Israel') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Israel must remain excluded from geographic Europe domestic scope'; END IF;
  IF public.moneyball_is_eligible_european_match('World','UEFA Nations League','men','Wales','Portugal') IS DISTINCT FROM true THEN RAISE EXCEPTION 'UEFA Nations League must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('World','UEFA Womens Nations League','women','Team A','Team B') IS DISTINCT FROM true THEN RAISE EXCEPTION 'UEFA Womens Nations League must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('World','CONCACAF Nations League','men','Team A','Team B') IS DISTINCT FROM false THEN RAISE EXCEPTION 'CONCACAF Nations League must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('Turkey','2. Lig','men','Team A','Team B') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Turkish domestic leagues must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Poland','Ekstraliga Women','women','Team A','Team B') IS DISTINCT FROM true THEN RAISE EXCEPTION 'European women''s domestic leagues must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Spain','Tercera División RFEF - Group 13','men','Cartagena LU II','Santomera') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Spanish lower-tier reserve sides must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Italy','Coppa Italia Serie D','men','Team A','Team B') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Domestic cups must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('World','UEFA Womens Champions League','women','Team A','Team B') IS DISTINCT FROM false THEN RAISE EXCEPTION 'UEFA club cups must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('England','Professional Development League','men','Team U21','Team U21') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Youth development leagues must remain excluded'; END IF;
END;
$validation$;
