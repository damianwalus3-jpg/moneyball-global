-- Keep prediction and results views aligned with the canonical European senior-men tier-1/2 scope.
-- Historical rows are preserved; only the read models are filtered.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.moneyball_predictions_page(text,text,text,text,timestamp with time zone,uuid,integer)'::regprocedure
  ) into v_def;

  v_new := replace(
    v_def,
    E'from public.predictions p\n    where p.owner_id = (select auth.uid())\n      and p.market = p_market',
    E'from public.predictions p\n    join public.matches m on m.id = p.match_id and m.owner_id = p.owner_id\n    where p.owner_id = (select auth.uid())\n      and coalesce(m.gender, ''men'') = ''men''\n      and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)\n      and p.market = p_market'
  );
  if v_new = v_def then
    raise exception 'Could not patch moneyball_predictions_page base scope';
  end if;
  execute v_new;

  select pg_get_functiondef(
    'public.moneyball_results_page(text,text,timestamp with time zone,uuid,integer)'::regprocedure
  ) into v_def;

  v_new := replace(
    v_def,
    E'and m.kickoff_at <= now() + interval ''24 hours''\n  ),',
    E'and m.kickoff_at <= now() + interval ''24 hours''\n      and coalesce(m.gender, ''men'') = ''men''\n      and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)\n  ),'
  );
  if v_new = v_def then
    raise exception 'Could not patch moneyball_results_page window scope';
  end if;
  execute v_new;
end
$migration$;

comment on function public.moneyball_predictions_page(text,text,text,text,timestamp with time zone,uuid,integer)
is 'Owner-scoped cursor-paginated prediction view; includes only European senior-men domestic tier-1/tier-2 matches while preserving underlying history.';

comment on function public.moneyball_results_page(text,text,timestamp with time zone,uuid,integer)
is 'Owner-scoped rolling results view; includes only European senior-men domestic tier-1/tier-2 matches while preserving underlying history.';
