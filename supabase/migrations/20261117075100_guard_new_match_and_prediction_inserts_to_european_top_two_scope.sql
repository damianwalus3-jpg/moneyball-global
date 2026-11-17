-- Prevent future out-of-scope fixture and prediction writes at the database boundary.
-- Existing historical rows are intentionally untouched. Returning NULL from a
-- BEFORE INSERT trigger skips only the incoming row (including ON CONFLICT inserts).

create or replace function public.moneyball_guard_european_top_two_insert_scope()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $function$
declare
  fixture record;
  v_country text;
  v_competition text;
  v_gender text;
  v_teams text;
begin
  if tg_table_name = 'matches' then
    v_country := coalesce(new.country, '');
    v_competition := coalesce(new.competition, new.league, '');
    v_gender := coalesce(nullif(lower(new.gender), ''), 'men');
    v_teams := concat_ws(' ', new.home_team, new.away_team);
  elsif tg_table_name = 'predictions' then
    select m.country, coalesce(m.competition, m.league, '') as competition,
           coalesce(nullif(lower(m.gender), ''), 'men') as gender,
           concat_ws(' ', m.home_team, m.away_team) as teams
      into fixture
      from public.matches m
     where m.id = new.match_id
       and m.owner_id = coalesce(new.owner_id, new.user_id);

    if not found then
      return null;
    end if;

    v_country := coalesce(fixture.country, '');
    v_competition := coalesce(fixture.competition, '');
    v_gender := fixture.gender;
    v_teams := fixture.teams;
  else
    return new;
  end if;

  if not public.moneyball_is_european_top_two_league(v_country, v_competition) then
    return null;
  end if;

  if v_gender <> 'men' then
    return null;
  end if;

  if v_competition ~* '(^|[^a-z0-9])(uefa|nations league|national team|international|world cup|euro|friendly|cup|copa|trophy|qualification|qualifying)([^a-z0-9]|$)' then
    return null;
  end if;

  if (v_competition || ' ' || v_teams) ~* '(women|womens|woman|frauen|femenina|femenino|feminin|female|ladies|girls|academy|youth|juniors?|u[[:space:]]*[0-9]{2}|under[[:space:]-]*[0-9]{2}|reserves?|b team|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico)' then
    return null;
  end if;

  if v_teams ~* '(^|[^a-z0-9])(ii|iii|b)$' then
    return null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_moneyball_scope_guard_matches on public.matches;
create trigger trg_moneyball_scope_guard_matches
before insert on public.matches
for each row execute function public.moneyball_guard_european_top_two_insert_scope();

drop trigger if exists trg_moneyball_scope_guard_predictions on public.predictions;
create trigger trg_moneyball_scope_guard_predictions
before insert on public.predictions
for each row execute function public.moneyball_guard_european_top_two_insert_scope();

comment on function public.moneyball_guard_european_top_two_insert_scope() is
'Skips new match and prediction inserts outside European domestic men tier 1/2. Historical rows are preserved.';
