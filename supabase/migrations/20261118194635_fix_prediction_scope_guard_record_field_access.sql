-- Prevent PostgreSQL from evaluating match-only NEW fields on prediction trigger records.
-- Preserve the existing European men's domestic tier 1/2 and OpenMatchday guards.
-- No existing rows are updated or deleted.

CREATE OR REPLACE FUNCTION public.moneyball_guard_european_top_two_insert_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  fixture record;
  v_country text;
  v_competition text;
  v_gender text;
  v_home text;
  v_away text;
  v_source text;
  v_external_id text;
  v_day date;
  v_home_key text;
  v_away_key text;
BEGIN
  IF TG_TABLE_NAME = 'matches' THEN
    v_country := COALESCE(NEW.country, '');
    v_competition := COALESCE(NEW.competition, NEW.league, '');
    v_gender := NEW.gender;
    v_home := COALESCE(NEW.home_team, '');
    v_away := COALESCE(NEW.away_team, '');
    v_source := COALESCE(NEW.source, '');
    v_external_id := COALESCE(NEW.external_id, '');
  ELSIF TG_TABLE_NAME = 'predictions' THEN
    SELECT m.country,
           COALESCE(m.competition, m.league, '') AS competition,
           m.gender,
           m.home_team,
           m.away_team,
           m.source,
           m.external_id
      INTO fixture
      FROM public.matches m
     WHERE m.id = NEW.match_id
       AND m.owner_id = COALESCE(NEW.owner_id, NEW.user_id);

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    v_country := COALESCE(fixture.country, '');
    v_competition := COALESCE(fixture.competition, '');
    v_gender := fixture.gender;
    v_home := COALESCE(fixture.home_team, '');
    v_away := COALESCE(fixture.away_team, '');
    v_source := COALESCE(fixture.source, '');
    v_external_id := COALESCE(fixture.external_id, '');
  ELSE
    RETURN NEW;
  END IF;

  IF NOT public.moneyball_is_eligible_european_match(
    v_country, v_competition, v_gender, v_home, v_away
  )
     OR NOT public.moneyball_is_openmatchday_tier(v_source, v_external_id) THEN
    RETURN NULL;
  END IF;

  -- Keep match-only NEW fields inside a separate PL/pgSQL branch. A combined
  -- boolean expression can be reordered by PostgreSQL and evaluate NEW.kickoff_at
  -- for a predictions trigger record, which has no such field.
  IF TG_TABLE_NAME = 'matches' THEN
    IF TG_OP = 'INSERT'
       AND (NEW.kickoff_at IS NOT NULL OR NEW.kickoff_date IS NOT NULL) THEN
      v_day := COALESCE(
        (NEW.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,
        NEW.kickoff_date
      );
      v_home_key := regexp_replace(
        normalize(lower(btrim(v_home)), NFD), '[^a-z0-9]+', '', 'g'
      );
      v_away_key := regexp_replace(
        normalize(lower(btrim(v_away)), NFD), '[^a-z0-9]+', '', 'g'
      );

      PERFORM pg_advisory_xact_lock(
        hashtextextended(
          COALESCE(NEW.owner_id::text, '') || '|' || v_day::text || '|' ||
          v_home_key || '|' || v_away_key,
          0
        )
      );

      IF EXISTS (
        SELECT 1
          FROM public.matches m
         WHERE m.owner_id = NEW.owner_id
           AND COALESCE(
             (m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,
             m.kickoff_date
           ) = v_day
           AND regexp_replace(
             normalize(lower(btrim(COALESCE(m.home_team, ''))), NFD),
             '[^a-z0-9]+', '', 'g'
           ) = v_home_key
           AND regexp_replace(
             normalize(lower(btrim(COALESCE(m.away_team, ''))), NFD),
             '[^a-z0-9]+', '', 'g'
           ) = v_away_key
           AND public.moneyball_is_eligible_european_match(
             m.country, COALESCE(m.competition, m.league),
             m.gender, m.home_team, m.away_team
           )
           AND public.moneyball_is_openmatchday_tier(m.source, m.external_id)
      ) THEN
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.moneyball_guard_european_top_two_insert_scope() IS
'Skips new match and prediction inserts outside European domestic men tier 1/2. Match-only kickoff fields are evaluated only for matches trigger records; historical rows are preserved.';
