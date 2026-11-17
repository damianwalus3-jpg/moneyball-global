-- Ensure the shared league predicate rejects playoff labels regardless of spacing.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_new := replace(v_def, 'play offs?', 'play ?offs?');
  if v_new = v_def then
    raise exception 'Could not locate playoff exclusion in canonical league predicate';
  end if;
  execute v_new;
end
$migration$;
