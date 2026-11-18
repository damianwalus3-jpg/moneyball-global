CREATE OR REPLACE FUNCTION public.moneyball_is_european_top_two_league(p_country text, p_competition text)
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

  IF v_label ~* '(^|[^a-z0-9])(uefa|fifa|nations league|champions league|europa league|conference league|world cup|international|national team|friendly|qualification|qualifying|cup|copa|coppa|kupa|kup|puchar|cupa|taca|supercopa|supercoppa|super cup|supercup|coupe|pokal|trophy|shield|play ?offs?|women|womens|woman|female|frauen|feminine|femminile|femenina|femenino|damen|ladies|girls|youth|juniors?|academy|reserves?|reserve league|b team|premier league 2|pl2|professional development league|development league|u(15|16|17|18|19|20|21|23)|under ?(15|16|17|18|19|20|21|23))([^a-z0-9]|$)' THEN
    RETURN false;
  END IF;

  RETURN v_label ~* '(^|[^a-z0-9])(league|liga|liqa|lliga|ligue|division|divisao|divisie|bundesliga|premiership|premier|championship|superliga|superligaen|super lig|serie|national|regional|regionalliga|oberliga|esiliiga|meistriliiga|virsliga|eliteserien|allsvenskan|superettan|ekstraklasa|mfl|cfl|snl|hnl|nl|lyga|liiga|deild|toplyga|dasta|ligat|kakkonen|ykkosliiga|ykkonen|campionato|meistaradeildin|besta deild|urvalsdeild|ligaen|federation|federacao|federacija|kategoria|superiore|cymru|honneur|rfef)([^a-z0-9]|$)';
END;
$function$;
COMMENT ON FUNCTION public.moneyball_is_european_top_two_league(text,text) IS
$$Legacy compatibility name. Production scope is all geographic-European senior men's domestic league tiers; cups, international, women, youth and reserve competitions remain excluded.$$;

DO $validation$
BEGIN
  IF NOT public.moneyball_is_eligible_european_match('Lithuania','TOPLYGA','men','FK Zalgiris','FK Panevezys') THEN RAISE EXCEPTION 'Lithuanian TOPLYGA must be eligible'; END IF;
  IF NOT public.moneyball_is_eligible_european_match('Finland','Kakkonen','men','Helsinki FC','Turku United') THEN RAISE EXCEPTION 'Finnish Kakkonen must be eligible'; END IF;
  IF NOT public.moneyball_is_eligible_european_match('San Marino','Campionato Sammarinese','men','San Marino Calcio','Juvenes Dogana') THEN RAISE EXCEPTION 'San Marino Campionato must be eligible'; END IF;
  IF public.moneyball_is_eligible_european_match('Serbia','Kupa Srbije','men','Red Star','Partizan') THEN RAISE EXCEPTION 'Serbian cup must remain excluded'; END IF;
  IF public.moneyball_is_eligible_european_match('Poland','Puchar Polski','men','Legia Warszawa','Lech Poznan') THEN RAISE EXCEPTION 'Polish cup must remain excluded'; END IF;
END;
$validation$;
