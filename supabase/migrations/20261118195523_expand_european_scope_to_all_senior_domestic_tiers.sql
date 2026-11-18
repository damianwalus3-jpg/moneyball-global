-- Expand production candidate eligibility to all senior men's domestic league tiers
-- across geographic Europe. Existing records are not rewritten or deleted.
-- OpenMatchday remains separately limited to the tiers published in its catalogue.

CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(
  p_country text,
  p_competition text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_label text := regexp_replace(
    normalize(lower(btrim(coalesce(p_competition, ''))), NFD),
    '[^a-z0-9]+', ' ', 'g'
  );
BEGIN
  IF v_label = ''
     OR NOT public.moneyball_is_geographic_europe_country(p_country) THEN
    RETURN false;
  END IF;

  IF v_label ~* '(^|[^a-z0-9])(uefa|fifa|nations league|champions league|europa league|conference league|world cup|international|national team|friendly|qualification|qualifying|cup|copa|coppa|supercopa|supercoppa|super cup|supercup|coupe|pokal|trophy|shield|play ?offs?|women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|damen|ladies|girls|youth|juniors?|academy|reserves?|reserve league|b team|premier league 2|pl2|professional development league|development league|u(15|16|17|18|19|20|21|23)|under ?(15|16|17|18|19|20|21|23))([^a-z0-9]|$)' THEN
    RETURN false;
  END IF;

  RETURN v_label ~* '(^|[^a-z0-9])(league|liga|liqa|lliga|ligue|division|divisao|divisie|bundesliga|premiership|premier|championship|superliga|superligaen|super lig|serie|national|regional|regionalliga|oberliga|esiliiga|meistriliiga|virsliga|eliteserien|allsvenskan|superettan|ekstraklasa|mfl|cfl|snl|hnl|nl|lyga|liiga|deild|campionato|meistaradeildin|besta deild|urvalsdeild|ligaen|federation|federacao|federacija|kategoria|superiore|cymru|honneur|rfef)([^a-z0-9]|$)';
END;
$function$;

COMMENT ON FUNCTION public.moneyball_is_european_top_two_league(text,text) IS
$$Legacy compatibility name. Production scope is all geographic-European senior men's domestic league tiers; cups, international, women, youth and reserve competitions remain excluded.$$;

DO $validation$
BEGIN
  IF NOT public.moneyball_is_european_top_two_league('England','National League - North') THEN RAISE EXCEPTION 'English National League North must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Scotland','Football League - Lowland League') THEN RAISE EXCEPTION 'Scottish Lowland League must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Spain','Tercera División RFEF - Group 13') THEN RAISE EXCEPTION 'Spanish Tercera RFEF must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Germany','Oberliga - Rheinland-Pfalz / Saar') THEN RAISE EXCEPTION 'German Oberliga must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Bulgaria','Third League - Northeast') THEN RAISE EXCEPTION 'Bulgarian Third League must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Poland','III Liga - Group 3') THEN RAISE EXCEPTION 'Polish III Liga must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Bosnia','1st League - RS') THEN RAISE EXCEPTION 'Bosnian 1st League - RS must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('Italy','Serie D') THEN RAISE EXCEPTION 'Italian Serie D must be eligible'; END IF;
  IF NOT public.moneyball_is_european_top_two_league('France','National 2 - Group C') THEN RAISE EXCEPTION 'French National 2 must be eligible'; END IF;
  IF public.moneyball_is_european_top_two_league('England','EFL Trophy') THEN RAISE EXCEPTION 'Domestic cups must remain excluded'; END IF;
  IF public.moneyball_is_european_top_two_league('World','UEFA Nations League') THEN RAISE EXCEPTION 'International competitions must remain excluded'; END IF;
  IF public.moneyball_is_european_top_two_league('England','Premier League 2') THEN RAISE EXCEPTION 'Development leagues must remain excluded'; END IF;
  IF public.moneyball_is_european_top_two_league('Sweden','Damallsvenskan') THEN RAISE EXCEPTION 'Female leagues must remain excluded'; END IF;
  IF public.moneyball_is_european_top_two_league('Israel','Liga Leumit') THEN RAISE EXCEPTION 'Non-geographic-European countries must remain excluded'; END IF;
  IF NOT public.moneyball_is_eligible_european_match('Bulgaria','Third League - Northeast','men','Benkovski Isperih','Septemvri Tervel') THEN RAISE EXCEPTION 'Eligible senior men third-tier fixture must pass'; END IF;
  IF public.moneyball_is_eligible_european_match('England','EFL Trophy','men','Luton','Peterborough') THEN RAISE EXCEPTION 'Cup fixture must fail'; END IF;
  IF public.moneyball_is_eligible_european_match('England','National League - North','women','Team A','Team B') THEN RAISE EXCEPTION 'Female fixture must fail'; END IF;
END;
$validation$;
