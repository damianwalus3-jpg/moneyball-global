-- Exclude country-specific tier-three labels that match generic league aliases.
DO $$
DECLARE
  definition text;
  needle text := $needle$  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['denmark','dnk','norway','nor','belarus','blr']) AND n.comp ~* '2 division')$needle$;
  replacement text := $replacement$  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['denmark','dnk','norway','nor','belarus','blr']) AND n.comp ~* '2 division')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['denmark','dnk']) AND n.comp ~* '2nd division')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['russia','rus']) AND n.comp ~* 'second league')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['spain','esp']) AND n.comp ~* '(primera division rfef|segunda division rfef)')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['switzerland','sui','che']) AND n.comp ~* '1 liga (promotion|classic)')$replacement$;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;
  IF position(needle IN definition) = 0 THEN
    RAISE EXCEPTION 'Expected country-specific Denmark/Norway/Belarus exclusion not found';
  END IF;
  definition := replace(definition, needle, replacement);
  EXECUTE definition;
END $$;
