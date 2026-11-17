create or replace function public.enforce_moneyball_coupon_rules()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $function$
declare
  v_target integer := coalesce(new.target_legs, 3);
  v_type text := coalesce(new.coupon_type, 'TEST');
begin
  if v_target not in (1, 3) then
    raise exception 'MONEYBALL accepts only single-pick or 3-leg coupons (received target_legs=%)', new.target_legs
      using errcode = 'check_violation';
  end if;
  if v_target = 1 and v_type <> 'MAIN' then
    raise exception 'A single-pick coupon must use coupon_type MAIN (received coupon_type=%)', v_type
      using errcode = 'check_violation';
  end if;
  new.stake := 4.00;
  new.target_legs := v_target;
  return new;
end;
$function$;
