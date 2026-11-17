-- Current official league names for Albania, Kosovo, Luxembourg and Malta.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_new := replace(v_def, 'super league albania|',
    'super league albania|abissnet superiore|bgl ligue|promotion d honneur|albi mall superliga|vbet malta premier league|malta premier league|');
  if v_new = v_def then
    raise exception 'Could not locate Albania/Kosovo/Luxembourg/Malta alias insertion point';
  end if;
  execute v_new;
end
$migration$;
