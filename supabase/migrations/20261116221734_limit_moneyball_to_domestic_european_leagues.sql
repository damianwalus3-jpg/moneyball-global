-- Moneyball scans only domestic European senior men's league tiers 1 and 2.
-- International competitions such as UEFA Nations League are not domestic leagues.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
  INTO definition;
  definition := replace(definition, ' OR n.comp ~* ''^uefa nations league''', '');
  definition := replace(definition, 'n.comp ~* ''^uefa nations league'' OR ', '');
  EXECUTE definition;
END
$$;
