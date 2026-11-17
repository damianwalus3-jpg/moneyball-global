alter table public.predictions alter column stake set default 4.00;

create or replace function public.moneyball_coupon_default_stake()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $function$
begin
  new.stake := coalesce(new.stake, 4.00);
  return new;
end;
$function$;

comment on column public.predictions.stake is 'Fixed analytical stake per selected single pick; default EUR 4, not a bankroll transaction.';

comment on column public.coupons.stake is 'Fixed virtual analytical stake per coupon; EUR 4.';
