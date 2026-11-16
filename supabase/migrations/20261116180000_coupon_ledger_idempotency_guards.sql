-- Prevent duplicate stake/payout ledger rows when overlapping retries race.
-- Existing rows were checked for duplicate (coupon_id, transaction_type) pairs.
create unique index if not exists moneyball_bankroll_coupon_stake_once_idx
  on public.bankroll_transactions (coupon_id)
  where coupon_id is not null and transaction_type = 'stake';

create unique index if not exists moneyball_bankroll_coupon_return_once_idx
  on public.bankroll_transactions (coupon_id)
  where coupon_id is not null and transaction_type = 'return';

comment on index public.moneyball_bankroll_coupon_stake_once_idx is
  'Idempotency guard: at most one stake ledger transaction per coupon.';
comment on index public.moneyball_bankroll_coupon_return_once_idx is
  'Idempotency guard: at most one payout/return ledger transaction per coupon.';
