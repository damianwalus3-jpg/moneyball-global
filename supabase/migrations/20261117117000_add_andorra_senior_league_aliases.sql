-- Official Andorra federation's 2026/27 first and second division names.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_new := replace(v_def, 'super league albania|',
    'super league albania|lliga multisegur assegurances|lliga grup pirineu|');
  if v_new = v_def then
    raise exception 'Could not locate Andorra alias insertion point';
  end if;
  execute v_new;
end
$migration$;
