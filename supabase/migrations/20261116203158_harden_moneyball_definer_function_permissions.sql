-- Tighten direct RPC permissions around SECURITY DEFINER helpers.
-- The cron scanner RPCs remain available to anon because pg_net invokes them
-- with the stored cron token; those entry points validate both token and owner.
-- Their token-validation helpers themselves must not be callable by API roles.
REVOKE EXECUTE ON FUNCTION public.moneyball_cron_token_valid(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.moneyball_cron_owner_id(text) FROM PUBLIC, anon, authenticated;

-- This is a trigger function, not an application RPC. PostgreSQL still invokes
-- the attached trigger after direct EXECUTE is revoked from API roles.
REVOKE EXECUTE ON FUNCTION public.settle_moneyball_predictions_for_result() FROM PUBLIC, anon, authenticated;

-- This immutable predicate only uses pg_catalog built-ins and no unqualified
-- application objects; pinning search_path removes the mutable-path warning.
ALTER FUNCTION public.moneyball_is_european_top_two_league(text, text) SET search_path = '';
