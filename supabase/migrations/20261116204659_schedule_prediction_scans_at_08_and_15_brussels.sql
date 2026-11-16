-- Run the automatic prediction scan at the user's requested daily windows:
-- 08:00 and 15:00 Europe/Brussels. The one-minute cron remains in place so
-- batches can continue immediately while has_more=true; only the next completed
-- full scan is deferred to the next daily window.
CREATE OR REPLACE FUNCTION public.moneyball_finish_prediction_scan(
  p_owner_id uuid,
  p_date date,
  p_lease_token uuid,
  p_cursor_kickoff_at timestamptz,
  p_cursor_match_id uuid,
  p_has_more boolean,
  p_processed integer,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  s public.moneyball_prediction_scan_state%rowtype;
  v_local_now timestamp := now() AT TIME ZONE 'Europe/Brussels';
  v_next_local timestamp;
BEGIN
  IF NOT public.moneyball_cron_token_valid(p_token) THEN
    RAISE EXCEPTION 'invalid cron token' USING errcode='42501';
  END IF;
  IF p_owner_id IS DISTINCT FROM public.moneyball_cron_owner_id(p_token) THEN
    RAISE EXCEPTION 'owner mismatch' USING errcode='42501';
  END IF;

  IF NOT p_has_more THEN
    IF v_local_now::time < time '08:00' THEN
      v_next_local := date_trunc('day', v_local_now) + interval '8 hours';
    ELSIF v_local_now::time < time '15:00' THEN
      v_next_local := date_trunc('day', v_local_now) + interval '15 hours';
    ELSE
      v_next_local := date_trunc('day', v_local_now) + interval '1 day' + interval '8 hours';
    END IF;
  END IF;

  UPDATE public.moneyball_prediction_scan_state
     SET cursor_kickoff_at = p_cursor_kickoff_at,
         cursor_match_id = p_cursor_match_id,
         lease_token = NULL,
         lease_until = NULL,
         updated_at = now(),
         batches_completed = batches_completed + 1,
         fixtures_processed = fixtures_processed + greatest(coalesce(p_processed, 0), 0),
         status = CASE WHEN p_has_more THEN 'running' ELSE 'completed' END,
         last_completed_at = CASE WHEN p_has_more THEN last_completed_at ELSE now() END,
         next_scan_at = CASE
           WHEN p_has_more THEN NULL
           ELSE v_next_local AT TIME ZONE 'Europe/Brussels'
         END
   WHERE owner_id = p_owner_id
     AND scan_date = p_date
     AND lease_token = p_lease_token
   RETURNING * INTO s;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lease_lost');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', s.status,
    'batches_completed', s.batches_completed,
    'fixtures_processed', s.fixtures_processed,
    'next_scan_at', s.next_scan_at
  );
END
$function$;
