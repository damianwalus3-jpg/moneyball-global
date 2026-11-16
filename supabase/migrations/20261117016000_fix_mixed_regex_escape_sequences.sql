-- Finalize regex fragment cleanup after the original SQL dollar-quoted insertion.
DO $$
DECLARE
  definition text;
  slash text := chr(92);
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  definition := replace(definition, slash || 'm2 lig' || slash || slash || 'M', '2 lig');
  definition := replace(definition, slash || 'm2 division' || slash || slash || 'M', '2 division');
  definition := replace(definition, slash || 'mdivision [12]' || slash || slash || 'M', 'division [12]');
  definition := replace(definition, slash || 'mfootball league' || slash || slash || 'M', 'football league');

  EXECUTE definition;
END $$;
