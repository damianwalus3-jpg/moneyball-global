-- Accept FootyNomad's country labels and the Georgian top-flight label.
DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    INTO definition;

  IF position($a$'bosnia and herzegovina','bulgaria'$a$ IN definition) = 0
    OR position($b$'north macedonia','northern ireland'$b$ IN definition) = 0
    OR position($c$'turkey','türkiye','ukraine'$c$ IN definition) = 0
    OR position('erovnuli liga 2' IN definition) = 0 THEN
    RAISE EXCEPTION 'Expected country/Georgia insertion point missing';
  END IF;

  definition := replace(definition, $a$'bosnia and herzegovina','bulgaria'$a$, $a$'bosnia','bosnia and herzegovina','bulgaria'$a$);
  definition := replace(definition, $b$'north macedonia','northern ireland'$b$, $b$'macedonia','north macedonia','northern ireland'$b$);
  definition := replace(definition, $c$'turkey','türkiye','ukraine'$c$, $c$'turkey','türkiye','turkiye','ukraine'$c$);
  definition := replace(definition, 'erovnuli liga 2', 'erovnuli liga|erovnuli liga 2');

  EXECUTE definition;
END $$;
