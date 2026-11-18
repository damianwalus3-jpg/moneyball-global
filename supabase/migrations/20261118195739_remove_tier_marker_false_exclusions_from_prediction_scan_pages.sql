-- All-tier scheduled/manual scan pages use the shared senior-European eligibility predicate.
-- No concatenated competition/team regex is applied here: it misclassified valid labels such as III Liga.
-- Reserve/youth/women exclusions are enforced by moneyball_is_eligible_european_match.
-- OpenMatchday source tier metadata remains checked by the manual page.

CREATE OR REPLACE FUNCTION public.moneyball_manual_prediction_scan_page(p_date date, p_offset integer DEFAULT 0, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_owner uuid := auth.uid();
  v_rows jsonb;
  v_count integer;
  v_limit integer := greatest(1, least(coalesce(p_limit,10),10));
  v_offset integer := greatest(0, least(coalesce(p_offset,0),10000));
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode='42501';
  END IF;

  WITH ranked AS (
    SELECT m.*,
      row_number() OVER (
        PARTITION BY
          coalesce((m.kickoff_at AT TIME ZONE 'Europe/Brussels')::date,m.kickoff_date,p_date),
          regexp_replace(normalize(lower(btrim(coalesce(m.home_team,''))),NFD),'[^a-z0-9]+','','g'),
          regexp_replace(normalize(lower(btrim(coalesce(m.away_team,''))),NFD),'[^a-z0-9]+','','g'),
          coalesce(nullif(lower(m.gender),''),'men')
        ORDER BY (lower(coalesce(m.source,''))='footynomad') DESC,
          (m.kickoff_at IS NOT NULL) DESC,m.updated_at DESC,m.id
      ) AS duplicate_rank
    FROM public.matches m
    WHERE m.owner_id=v_owner
      AND (
        (m.kickoff_at >= (p_date::timestamp AT TIME ZONE 'Europe/Brussels')
          AND m.kickoff_at < ((p_date+1)::timestamp AT TIME ZONE 'Europe/Brussels'))
        OR (m.kickoff_at IS NULL AND m.kickoff_date=p_date)
      )
      AND public.moneyball_is_eligible_european_match(
        m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team
      )
      AND public.moneyball_is_openmatchday_tier(m.source,m.external_id)
  ),
  eligible AS (
    SELECT * FROM ranked WHERE duplicate_rank=1
  ),
  page AS (
    SELECT * FROM eligible
    ORDER BY kickoff_at ASC NULLS LAST,id ASC
    OFFSET v_offset LIMIT v_limit+1
  )
  SELECT count(*),
    coalesce(
      jsonb_agg(to_jsonb(x) ORDER BY x.kickoff_at ASC NULLS LAST,x.id)
        FILTER (WHERE x.rn<=v_limit),
      '[]'::jsonb
    )
  INTO v_count,v_rows
  FROM (
    SELECT page.*,row_number() OVER (ORDER BY page.kickoff_at ASC NULLS LAST,page.id) rn
    FROM page
  ) x;

  RETURN jsonb_build_object('rows',v_rows,'has_more',v_count>v_limit,'count',least(v_count,v_limit));
END;
$function$;

CREATE OR REPLACE FUNCTION public.moneyball_prediction_scan_page(p_owner_id uuid, p_date date, p_cursor_kickoff_at timestamp with time zone, p_cursor_match_id uuid, p_limit integer, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare v_rows jsonb; v_count integer; v_limit integer:=greatest(1,least(coalesce(p_limit,10),10));
begin
  if not public.moneyball_cron_token_valid(p_token) then raise exception 'invalid cron token' using errcode='42501'; end if;
  if p_owner_id is distinct from public.moneyball_cron_owner_id(p_token) then raise exception 'owner mismatch' using errcode='42501'; end if;
  with ranked as (
    select m.*,
      row_number() over (
        partition by coalesce(m.kickoff_at at time zone 'Europe/Brussels',m.kickoff_date::timestamp,p_date::timestamp)::date,
          regexp_replace(lower(coalesce(m.home_team,'')),'[^a-z0-9]+','','g'),
          regexp_replace(lower(coalesce(m.away_team,'')),'[^a-z0-9]+','','g'),
          coalesce(nullif(lower(m.gender),''),'men')
        order by (lower(coalesce(m.source,''))='footynomad') desc,(m.kickoff_at is not null) desc,m.updated_at desc,m.id
      ) duplicate_rank
    from public.matches m
    where m.owner_id=p_owner_id
      and ((m.kickoff_at >= (p_date::timestamp at time zone 'Europe/Brussels') and m.kickoff_at < ((p_date+1)::timestamp at time zone 'Europe/Brussels'))
        or (m.kickoff_at is null and m.kickoff_date=p_date))
      and public.moneyball_is_eligible_european_match(m.country,coalesce(m.competition,m.league),m.gender,m.home_team,m.away_team)
      and (lower(coalesce(m.gender,''))='men' or coalesce(m.gender,'')='')
  ), eligible as (select * from ranked where duplicate_rank=1),
  page as (
    select * from eligible e
    where p_cursor_match_id is null
       or (p_cursor_kickoff_at is not null and ((e.kickoff_at is not null and (e.kickoff_at,e.id)>(p_cursor_kickoff_at,p_cursor_match_id)) or e.kickoff_at is null))
       or (p_cursor_kickoff_at is null and e.kickoff_at is null and e.id>p_cursor_match_id)
    order by e.kickoff_at asc nulls last,e.id asc limit v_limit+1
  )
  select count(*),coalesce(jsonb_agg(to_jsonb(x) order by x.kickoff_at asc nulls last,x.id asc) filter (where x.rn<=v_limit),'[]'::jsonb)
    into v_count,v_rows
  from (select p.*,row_number() over(order by p.kickoff_at asc nulls last,p.id asc) rn from page p) x;
  return jsonb_build_object('rows',v_rows,'has_more',v_count>v_limit,'count',least(v_count,v_limit));
end
$function$;

DO $validation$
BEGIN
  IF NOT public.moneyball_is_eligible_european_match('Poland','III Liga - Group 3','men','Barycz Sułów','Polonia Nysa') THEN
    RAISE EXCEPTION 'Polish III Liga fixture must pass all-tier scheduled/manual scan predicates';
  END IF;
  IF public.moneyball_is_eligible_european_match('Poland','III Liga - Group 3','men','Barycz Sułów II','Polonia Nysa') THEN
    RAISE EXCEPTION 'Reserve team suffix must remain excluded';
  END IF;
END;
$validation$;
