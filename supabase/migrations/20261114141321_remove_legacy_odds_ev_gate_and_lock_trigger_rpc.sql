create or replace function public.moneyball_sync_auto_single_coupon()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 v_owner uuid;
 v_batch text;
 v_coupon_id uuid;
 v_home text;
 v_away text;
 v_prediction_type text;
 v_name text;
begin
 v_owner := coalesce(new.owner_id,new.user_id);
 v_batch := 'AUTO_SINGLE:' || new.id::text;
 v_prediction_type := case
   when new.market='GOALS' then 'GOALS'
   when new.market='DOUBLE_CHANCE' then 'DC'
   else '1X2'
 end;
 select home_team,away_team into v_home,v_away
 from public.matches
 where id=new.match_id and owner_id=v_owner
 limit 1;
 v_name := 'Pojedynczy: ' || coalesce(v_home,'Mecz') || ' – ' || coalesce(v_away,'') || ' (' || coalesce(new.selection,'') || ')';

 if new.verdict='WYBRANY'
    and new.settlement_status='pending'
    and new.stake=5
    and new.probability>75
    and new.odds is not null
    and new.odds>1 then

   insert into public.coupons(
     owner_id,user_id,name,batch_id,stake,total_odds,combined_probability,status,notes,
     scan_run_id,coupon_type,target_legs,combined_odds,potential_return
   ) values (
     v_owner,v_owner,v_name,v_batch,5,new.odds,new.probability,'pending',
     'AUTO_SINGLE_PREDICTION:' || new.id::text,
     new.scan_run_id,'SINGLE',1,new.odds,round(5*new.odds,2)
   )
   on conflict do nothing
   returning id into v_coupon_id;

   if v_coupon_id is null then
     select id into v_coupon_id
     from public.coupons
     where owner_id=v_owner and batch_id=v_batch and coupon_type='SINGLE'
     limit 1
     for update;
   end if;

   if v_coupon_id is not null then
     update public.coupons
     set name=v_name,stake=5,total_odds=new.odds,combined_odds=new.odds,
         combined_probability=new.probability,potential_return=round(5*new.odds,2),
         status='pending',settled_at=null,scan_run_id=new.scan_run_id
     where id=v_coupon_id;

     if not exists (
       select 1 from public.coupon_legs
       where coupon_id=v_coupon_id and prediction_id=new.id
     ) then
       insert into public.coupon_legs(
         owner_id,user_id,coupon_id,prediction_id,match_id,prediction_type,pick,
         probability,odds,result_status,status,leg_number
       ) values (
         v_owner,v_owner,v_coupon_id,new.id,new.match_id,v_prediction_type,new.selection,
         new.probability,new.odds,'pending','pending',1
       );
     else
       update public.coupon_legs
       set prediction_type=v_prediction_type,pick=new.selection,
           probability=new.probability,odds=new.odds,
           result_status='pending',status='pending'
       where coupon_id=v_coupon_id and prediction_id=new.id;
     end if;
   end if;

 elsif tg_op='UPDATE'
   and old.verdict='WYBRANY'
   and new.verdict<>'WYBRANY'
   and old.settlement_status='pending' then

   select id into v_coupon_id
   from public.coupons
   where owner_id=v_owner and batch_id=v_batch and coupon_type='SINGLE'
   limit 1;

   if v_coupon_id is not null then
     update public.coupon_legs
     set status='void',result_status='void'
     where coupon_id=v_coupon_id and status='pending';
     update public.coupons
     set status='void',settled_at=now()
     where id=v_coupon_id and status='pending';
   end if;
 end if;

 return new;
end;
$function$;

revoke all on function public.moneyball_cron_request_allowed(uuid) from anon;
revoke all on function public.moneyball_sync_auto_single_coupon() from anon, authenticated;
grant execute on function public.moneyball_cron_request_allowed(uuid) to service_role;
