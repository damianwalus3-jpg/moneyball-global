CREATE INDEX IF NOT EXISTS moneyball_scan_runs_owner_id_id_idx ON public.scan_runs (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_matches_owner_id_id_idx ON public.matches (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_predictions_owner_id_id_idx ON public.predictions (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_coupons_owner_id_id_idx ON public.coupons (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_coupon_legs_owner_id_id_idx ON public.coupon_legs (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_match_results_owner_id_id_idx ON public.match_results (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_odds_snapshots_owner_id_id_idx ON public.odds_snapshots (owner_id, id);
CREATE INDEX IF NOT EXISTS moneyball_bankroll_owner_id_id_idx ON public.bankroll_transactions (owner_id, id);
