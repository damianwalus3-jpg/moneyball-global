-- The test app uses owner_id as its canonical tenant key. Keep old user_id aliases optional.
alter table public.scan_runs alter column user_id drop not null;
alter table public.matches alter column user_id drop not null;
alter table public.predictions alter column user_id drop not null;
alter table public.coupons alter column user_id drop not null;
alter table public.coupon_legs alter column user_id drop not null;
alter table public.match_results alter column user_id drop not null;
alter table public.odds_snapshots alter column user_id drop not null;
alter table public.bankroll_transactions alter column user_id drop not null;

-- Trigger-only SECURITY DEFINER helpers must not be callable through PostgREST RPC.
revoke all on function public.apply_provider_odds_to_predictions() from public, anon, authenticated;
revoke all on function public.sync_coupon_leg_odds_from_prediction() from public, anon, authenticated;
revoke all on function public.on_coupon_leg_price_change() from public, anon, authenticated;
revoke all on function public.recalculate_coupon_price(uuid) from public, anon, authenticated;
grant execute on function public.apply_provider_odds_to_predictions() to service_role;
grant execute on function public.sync_coupon_leg_odds_from_prediction() to service_role;
grant execute on function public.on_coupon_leg_price_change() to service_role;
grant execute on function public.recalculate_coupon_price(uuid) to service_role;
