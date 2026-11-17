CREATE OR REPLACE FUNCTION public.moneyball_reconcile_coupon_finance(p_coupon_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_coupon public.coupons%rowtype;
  v_leg_count integer;
  v_target integer;
  v_pending integer;
  v_lost integer;
  v_void integer;
  v_active integer;
  v_odds_complete boolean;
  v_odds numeric;
  v_potential numeric;
  v_status text;
  v_payout numeric;
  v_now timestamptz := clock_timestamp();
  v_balance numeric;
begin
  select * into v_coupon
  from public.coupons
  where id = p_coupon_id
  for update;

  if not found or v_coupon.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'coupon_missing_or_cancelled');
  end if;

  -- Serialize ledger rebuilds for all coupons belonging to the same bankroll owner.
  perform pg_advisory_xact_lock(hashtextextended(v_coupon.owner_id::text, 0));

  select count(*),
         count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'void'),
         count(*) filter (where status <> 'void'),
         coalesce(bool_and(odds is not null and odds > 1) filter (where status <> 'void'), false),
         case when count(*) filter (where status <> 'void') > 0
              and coalesce(bool_and(odds is not null and odds > 1) filter (where status <> 'void'), false)
              then round(exp(sum(ln(odds::double precision)) filter (where status <> 'void'))::numeric, 2)
              when count(*) > 0 and count(*) = count(*) filter (where status = 'void') then 1
              else null end
    into v_leg_count, v_pending, v_lost, v_void, v_active, v_odds_complete, v_odds
  from public.coupon_legs
  where coupon_id = p_coupon_id and owner_id = v_coupon.owner_id;

  v_target := coalesce(v_coupon.target_legs, 3);
  if v_leg_count = 0 or v_leg_count <> v_target then
    v_status := 'pending';
  elsif v_lost > 0 then
    v_status := 'lost';
  elsif v_pending > 0 then
    v_status := 'pending';
  elsif v_active = 0 then
    v_status := 'void';
  else
    v_status := 'won';
  end if;

  v_potential := case when v_odds is not null then round(coalesce(v_coupon.stake,0) * v_odds, 2) else null end;
  update public.coupons
     set status = v_status,
         combined_odds = coalesce(v_odds, combined_odds),
         total_odds = coalesce(v_odds, total_odds),
         potential_return = coalesce(v_potential, potential_return),
         settled_at = case when v_status = 'pending' then null else coalesce(settled_at, v_now) end
   where id = p_coupon_id;

  -- A coupon's stake is booked once. The partial unique index is the final race guard.
  if coalesce(v_coupon.stake,0) > 0 then
    insert into public.bankroll_transactions
      (owner_id, coupon_id, transaction_type, amount, balance_after, occurred_at, note)
    values
      (v_coupon.owner_id, p_coupon_id, 'stake', v_coupon.stake, null,
       coalesce(v_coupon.created_at, v_now), 'Stawka kuponu ' || coalesce(v_coupon.name,'MONEYBALL'))
    on conflict (coupon_id) where coupon_id is not null and transaction_type = 'stake'
    do nothing;
  end if;

  v_payout := case
    when v_status = 'lost' then null
    when v_status = 'void' then coalesce(v_coupon.stake,0)
    when v_status = 'won' and v_odds is not null then v_potential
    else null
  end;

  if v_payout is null then
    delete from public.bankroll_transactions
     where coupon_id = p_coupon_id and transaction_type = 'return';
  else
    insert into public.bankroll_transactions
      (owner_id, coupon_id, transaction_type, amount, balance_after, occurred_at, note)
    values
      (v_coupon.owner_id, p_coupon_id, 'return', v_payout, null, v_now,
       'Automatyczne rozliczenie MONEYBALL: ' || coalesce(v_coupon.name,'kupon'))
    on conflict (coupon_id) where coupon_id is not null and transaction_type = 'return'
    do update set amount = excluded.amount, occurred_at = excluded.occurred_at, note = excluded.note;
  end if;

  -- Rebuild balances deterministically in the same transaction, serialized per owner.
  with ledger as (
    select id,
           round(sum(
             case
               when transaction_type in ('deposit','return') then abs(amount)
               when transaction_type = 'adjustment' then amount
               else -abs(amount)
             end
           ) over (partition by owner_id order by occurred_at, id rows between unbounded preceding and current row), 2) as running_balance
    from public.bankroll_transactions
    where owner_id = v_coupon.owner_id
  )
  update public.bankroll_transactions bt
     set balance_after = ledger.running_balance
    from ledger
   where bt.id = ledger.id
     and bt.balance_after is distinct from ledger.running_balance;

  select balance_after into v_balance
  from public.bankroll_transactions
  where owner_id = v_coupon.owner_id
  order by occurred_at desc, id desc
  limit 1;

  return jsonb_build_object(
    'ok', true, 'coupon_id', p_coupon_id, 'status', v_status,
    'legs', v_leg_count, 'pending_legs', v_pending,
    'odds', v_odds, 'potential_return', v_potential,
    'payout', v_payout, 'balance', v_balance
  );
