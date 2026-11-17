-- Keep the SQL eligibility contract aligned with the app and both fixture importers.
-- This fixes three false positives discovered by evaluating all 634 current FootyNomad
-- browse-catalogue competition labels against the production SQL predicate:
--   Italy / Serie D - Championship Round (4th tier)
--   Sweden / Damallsvenskan (women's top tier)
--   England / Premier League - Summer Series (special exhibition series)
do $migration$
declare
  v_def text;
  v_before text;
begin
  select pg_get_functiondef('public.moneyball_is_european_top_two_league(text,text)'::regprocedure)
    into v_def;

  v_before := v_def;
  v_def := replace(
    v_def,
    'serie c|lega pro|league one|league two|league three)',
    'serie c|serie d|lega pro|league one|league two|league three)'
  );
  if v_def = v_before then
    raise exception 'Could not locate Serie C lower-tier exclusion in moneyball_is_european_top_two_league';
  end if;

  v_before := v_def;
  v_def := replace(
    v_def,
    'feminine|femminile|femenina|ladies|girls)',
    'feminine|femminile|femenina|ladies|girls|damallsvenskan|wsl|liga f|summer series)'
  );
  if v_def = v_before then
    raise exception 'Could not locate women's/special-competition exclusion in moneyball_is_european_top_two_league';
  end if;
  execute v_def;

  select pg_get_functiondef('public.moneyball_is_eligible_european_match(text,text,text,text,text)'::regprocedure)
    into v_def;
  v_before := v_def;
  v_def := replace(
    v_def,
    'qualification|qualifying)([^a-z0-9]|$)',
    'qualification|qualifying|serie d|summer series|damallsvenskan|wsl|liga f)([^a-z0-9]|$)'
  );
  if v_def = v_before then
    raise exception 'Could not locate competition exclusion list in moneyball_is_eligible_european_match';
  end if;
  execute v_def;
end
$migration$;

comment on function public.moneyball_is_european_top_two_league(text,text)
is 'European senior domestic tier 1/2 league predicate; explicitly excludes Serie D, women-specific labels and exhibition series.';
comment on function public.moneyball_is_eligible_european_match(text,text,text,text,text)
is 'Shared European senior-men fixture eligibility predicate; rejects women-specific competitions, cups, international fixtures, reserve teams and lower tiers.';
