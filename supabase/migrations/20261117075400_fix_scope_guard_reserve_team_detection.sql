-- Fix reserve-side detection: evaluate each team name independently.
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
  v_home text;
  v_away text;
begin
  if tg_table_name = 'matches' then
    v_country := coalesce(new.country, '');
    v_competition := coalesce(new.competition, new.league, '');
    v_gender := coalesce(nullif(lower(new.gender), ''), 'men');
    v_home := coalesce(new.home_team, '');
    v_away := coalesce(new.away_team, '');
    v_teams := concat_ws(' ', v_home, v_away);
  elsif tg_table_name = 'predictions' then
    select m.country, coalesce(m.competition, m.league, '') as competition,
           coalesce(nullif(lower(m.gender), ''), 'men') as gender,
           m.home_team, m.away_team
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
    v_home := coalesce(fixture.home_team, '');
    v_away := coalesce(fixture.away_team, '');
    v_teams := concat_ws(' ', v_home, v_away);
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

  if v_home ~* '(^|[^a-z0-9])(ii|iii|b)$' or v_away ~* '(^|[^a-z0-9])(ii|iii|b)$' then
    return null;
  end if;

  return new;
end;
$function$;