end;
$function$
;

create or replace function public.moneyball_reconcile_coupon_finance_for_owner(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_coupon_owner uuid;
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select owner_id into v_coupon_owner
  from public.coupons
  where id = p_coupon_id;

  if not found or v_coupon_owner is distinct from v_owner then
    raise exception 'coupon not found' using errcode = '42501';
  end if;

  return public.moneyball_reconcile_coupon_finance(p_coupon_id);
end;
$function$;

alter function public.moneyball_reconcile_coupon_finance_for_owner(uuid) owner to postgres;
revoke all on function public.moneyball_reconcile_coupon_finance_for_owner(uuid) from public, anon;
grant execute on function public.moneyball_reconcile_coupon_finance_for_owner(uuid) to authenticated;

create or replace function public.moneyball_cancel_coupon_for_owner(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_coupon public.coupons%rowtype;
  v_has_stake boolean;
  v_has_return boolean;
  v_balance numeric;
  v_now timestamptz := clock_timestamp();
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_coupon
  from public.coupons
  where id = p_coupon_id and owner_id = v_owner
  for update;

  if not found then
    raise exception 'coupon not found' using errcode = '42501';
  end if;
  if v_coupon.status <> 'pending' then
    raise exception 'only pending coupons can be cancelled' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));

  update public.coupon_legs
     set status = 'void',
         result_status = 'void'
   where owner_id = v_owner
     and coupon_id = p_coupon_id
     and status is distinct from 'void';

  update public.coupons
     set status = 'cancelled',
         settled_at = v_now
   where id = p_coupon_id and owner_id = v_owner;

  select exists (
    select 1 from public.bankroll_transactions
    where owner_id = v_owner and coupon_id = p_coupon_id and transaction_type = 'stake'
  ) into v_has_stake;

  select exists (
    select 1 from public.bankroll_transactions
    where owner_id = v_owner and coupon_id = p_coupon_id and transaction_type = 'return'
  ) into v_has_return;

  if v_has_stake and not v_has_return and coalesce(v_coupon.stake, 0) > 0 then
    insert into public.bankroll_transactions
      (owner_id, coupon_id, transaction_type, amount, balance_after, occurred_at, note)
    values
      (v_owner, p_coupon_id, 'return', v_coupon.stake, null, v_now,
       'Zwrot anulowanego kuponu: ' || coalesce(v_coupon.name, 'MONEYBALL'))
    on conflict (coupon_id) where coupon_id is not null and transaction_type = 'return'
    do nothing;
  end if;

  with ledger as (
    select id,
      round(sum(
        case
          when transaction_type in ('deposit','return') then abs(amount)
          when transaction_type = 'adjustment' then amount
          else -abs(amount)
        end
      ) over (partition by owner_id order by occurred_at, id rows between unbounded preceding and current row), 2) as running_balance
    from public.bankroll_transactions
    where owner_id = v_owner
  )
  update public.bankroll_transactions bt
     set balance_after = ledger.running_balance
    from ledger
   where bt.id = ledger.id
     and bt.balance_after is distinct from ledger.running_balance;

  select balance_after into v_balance
  from public.bankroll_transactions
  where owner_id = v_owner
  order by occurred_at desc, id desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'coupon_id', p_coupon_id,
    'status', 'cancelled',
    'refund', case when v_has_stake then coalesce(v_coupon.stake, 0) else 0 end,
    'balance', v_balance
  );
end;
$function$;

alter function public.moneyball_cancel_coupon_for_owner(uuid) owner to postgres;
revoke all on function public.moneyball_cancel_coupon_for_owner(uuid) from public, anon;
grant execute on function public.moneyball_cancel_coupon_for_owner(uuid) to authenticated;

comment on function public.moneyball_reconcile_coupon_finance_for_owner(uuid)
is 'Owner-scoped browser wrapper for the service-role coupon finance reconciliation RPC.';
comment on function public.moneyball_cancel_coupon_for_owner(uuid)
is 'Atomically cancels an owner-scoped pending coupon, voids its legs, refunds an existing stake once and rebuilds ledger balances.';
