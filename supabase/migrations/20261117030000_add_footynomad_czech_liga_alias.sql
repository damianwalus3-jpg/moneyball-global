DO $$
DECLARE
  definition text;
  old_alias text := 'super league albania|vysshaya liga';
  new_alias text := 'super league albania|czech liga|vysshaya liga';
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  IF position('czech liga' IN definition) > 0 THEN
    RAISE NOTICE 'Czech Liga alias already exists; no change required';
    RETURN;
  END IF;

  IF position(old_alias IN definition) = 0 THEN
    RAISE EXCEPTION 'Expected league allowlist insertion point was not found';
  END IF;

  definition := replace(definition, old_alias, new_alias);
  EXECUTE definition;
END $$;
