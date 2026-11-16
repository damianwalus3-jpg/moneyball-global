-- Normalize PostgreSQL regex escapes in the country-specific tier exclusions.
DO $$
DECLARE
  definition text;
  slash_pair text := chr(92) || chr(92);
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  definition := replace(definition, slash_pair || 'm2 lig' || slash_pair || 'M', '2 lig');
  definition := replace(definition, slash_pair || 'm2 division' || slash_pair || 'M', '2 division');
  definition := replace(definition, slash_pair || 'mdivision [12]' || slash_pair || 'M', 'division [12]');
  definition := replace(definition, slash_pair || 'mfootball league' || slash_pair || 'M', 'football league');

  EXECUTE definition;
END $$;
