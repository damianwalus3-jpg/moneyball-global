-- Official 2026/27 senior top-flight competition names.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_new := replace(
    v_def,
    'montenegrin second league|second league montenegro|first league federation of bih',
    'montenegrin second league|second league montenegro|meridianbet 1 cfl|prva mfl|first mfl|wwin liga bih|wwin liga bosne i hercegovine|first league federation of bih'
  );
  if v_new = v_def then
    raise exception 'Could not locate Montenegro/North Macedonia/Bosnia alias insertion point';
  end if;
  execute v_new;
end
$migration$;
