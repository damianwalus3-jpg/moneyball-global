-- PAPER coupons are tracked but excluded from official coupon finance and bankroll ledger.
CREATE OR REPLACE FUNCTION public.moneyball_cancel_coupon_for_owner(p_coupon_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if coalesce(v_coupon.source_class, 'UNCLASSIFIED') <> 'PAPER' and v_has_stake and not v_has_return and coalesce(v_coupon.stake, 0) > 0 then
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
    'refund', case when coalesce(v_coupon.source_class, 'UNCLASSIFIED') <> 'PAPER' and v_has_stake then coalesce(v_coupon.stake, 0) else 0 end,
    'balance', v_balance
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.moneyball_coupon_finance_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with owned as (
 select c.id,c.name,c.coupon_type,c.status,c.stake,c.combined_odds,
        coalesce(c.settled_at,c.created_at) settled_at,
        count(l.id)::int leg_count,
        count(l.id) filter(where l.status<>'void')::int active_leg_count,
        bool_and(coalesce(l.odds,p.odds) is not null and coalesce(l.odds,p.odds)>1)
          filter(where l.status<>'void') active_odds_complete,
        coalesce(exp(sum(ln(coalesce(l.odds,p.odds))) filter(where l.status<>'void')),c.combined_odds,1)::numeric effective_odds
 from public.coupons c
 left join public.coupon_legs l on l.coupon_id=c.id and l.owner_id=c.owner_id
 left join public.predictions p on p.id=l.prediction_id and p.owner_id=l.owner_id
 where c.owner_id=(select auth.uid()) and c.status in('won','lost','void')
   and coalesce(c.source_class, 'UNCLASSIFIED') <> 'PAPER'
 group by c.id
), financial as (
 select *,case
  when stake is null then null
  when stake=0 then 0::numeric
  when status='lost' then 0::numeric
  when status='void' then stake::numeric
  when status='won' and leg_count in(1,3)
    and (active_leg_count=0 or coalesce(active_odds_complete,false) or combined_odds>1)
    then round(stake::numeric*effective_odds,2)
  else null end payout
 from owned
), periods as (
 select
 count(*) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('day',now() at time zone 'Europe/Brussels'))::int day_count,
 count(*) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('week',now() at time zone 'Europe/Brussels'))::int week_count,
 count(*) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('month',now() at time zone 'Europe/Brussels'))::int month_count,
 count(*)::int all_count,
 coalesce(sum(stake) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('day',now() at time zone 'Europe/Brussels')),0) day_stake,
 coalesce(sum(stake) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('week',now() at time zone 'Europe/Brussels')),0) week_stake,
 coalesce(sum(stake) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('month',now() at time zone 'Europe/Brussels')),0) month_stake,
 coalesce(sum(stake),0) all_stake,
 coalesce(sum(payout) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('day',now() at time zone 'Europe/Brussels')),0) day_payout,
 coalesce(sum(payout) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('week',now() at time zone 'Europe/Brussels')),0) week_payout,
 coalesce(sum(payout) filter(where settled_at at time zone 'Europe/Brussels'>=date_trunc('month',now() at time zone 'Europe/Brussels')),0) month_payout,
 coalesce(sum(payout),0) all_payout,
 count(*) filter(where payout is null and settled_at at time zone 'Europe/Brussels'>=date_trunc('day',now() at time zone 'Europe/Brussels'))::int day_incomplete,
 count(*) filter(where payout is null and settled_at at time zone 'Europe/Brussels'>=date_trunc('week',now() at time zone 'Europe/Brussels'))::int week_incomplete,
 count(*) filter(where payout is null and settled_at at time zone 'Europe/Brussels'>=date_trunc('month',now() at time zone 'Europe/Brussels'))::int month_incomplete,
 count(*) filter(where payout is null)::int all_incomplete
 from financial
), by_type as (
 select coalesce(jsonb_object_agg(coupon_type,jsonb_build_object(
 'count',n,'stake',stake,'payout',payout,'net',case when incomplete>0 then null else round(payout-stake,2) end,
 'incomplete',incomplete,'won',won,'lost',lost,'void',void)),'{}'::jsonb) data
 from (select coupon_type,count(*)::int n,coalesce(sum(stake),0) stake,coalesce(sum(payout),0) payout,
 count(*) filter(where payout is null)::int incomplete,count(*) filter(where status='won')::int won,
 count(*) filter(where status='lost')::int lost,count(*) filter(where status='void')::int void
 from financial group by coupon_type)t
), history as (
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'coupon_type',coupon_type,'status',status,
 'stake',stake,'odds',coalesce(combined_odds,effective_odds),'settled_at',settled_at,'payout',payout,
 'net',case when payout is null or stake is null then null else round(payout-stake,2) end)
 order by settled_at desc),'[]'::jsonb) rows
 from(select * from financial order by settled_at desc limit 25) recent
)
select jsonb_build_object(
 'day',jsonb_build_object('count',day_count,'stake',day_stake,'payout',day_payout,'net',case when day_incomplete>0 then null else round(day_payout-day_stake,2) end,'incomplete',day_incomplete),
 'week',jsonb_build_object('count',week_count,'stake',week_stake,'payout',week_payout,'net',case when week_incomplete>0 then null else round(week_payout-week_stake,2) end,'incomplete',week_incomplete),
 'month',jsonb_build_object('count',month_count,'stake',month_stake,'payout',month_payout,'net',case when month_incomplete>0 then null else round(month_payout-month_stake,2) end,'incomplete',month_incomplete),
 'all',jsonb_build_object('count',all_count,'stake',all_stake,'payout',all_payout,'net',case when all_incomplete>0 then null else round(all_payout-all_stake,2) end,'incomplete',all_incomplete),
 'by_type',by_type.data,'history',history.rows
) from periods cross join by_type cross join history;
$function$
;

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
  v_raw_odds numeric;
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

  perform pg_advisory_xact_lock(hashtextextended(v_coupon.owner_id::text, 0));

  select count(*),
         count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'void'),
         count(*) filter (where status <> 'void'),
         coalesce(bool_and(odds is not null and odds > 1) filter (where status <> 'void'), false),
         case
           when count(*) filter (where status <> 'void') > 0
             and coalesce(bool_and(odds is not null and odds > 1) filter (where status <> 'void'), false)
             then exp(sum(ln(odds::numeric)) filter (where status <> 'void'))::numeric
           when count(*) > 0 and count(*) = count(*) filter (where status = 'void') then 1::numeric
           else null
         end
    into v_leg_count, v_pending, v_lost, v_void, v_active, v_odds_complete, v_raw_odds
  from public.coupon_legs
  where coupon_id = p_coupon_id and owner_id = v_coupon.owner_id;

  v_odds := case when v_raw_odds is null then null else round(v_raw_odds, 3) end;

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

  v_potential := case
    when v_raw_odds is not null then round(coalesce(v_coupon.stake,0) * v_raw_odds, 2)
    else null
  end;

  update public.coupons
     set status = v_status,
         combined_odds = coalesce(v_odds, combined_odds),
         total_odds = coalesce(v_odds, total_odds),
         potential_return = coalesce(v_potential, potential_return),
         settled_at = case when v_status = 'pending' then null else coalesce(settled_at, v_now) end
   where id = p_coupon_id;

  if coalesce(v_coupon.source_class, 'UNCLASSIFIED') <> 'PAPER' then
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
      when v_status = 'won' and v_raw_odds is not null then v_potential
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
  else
    v_payout := null;
    select balance_after into v_balance
    from public.bankroll_transactions
    where owner_id = v_coupon.owner_id
    order by occurred_at desc, id desc
    limit 1;
  end if;

  return jsonb_build_object(
    'ok', true, 'coupon_id', p_coupon_id, 'status', v_status,
    'legs', v_leg_count, 'pending_legs', v_pending,
    'odds', v_odds, 'potential_return', v_potential,
    'payout', v_payout, 'balance', v_balance
  );
end;
$function$
;
