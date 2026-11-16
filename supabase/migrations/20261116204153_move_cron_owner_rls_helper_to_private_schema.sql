-- Keep the cron owner resolver usable by anon-scoped RLS policies without
-- exposing the SECURITY DEFINER helper through the public PostgREST schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon;

CREATE OR REPLACE FUNCTION private.moneyball_cron_owner_id(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN public.moneyball_cron_token_valid(p_token)
    THEN (SELECT u.id FROM auth.users AS u ORDER BY u.created_at ASC LIMIT 1)
    ELSE NULL::uuid
  END
$function$;

REVOKE ALL ON FUNCTION private.moneyball_cron_owner_id(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION private.moneyball_cron_owner_id(text) TO anon;

ALTER POLICY moneyball_cron_manage_market_data ON public.match_market_data
  TO anon
  USING (owner_id = (SELECT private.moneyball_cron_owner_id(COALESCE(((SELECT current_setting('request.headers', true))::jsonb ->> 'x-cron-token'), ''::text))))
  WITH CHECK (owner_id = (SELECT private.moneyball_cron_owner_id(COALESCE(((SELECT current_setting('request.headers', true))::jsonb ->> 'x-cron-token'), ''::text))));

ALTER POLICY moneyball_cron_read_match_results ON public.match_results
  TO anon
  USING (owner_id = (SELECT private.moneyball_cron_owner_id(COALESCE(((SELECT current_setting('request.headers', true))::jsonb ->> 'x-cron-token'), ''::text))));

ALTER POLICY moneyball_cron_read_matches ON public.matches
  TO anon
  USING (owner_id = (SELECT private.moneyball_cron_owner_id(COALESCE(((SELECT current_setting('request.headers', true))::jsonb ->> 'x-cron-token'), ''::text))));

ALTER POLICY moneyball_cron_manage_predictions ON public.predictions
  TO anon
  USING (owner_id = (SELECT private.moneyball_cron_owner_id(COALESCE(((SELECT current_setting('request.headers', true))::jsonb ->> 'x-cron-token'), ''::text))))
  WITH CHECK (owner_id = (SELECT private.moneyball_cron_owner_id(COALESCE(((SELECT current_setting('request.headers', true))::jsonb ->> 'x-cron-token'), ''::text))));
