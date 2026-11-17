-- Add provider-specific tier-1 labels surfaced by Football Charts.
-- Keep the central SQL gate in sync with src/lib/domain.ts and the importer.
do $migration$
declare
  v_def text;
  v_before text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;
  v_before := v_def;
  v_def := replace(v_def, 'efbet liga|cyprus second division', 'efbet liga|efbet league|toplyga|cyprus second division');
  if v_def = v_before then
    raise exception 'Could not locate expected league alias list in moneyball_is_european_top_two_league';
  end if;
  execute v_def;
end
$migration$;
comment on function public.moneyball_is_european_top_two_league(text,text)
is 'European domestic senior-men tier 1/2 league predicate; includes provider aliases efbet League and TOPLYGA.';
