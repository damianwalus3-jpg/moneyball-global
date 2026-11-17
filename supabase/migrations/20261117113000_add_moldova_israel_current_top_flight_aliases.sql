-- Current 2026/27 official top-flight labels absent from the shared scope predicate.
-- FMF: Liga 7777 (Moldova); Israel FA: Ligat Winner / Winner League.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_new := replace(
    v_def,
    'moldovan super liga|moldova liga 1|liga 1 moldova|montenegrin second league',
    'moldovan super liga|moldova liga 1|liga 1 moldova|liga 7777|ligat winner|winner league|montenegrin second league'
  );
  if v_new = v_def then
    raise exception 'Could not locate expected Moldova/Israel league alias segment';
  end if;
  execute v_new;
end
$migration$;
