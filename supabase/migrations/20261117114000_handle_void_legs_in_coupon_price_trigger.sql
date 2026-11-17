-- Match the coupon price trigger to settlement rules: void legs are 1.00,
-- displayed combined odds use 3 decimals, and cash return uses the raw product.
create or replace function public.recalculate_coupon_price(p_coupon_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_target integer;
  v_count integer;
  v_active integer;
  v_odds_complete boolean;
  v_raw_odds numeric;
  v_odds numeric;
  v_stake numeric;
begin
  select target_legs, stake into v_target, v_stake
  from public.coupons where id = p_coupon_id;
  if not found then return; end if;

  select count(*),
         count(*) filter (where status <> 'void'),
         coalesce(bool_and(odds is not null and odds > 1) filter (where status <> 'void'), false),
         case
           when count(*) filter (where status <> 'void') > 0
             and coalesce(bool_and(odds is not null and odds > 1) filter (where status <> 'void'), false)
             then exp(sum(ln(odds::numeric)) filter (where status <> 'void'))::numeric
           when count(*) > 0 and count(*) = count(*) filter (where status = 'void') then 1::numeric
           else null
         end
    into v_count, v_active, v_odds_complete, v_raw_odds
  from public.coupon_legs
  where coupon_id = p_coupon_id;

  if v_count <> coalesce(v_target,3) then
    v_raw_odds := null;
  end if;

  v_odds := case when v_raw_odds is null then null else round(v_raw_odds,3) end;

  update public.coupons
     set combined_odds = v_odds,
         total_odds = v_odds,
         potential_return = case
           when v_stake is not null and v_raw_odds is not null then round(v_stake * v_raw_odds,2)
           else null
         end
   where id = p_coupon_id;
end;
$function$;

comment on function public.recalculate_coupon_price(uuid)
is 'Recalculates coupon price with void legs treated as 1.00; displays combined odds to 3 decimals and rounds only cash return to cents.';
