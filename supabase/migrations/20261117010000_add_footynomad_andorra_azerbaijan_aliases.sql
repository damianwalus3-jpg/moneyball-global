-- Add exact current FootyNomad labels for Andorra and Azerbaijan.
-- Update the canonical database predicate in-place so all existing RPCs stay aligned.
DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  IF position('primera divisio|segunda divisio' IN definition) = 0 THEN
    RAISE EXCEPTION 'Expected Andorra insertion point not found in league scope function';
  END IF;
  IF position('birinci liqa' IN definition) = 0 THEN
    RAISE EXCEPTION 'Expected Azerbaijan insertion point not found in league scope function';
  END IF;

  definition := replace(definition, 'primera divisio|segunda divisio', '1a divisio|2a divisio|primera divisio|segunda divisio');
  definition := replace(definition, 'birinci liqa', 'birinci dasta|birinci liqa');
  EXECUTE definition;
END $$;

DO $$
BEGIN
  IF NOT public.moneyball_is_european_top_two_league('Andorra', '1a Divisió') THEN
    RAISE EXCEPTION 'Andorra 1a Divisio should be eligible';
  END IF;
  IF NOT public.moneyball_is_european_top_two_league('Andorra', '2a Divisió') THEN
    RAISE EXCEPTION 'Andorra 2a Divisio should be eligible';
  END IF;
  IF NOT public.moneyball_is_european_top_two_league('Azerbaijan', 'Birinci Dasta') THEN
    RAISE EXCEPTION 'Azerbaijan Birinci Dasta should be eligible';
  END IF;
  IF NOT public.moneyball_is_european_top_two_league('Belarus', '1. Division') THEN
    RAISE EXCEPTION 'Belarus 1. Division should be eligible';
  END IF;
  IF NOT public.moneyball_is_european_top_two_league('Belarus', '2. Division') THEN
    RAISE EXCEPTION 'Belarus 2. Division should be eligible';
  END IF;
  IF public.moneyball_is_european_top_two_league('Andorra', 'Copa Constitució') THEN
    RAISE EXCEPTION 'Andorra cup must remain excluded';
  END IF;
  IF public.moneyball_is_european_top_two_league('Azerbaijan', 'Third Division') THEN
    RAISE EXCEPTION 'Azerbaijan third tier must remain excluded';
  END IF;
END $$;
