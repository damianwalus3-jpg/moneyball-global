DO $$
DECLARE
  definition text;
  old_translate text := $q$translate(lower(coalesce(p_competition,'')), 'áéíóúüñç', 'aeiouunc')$q$;
  new_translate text := $q$translate(lower(coalesce(p_competition,'')), 'áéíóúüñçöäåë', 'aeiouuncoaae')$q$;
  old_aliases text := '|a lyga|i lyga|virsliga|';
  new_aliases text := '|a lyga|1 lyga|i lyga|1 snl|virsliga|';
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  IF position('1 lyga' IN definition) > 0
    AND position('1 snl' IN definition) > 0
    AND position('öäåë' IN definition) > 0
    AND position('n.comp = ''campionato''' IN definition) > 0 THEN
    RAISE NOTICE 'European aliases already updated';
    RETURN;
  END IF;

  IF position(old_translate IN definition) = 0 THEN
    RAISE EXCEPTION 'Competition normalization insertion point missing';
  END IF;
  definition := replace(definition, old_translate, new_translate);

  IF position(old_aliases IN definition) = 0 THEN
    RAISE EXCEPTION 'League alias insertion point missing';
  END IF;
  definition := replace(definition, old_aliases, new_aliases);

  IF position('n.comp ~*' IN definition) = 0 THEN
    RAISE EXCEPTION 'Allowlist expression insertion point missing';
  END IF;
  definition := replace(
    definition,
    'n.comp ~*',
    $q$(lower(coalesce(p_country,'')) = ANY (ARRAY['croatia','cro']) AND n.comp = 'hnl')
  OR (lower(coalesce(p_country,'')) = ANY (ARRAY['san marino','smr']) AND n.comp = 'campionato')
  OR n.comp ~*$q$
  );

  EXECUTE definition;
END $$;
