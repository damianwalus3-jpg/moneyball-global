CREATE OR REPLACE FUNCTION public.apply_latest_provider_odds_to_prediction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_odds numeric;
  v_bookmaker text;
  v_provider text;
  v_captured_at timestamptz;
  v_price_timestamp timestamptz;
  v_suspended boolean;
  v_owner_id uuid;
BEGIN
  v_owner_id := coalesce(NEW.owner_id, NEW.user_id);

  IF coalesce(NEW.data_source, '') ilike '%Bwin%'
     OR coalesce(NEW.data_coverage->>'odds_source', '') = 'manual' THEN
    RETURN NEW;
  END IF;

  SELECT o.odds, o.bookmaker, o.provider, o.captured_at, o.price_timestamp, o.suspended
    INTO v_odds, v_bookmaker, v_provider, v_captured_at, v_price_timestamp, v_suspended
  FROM public.provider_odds o
  WHERE o.match_id = NEW.match_id
    AND o.owner_id = v_owner_id
    AND o.mapped_market = NEW.market
    AND o.mapped_selection = coalesce(NEW.selection, NEW.pick)
    AND o.suspended = false
    AND o.odds > 1
    AND o.phase = 'prematch'
    AND o.captured_at >= now() - interval '2 hours'
    AND o.price_timestamp >= now() - interval '2 hours'
    AND o.price_timestamp <= now() + interval '5 minutes'
    AND coalesce(o.raw_quote->>'period', '') IN ('', '0', 'FT', 'full time', 'fulltime')
    AND coalesce(o.market_name, '') !~* '(1st|first|half|2nd|second|3rd|third|quarter)'
  ORDER BY o.price_timestamp DESC, o.captured_at DESC
  LIMIT 1;

  IF v_odds IS NOT NULL THEN
    NEW.odds := v_odds;
    NEW.data_source := coalesce(v_provider, 'MoviOdds') || '/' || coalesce(v_bookmaker, 'bookmaker');
    NEW.data_coverage := coalesce(NEW.data_coverage, '{}'::jsonb)
      || jsonb_build_object(
        'odds_source', coalesce(v_provider, 'MoviOdds'),
        'odds_bookmaker', coalesce(v_bookmaker, 'bookmaker'),
        'odds_captured_at', v_captured_at,
        'odds_price_timestamp', v_price_timestamp,
        'odds_age_minutes', greatest(0, floor(extract(epoch from (now() - v_price_timestamp)) / 60)),
        'odds_suspended', coalesce(v_suspended, false)
      );
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.provider_odds
SET mapped_market = NULL, mapped_selection = NULL
WHERE provider = 'MoviOdds'
  AND mapped_market IN ('1X2', 'DOUBLE_CHANCE', 'GOALS')
  AND (
    coalesce(raw_quote->>'period', '') NOT IN ('', '0', 'FT', 'full time', 'fulltime')
    OR coalesce(market_name, '') ~* '(1st|first|half|2nd|second|3rd|third|quarter)'
  );
