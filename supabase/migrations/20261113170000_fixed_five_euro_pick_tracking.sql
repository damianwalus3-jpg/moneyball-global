alter table public.predictions
  add column if not exists stake numeric(10,2) not null default 5.00,
  add column if not exists potential_return numeric(12,2),
  add column if not exists profit_loss numeric(12,2);

update public.predictions
set stake = 5.00,
    potential_return = case when odds is not null and odds > 1 then round(5.00 * odds, 2) else null end,
    profit_loss = case
      when settlement_status = 'won' and odds is not null and odds > 1 then round(5.00 * (odds - 1), 2)
      when settlement_status = 'lost' then -5.00
      when settlement_status = 'void' then 0.00
      else null
    end
where verdict = 'WYBRANY';

comment on column public.predictions.stake is 'Fixed analytical stake per selected single pick; default EUR 5, not a bankroll transaction.';
comment on column public.predictions.potential_return is 'Gross payout estimate: fixed stake multiplied by stored bookmaker odds.';
comment on column public.predictions.profit_loss is 'Net single-pick result after settlement, excluding returned stake.';
