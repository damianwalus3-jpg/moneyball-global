-- Scheduled prediction pagination and lease RPCs are called only by the
-- trusted moneyball-predict Edge Function using the service-role credential.
REVOKE ALL ON FUNCTION public.moneyball_claim_prediction_scan(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.moneyball_finish_prediction_scan(uuid, date, uuid, timestamptz, uuid, boolean, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.moneyball_prediction_scan_page(uuid, date, timestamptz, uuid, integer, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.moneyball_claim_prediction_scan(uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.moneyball_finish_prediction_scan(uuid, date, uuid, timestamptz, uuid, boolean, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.moneyball_prediction_scan_page(uuid, date, timestamptz, uuid, integer, text) TO service_role;
