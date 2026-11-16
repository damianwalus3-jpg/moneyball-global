-- Throttle the expensive seven-day FootyNomad reschedule lookup.
-- The results sync still runs every five minutes; this ancillary reconciliation
-- is allowed to run once per 15 minutes across overlapping cron invocations.
CREATE TABLE IF NOT EXISTS public.moneyball_reschedule_sync_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  last_checked_at timestamptz
);

INSERT INTO public.moneyball_reschedule_sync_state(singleton, last_checked_at)
VALUES (true, NULL)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.moneyball_reschedule_sync_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.moneyball_reschedule_sync_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.moneyball_reschedule_sync_state TO service_role;

CREATE OR REPLACE FUNCTION public.moneyball_claim_reschedule_sync()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.moneyball_reschedule_sync_state
     SET last_checked_at = clock_timestamp()
   WHERE singleton = true
     AND (
       last_checked_at IS NULL
       OR last_checked_at <= clock_timestamp() - interval '15 minutes'
     );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.moneyball_claim_reschedule_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moneyball_claim_reschedule_sync() TO service_role;
