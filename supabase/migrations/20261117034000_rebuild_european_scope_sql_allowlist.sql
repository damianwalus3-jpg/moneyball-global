-- Rebuild the canonical allowlist after adding exact provider aliases.
-- This keeps the country-specific exclusions intact and scopes HNL/Campionato to their countries.
DO $$
DECLARE
  definition text;
  clean_exclusions text := $q$AND NOT (
  (lower(coalesce(p_country,'')) = ANY (ARRAY['scotland','sco']) AND n.comp ~* '(lowland league|highland league)')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['turkey','tur','türkiye']) AND n.comp ~* '2 lig')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['denmark','dnk','norway','nor','belarus','blr']) AND n.comp ~* '2 division')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['denmark','dnk']) AND n.comp ~* '2nd division')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['russia','rus']) AND n.comp ~* 'second league')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['spain','esp']) AND n.comp ~* '(primera division rfef|segunda division rfef)')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['switzerland','sui','che']) AND n.comp ~* '1 liga (promotion|classic)')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['sweden','swe']) AND n.comp ~* 'division [12]')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['albania','alb']) AND n.comp ~* '2nd division')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['croatia','cro']) AND n.comp ~* 'second nl')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['estonia','est']) AND n.comp ~* 'esiliiga b')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['greece','gre','grc']) AND n.comp ~* 'football league')
)$q$;
  final_prefix text := $q$AND ((lower(coalesce(p_country,'')) = ANY (ARRAY['croatia','cro']) AND n.comp = 'hnl')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['san marino','smr']) AND n.comp = 'campionato')
  OR n.comp ~* '($q$;
  pos_not integer;
  pos_regex integer;
  new_definition text;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;
  pos_not := position('AND NOT (' IN definition);
  pos_regex := position('premier league|' IN definition);
  IF pos_not = 0 OR pos_regex = 0 OR pos_regex <= pos_not THEN
    RAISE EXCEPTION 'Could not locate scope boundaries: %, %', pos_not, pos_regex;
  END IF;

  new_definition :=
    substring(definition from 1 for pos_not - 1)
    || clean_exclusions
    || E'\n'
    || final_prefix
    || substring(definition from pos_regex);

  EXECUTE new_definition;
END $$;
