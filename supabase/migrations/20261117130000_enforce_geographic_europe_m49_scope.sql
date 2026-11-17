-- Enforce the same geographic-Europe boundary in the database as in the
-- Cloudflare client and Supabase Edge Function sources. Existing rows are not
-- deleted or rewritten; this changes eligibility for future reads/inserts.
CREATE OR REPLACE FUNCTION public.moneyball_is_geographic_europe_country(p_country text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  WITH raw AS (
    SELECT lower(btrim(coalesce(p_country,''))) AS value
  ), normalized AS (
    SELECT btrim(regexp_replace(translate(value, 'áéíóúüñç', 'aeiouunc'), '[^a-z0-9]+', ' ', 'g')) AS value
    FROM raw
  )
  SELECT value = ANY (ARRAY[
    'albania','andorra','austria','belarus','belgium','bosnia','bosnia and herzegovina',
    'bulgaria','croatia','czechia','czech republic','denmark','england','estonia',
    'faroe islands','finland','france','germany','gibraltar','greece','guernsey','hungary',
    'iceland','ireland','republic of ireland','isle of man','italy','jersey','kosovo','latvia','liechtenstein',
    'lithuania','luxembourg','malta','moldova','monaco','montenegro','netherlands',
    'north macedonia','macedonia','northern ireland','norway','poland','portugal','romania',
    'russia','san marino','scotland','serbia','slovakia','slovenia','spain','sweden',
    'switzerland','ukraine','wales','united kingdom','united kingdom of great britain and northern ireland','great britain','uk',
    'aland islands','svalbard and jan mayen islands','holy see','vatican city',
    'alb','and','aut','blr','bel','bih','bgr','bul','hrv','cro','cze','dnk','est',
    'fro','fin','fra','deu','ger','gib','grc','gre','ggy','hun','isl','irl','imn',
    'ita','jey','lva','lie','ltu','lux','mlt','mda','mco','mne','nld','mkd','nor',
    'pol','prt','por','rou','rus','smr','srb','svk','svn','esp','swe','che','sui',
    'ukr','gbr','gb','uk','eng','sco','wal','nir','kos','ala','sjm','vat'
  ])
  OR EXISTS (
    SELECT 1
    FROM regexp_split_to_table((SELECT value FROM raw), '[,;/|]') AS part
    WHERE btrim(regexp_replace(translate(lower(btrim(part)), 'áéíóúüñç', 'aeiouunc'), '[^a-z0-9]+', ' ', 'g')) = ANY (ARRAY[
      'albania','andorra','austria','belarus','belgium','bosnia','bosnia and herzegovina',
      'bulgaria','croatia','czechia','czech republic','denmark','england','estonia',
      'faroe islands','finland','france','germany','gibraltar','greece','guernsey','hungary',
      'iceland','ireland','isle of man','italy','jersey','kosovo','latvia','liechtenstein',
      'lithuania','luxembourg','malta','moldova','monaco','montenegro','netherlands',
      'north macedonia','macedonia','northern ireland','norway','poland','portugal','romania',
      'russia','san marino','scotland','serbia','slovakia','slovenia','spain','sweden',
      'switzerland','ukraine','wales','united kingdom','great britain','uk'
    ])
  )
  FROM normalized;
$function$;

-- Preserve the existing, extensively tested competition/tier predicate and
-- wrap it with the geographic gate. The renamed legacy predicate is private
-- to the wrapper; all existing callers keep the canonical function name.
ALTER FUNCTION public.moneyball_is_european_top_two_league(text,text)
  RENAME TO moneyball_is_european_top_two_league_pre_m49;

CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(
  p_country text,
  p_competition text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.moneyball_is_geographic_europe_country(p_country)
     AND public.moneyball_is_european_top_two_league_pre_m49(p_country,p_competition);
$function$;

REVOKE ALL ON FUNCTION public.moneyball_is_european_top_two_league_pre_m49(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moneyball_is_european_top_two_league(text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moneyball_is_geographic_europe_country(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.moneyball_is_geographic_europe_country(text)
IS 'Geographic Europe boundary based on UN M49, with explicit football-provider aliases for UK subdivisions and Kosovo.';

COMMENT ON FUNCTION public.moneyball_is_european_top_two_league(text,text)
IS 'Canonical eligibility predicate: geographic Europe plus existing domestic senior tier 1/2 competition rules.';

DO $validation$
BEGIN
  IF public.moneyball_is_european_top_two_league('Albania','Abissnet Superiore') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'M49 regression: Albania top division must remain eligible';
  END IF;
  IF public.moneyball_is_european_top_two_league('Israel','Ligat Haal') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'M49 regression: Israel must be excluded';
  END IF;
  IF public.moneyball_is_european_top_two_league('Georgia','Erovnuli Liga') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'M49 regression: Georgia must be excluded';
  END IF;
  IF public.moneyball_is_european_top_two_league('Türkiye','Super Lig') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'M49 regression: Türkiye must be excluded';
  END IF;
  IF public.moneyball_is_european_top_two_league('Cyprus','First Division') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'M49 regression: Cyprus must be excluded';
  END IF;
END;
$validation$;
