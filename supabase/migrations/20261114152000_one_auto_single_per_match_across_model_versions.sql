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
 v_coupon_status text;
 v_leg_id uuid;
 v_home text;
 v_away text;
 v_prediction_type text;
 v_name text;
begin
 v_owner := coalesce(new.owner_id,new.user_id);
 v_batch := 'AUTO_SINGLE_MATCH:' || new.match_id::text;
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
   select id into v_coupon_id
   from public.coupons
   where owner_id=v_owner and batch_id=v_batch and coupon_type='SINGLE' and status='pending'
   limit 1
   for update;
   if v_coupon_id is not null then
     return new;
   end if;

   insert into public.coupons(
     owner_id,user_id,name,batch_id,stake,total_odds,combined_probability,status,notes,
     scan_run_id,coupon_type,target_legs,combined_odds,potential_return
   ) values (
     v_owner,v_owner,v_name,v_batch,5,new.odds,new.probability,'pending',
     'AUTO_SINGLE_MATCH:' || new.match_id::text || '; FIRST_QUALIFIED_PICK:' || new.id::text,
     new.scan_run_id,'SINGLE',1,new.odds,round(5*new.odds,2)
   )
   on conflict do nothing
   returning id into v_coupon_id;

   if v_coupon_id is null then
     select id,status into v_coupon_id,v_coupon_status
     from public.coupons
     where owner_id=v_owner and batch_id=v_batch and coupon_type='SINGLE'
     limit 1
     for update;
     if v_coupon_id is null or v_coupon_status not in ('void','pending') then
       return new;
     end if;
     if v_coupon_status='void' then
       update public.coupons
       set name=v_name,stake=5,total_odds=new.odds,combined_odds=new.odds,
           combined_probability=new.probability,potential_return=round(5*new.odds,2),
           status='pending',settled_at=null,scan_run_id=new.scan_run_id,
           notes='AUTO_SINGLE_MATCH:' || new.match_id::text || '; REACTIVATED_PICK:' || new.id::text
       where id=v_coupon_id;
     else
       return new;
     end if;
   end if;

   if v_coupon_id is not null then
     select id into v_leg_id
     from public.coupon_legs
     where coupon_id=v_coupon_id and leg_number=1
     limit 1
     for update;
     if v_leg_id is not null then
       update public.coupon_legs
       set prediction_id=new.id,match_id=new.match_id,prediction_type=v_prediction_type,
           pick=new.selection,probability=new.probability,odds=new.odds,
           result_status='pending',status='pending',leg_number=1
       where id=v_leg_id;
     else
       insert into public.coupon_legs(
         owner_id,user_id,coupon_id,prediction_id,match_id,prediction_type,pick,
         probability,odds,result_status,status,leg_number
       ) values (
         v_owner,v_owner,v_coupon_id,new.id,new.match_id,v_prediction_type,new.selection,
         new.probability,new.odds,'pending','pending',1
       );
     end if;
   end if;

 elsif tg_op='UPDATE'
   and old.verdict='WYBRANY'
   and new.verdict<>'WYBRANY'
   and old.settlement_status='pending' then
   select c.id into v_coupon_id
   from public.coupons c
   join public.coupon_legs l on l.coupon_id=c.id
   where c.owner_id=v_owner and c.batch_id=v_batch and c.coupon_type='SINGLE'
     and c.status='pending' and l.prediction_id=old.id and l.status='pending'
   limit 1
   for update of c;
   if v_coupon_id is not null then
     update public.coupon_legs
     set status='void',result_status='void'
     where coupon_id=v_coupon_id and prediction_id=old.id and status='pending';
     update public.coupons
     set status='void',settled_at=now()
     where id=v_coupon_id and status='pending';
   end if;
 end if;
 return new;
end;
$function$;

with ranked as (
 select c.id,cl.match_id,
        row_number() over(partition by cl.match_id order by c.created_at asc,c.id asc) as rn
 from public.coupons c
 join public.coupon_legs cl on cl.coupon_id=c.id
 where c.owner_id='94998cf8-7058-4b6b-a1c4-dcf38d88ac7a'
   and c.coupon_type='SINGLE'
   and c.batch_id like 'AUTO_SINGLE:%'
   and c.status='pending'
)
update public.coupons c
set status='void',settled_at=now(),
    notes=concat_ws(' | ',nullif(c.notes,''),'AUTO_SINGLE_DUPLICATE_VOIDED')
from ranked r
where c.id=r.id and r.rn>1 and c.status='pending';

with ranked as (
 select c.id,cl.match_id,
        row_number() over(partition by cl.match_id order by c.created_at asc,c.id asc) as rn
 from public.coupons c
 join public.coupon_legs cl on cl.coupon_id=c.id
 where c.owner_id='94998cf8-7058-4b6b-a1c4-dcf38d88ac7a'
   and c.coupon_type='SINGLE'
   and c.batch_id like 'AUTO_SINGLE:%'
   and c.status='pending'
)
update public.coupons c
set batch_id='AUTO_SINGLE_MATCH:' || r.match_id::text,
    notes=concat_ws(' | ',nullif(c.notes,''),'AUTO_SINGLE_MATCH:' || r.match_id::text)
from ranked r
where c.id=r.id and r.rn=1;
