-- Include North Macedonia's 2 MFL as the domestic second tier.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
  INTO definition;
  definition := replace(definition, 'vtora mfl', '2 mfl|vtora mfl');
  EXECUTE definition;
END
$$;
