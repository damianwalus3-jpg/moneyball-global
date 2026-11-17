DO $$
DECLARE
  definition text;
  bad_fragment text := $q$(lower(coalesce(p_country,'')) = ANY (ARRAY['croatia','cro']) AND n.comp = 'hnl')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['san marino','smr']) AND n.comp = 'campionato')
  OR n.comp ~*$q$;
  allow_fragment text := $q$((lower(coalesce(p_country,'')) = ANY (ARRAY['croatia','cro']) AND n.comp = 'hnl')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['san marino','smr']) AND n.comp = 'campionato')
  OR n.comp ~*$q$;
  marker text := 'n.comp ~*';
  last_pos integer;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  -- Remove the accidentally broad insertion from every earlier exclusion clause.
  definition := replace(definition, bad_fragment, marker);

  -- Add the two exact, country-scoped provider labels only to the final allowlist.
  last_pos := length(definition) - strpos(reverse(definition), reverse(marker)) + 1;
  IF last_pos <= 0 THEN
    RAISE EXCEPTION 'Final allowlist marker not found';
  END IF;
  definition := overlay(definition placing allow_fragment from last_pos for length(marker));

  EXECUTE definition;
END $$;
