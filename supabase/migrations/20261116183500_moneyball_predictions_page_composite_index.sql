create index if not exists moneyball_predictions_owner_market_created_idx
on public.predictions (owner_id, market, created_at desc, id desc)
include (model_version, verdict, settlement_status, verified);