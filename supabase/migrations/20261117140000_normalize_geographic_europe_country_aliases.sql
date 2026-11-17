-- Align SQL country normalization with the TypeScript geographic Europe predicate.
CREATE OR REPLACE FUNCTION public.moneyball_is_geographic_europe_country(p_country text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM regexp_split_to_table(coalesce(p_country,''), '[,\\/;|]+') AS part(value)
     WHERE regexp_replace(normalize(lower(btrim(part.value)), NFD), '[^a-z0-9]+', '', 'g') = ANY (ARRAY[
       'albania','andorra','austria','belarus','belgium','bosnia','bosniaandherzegovina','bosniaherzegovina',
       'bulgaria','croatia','czechia','czechrepublic','denmark','england','estonia',
       'faroeislands','finland','france','germany','gibraltar','greece','guernsey',
       'hungary','iceland','ireland','republicofireland','isleofman','italy','jersey',
       'kosovo','latvia','liechtenstein','lithuania','luxembourg','malta','moldova',
       'monaco','montenegro','netherlands','northmacedonia','macedonia','northernireland',
       'norway','poland','portugal','romania','russia','russianfederation','sanmarino',
       'scotland','serbia','slovakia','slovenia','spain','sweden','switzerland','ukraine',
       'wales','unitedkingdom','unitedkingdomofgreatbritainandnorthernireland','greatbritain',
       'alandislands','svalbardandjanmayenislands','holysee','vaticancity',
       'alb','and','aut','blr','bel','bih','bgr','bul','hrv','cro','cze','dnk','est',
       'fro','fin','fra','deu','ger','gib','grc','gre','ggy','hun','isl','irl','imn',
       'ita','jey','lva','lie','ltu','lux','mlt','mda','mco','mne','nld','mkd','nor',
       'pol','prt','por','rou','rus','smr','srb','svk','svn','esp','swe','che','sui',
       'ukr','gbr','gb','uk','eng','sco','wal','nir','kos','xkx','ala','sjm','vat'
     ])
  );
$function$;

DO $validation$
BEGIN
  IF public.moneyball_is_geographic_europe_country('Bosnia & Herzegovina') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Bosnia & Herzegovina provider alias must be geographic Europe'; END IF;
  IF public.moneyball_is_geographic_europe_country('Bosnia-Herzegovina') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Bosnia-Herzegovina provider alias must be geographic Europe'; END IF;
  IF public.moneyball_is_geographic_europe_country('Åland Islands') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Åland Islands must normalize to geographic Europe'; END IF;
  IF public.moneyball_is_geographic_europe_country('Israel') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Israel must remain outside geographic Europe'; END IF;
  IF public.moneyball_is_geographic_europe_country('Türkiye') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Türkiye must remain outside geographic Europe'; END IF;
END;
$validation$;
