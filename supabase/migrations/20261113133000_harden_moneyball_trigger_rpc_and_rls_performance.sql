-- Restrict trigger-only SECURITY DEFINER helpers from direct PostgREST RPC calls.
-- Cron token helpers remain callable because RLS policies use them to authenticate scheduled writes.

revoke all on function public.apply_provider_odds_to_predictions() from public, anon, authenticated;
revoke all on function public.sync_coupon_leg_odds_from_prediction() from public, anon, authenticated;
revoke all on function public.on_coupon_leg_price_change() from public, anon, authenticated;
revoke all on function public.recalculate_coupon_price(uuid) from public, anon, authenticated;

grant execute on function public.apply_provider_odds_to_predictions() to service_role;
grant execute on function public.sync_coupon_leg_odds_from_prediction() to service_role;
grant execute on function public.on_coupon_leg_price_change() to service_role;
grant execute on function public.recalculate_coupon_price(uuid) to service_role;

alter policy moneyball_cron_manage_market_data on public.match_market_data
using (
  owner_id = (
    select public.moneyball_cron_owner_id(
      coalesce((((select current_setting('request.headers', true))::jsonb) ->> 'x-cron-token'), ''::text)
    )
  )
)
with check (
  owner_id = (
    select public.moneyball_cron_owner_id(
      coalesce((((select current_setting('request.headers', true))::jsonb) ->> 'x-cron-token'), ''::text)
    )
  )
);

alter policy moneyball_cron_read_match_results on public.match_results
using (
  owner_id = (
    select public.moneyball_cron_owner_id(
      coalesce((((select current_setting('request.headers', true))::jsonb) ->> 'x-cron-token'), ''::text)
    )
  )
);

alter policy moneyball_cron_read_matches on public.matches
using (
  owner_id = (
    select public.moneyball_cron_owner_id(
      coalesce((((select current_setting('request.headers', true))::jsonb) ->> 'x-cron-token'), ''::text)
    )
  )
);

alter policy moneyball_cron_manage_predictions on public.predictions
using (
  owner_id = (
    select public.moneyball_cron_owner_id(
      coalesce((((select current_setting('request.headers', true))::jsonb) ->> 'x-cron-token'), ''::text)
    )
  )
)
with check (
  owner_id = (
    select public.moneyball_cron_owner_id(
      coalesce((((select current_setting('request.headers', true))::jsonb) ->> 'x-cron-token'), ''::text)
    )
  )
);

alter policy provider_odds_owner_read on public.provider_odds
using (owner_id = (select auth.uid()));
