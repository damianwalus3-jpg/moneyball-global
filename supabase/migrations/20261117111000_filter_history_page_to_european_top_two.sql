-- Keep the settlement queue/history read model aligned with the same canonical match scope.
-- Underlying historical records and coupon finance remain intact.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.moneyball_history_page(text,text,timestamp with time zone,uuid,integer)'::regprocedure
  ) into v_def;

  v_new := replace(
    v_def,
    E'where m.owner_id = (select auth.uid())\n  ),\n  scoped as materialized',
    E'where m.owner_id = (select auth.uid())\n      and coalesce(m.gender, ''men'') = ''men''\n      and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)\n  ),\n  scoped as materialized'
  );
  if v_new = v_def then
    raise exception 'Could not patch moneyball_history_page candidate scope';
  end if;
  execute v_new;
end
$migration$;

comment on function public.moneyball_history_page(text,text,timestamp with time zone,uuid,integer)
is 'Owner-scoped settlement queue/history view; includes only European senior-men domestic tier-1/tier-2 matches while preserving underlying history and coupon finance.';
