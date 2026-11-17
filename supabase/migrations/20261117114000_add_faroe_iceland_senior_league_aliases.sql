-- Official Faroe Islands and Iceland current senior-men tier-1/2 competition labels.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_new := replace(
    v_def,
    'liga 7777|ligat winner|winner league|montenegrin second league',
    'liga 7777|ligat winner|winner league|meistaradeildin|meistara deildin|lengjudeild karla|1 deild menn|montenegrin second league'
  );
  if v_new = v_def then
    raise exception 'Could not locate expected Faroe/Iceland alias insertion point';
  end if;
  execute v_new;
end
$migration$;
