do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.moneyball_dashboard_summary()'::regprocedure) into definition;
  definition := replace(definition, 'MONEYBALL GLOBAL 3.8', 'MONEYBALL GLOBAL 3.9');
  execute definition;

  select pg_get_functiondef('public.moneyball_test_compat()'::regprocedure) into definition;
  definition := replace(definition, 'MONEYBALL GLOBAL 3.8', 'MONEYBALL GLOBAL 3.9');
  execute definition;
end
$$;
