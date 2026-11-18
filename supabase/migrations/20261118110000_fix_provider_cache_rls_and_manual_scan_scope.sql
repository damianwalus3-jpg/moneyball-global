-- Avoid per-row auth.uid() evaluation in provider-cache RLS policies.
-- Keep the existing owner-only policy boundaries; no new public access is introduced.
ALTER POLICY moneyball_provider_cache_insert_own
  ON public.moneyball_provider_cache
  WITH CHECK ((SELECT auth.uid()) = owner_id);

ALTER POLICY moneyball_provider_cache_select_own
  ON public.moneyball_provider_cache
  USING ((SELECT auth.uid()) = owner_id);

ALTER POLICY moneyball_provider_cache_update_own
  ON public.moneyball_provider_cache
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

-- The manual prediction list must use the same strict European men's tier-1/2
-- scope and duplicate-pair handling as the dashboard and scheduled predictor.
CREATE OR REPLACE FUNCTION public.moneyball_manual_prediction_scan_page(
  p_date date,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
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
      AND concat_ws(' ',m.competition,m.league,m.home_team,m.away_team)
        !~* '\\m(reserves?|academy|youth|b team|ii|iii|celta fortuna|real madrid castilla|valencia mestalla|betis deportivo|sevilla atletico)\\M'
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
GRANT EXECUTE ON FUNCTION public.moneyball_manual_prediction_scan_page(date,integer,integer) TO authenticated;
