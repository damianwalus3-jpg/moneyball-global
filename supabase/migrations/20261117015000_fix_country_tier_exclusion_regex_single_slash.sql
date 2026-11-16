-- Remove PostgreSQL word-boundary escapes from the stored dynamic regex fragments.
DO $$
DECLARE
  definition text;
  slash text := chr(92);
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  definition := replace(definition, slash || 'm2 lig' || slash || 'M', '2 lig');
  definition := replace(definition, slash || 'm2 division' || slash || 'M', '2 division');
  definition := replace(definition, slash || 'mdivision [12]' || slash || 'M', 'division [12]');
  definition := replace(definition, slash || 'mfootball league' || slash || 'M', 'football league');

  EXECUTE definition;
END $$;
