create unique index if not exists bankroll_transactions_coupon_type_uidx
on public.bankroll_transactions(owner_id,coupon_id,transaction_type)
where coupon_id is not null and transaction_type in ('stake','return');

create or replace function public.moneyball_sync_coupon_bankroll()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 v_owner uuid;
 v_return numeric;
 v_when timestamptz;
begin
 if tg_op='DELETE' then
   v_owner:=coalesce(old.owner_id,old.user_id);
   delete from public.bankroll_transactions
   where owner_id=v_owner and coupon_id=old.id and transaction_type in ('stake','return');
   return old;
 end if;

 v_owner:=coalesce(new.owner_id,new.user_id);
 if new.coupon_type='TEST' or new.stake is null or new.stake<=0 then
   delete from public.bankroll_transactions
   where owner_id=v_owner and coupon_id=new.id and transaction_type in ('stake','return');
   return new;
 end if;

 v_when:=coalesce(new.created_at,now());
 insert into public.bankroll_transactions(
   owner_id,user_id,coupon_id,transaction_type,type,amount,occurred_at,note
 ) values (
   v_owner,v_owner,new.id,'stake','stake',new.stake,v_when,
   'Stawka wirtualna: '||coalesce(new.name,'kupon')
 )
 on conflict (owner_id,coupon_id,transaction_type)
 where coupon_id is not null and transaction_type in ('stake','return')
 do update set amount=excluded.amount,occurred_at=excluded.occurred_at,note=excluded.note;

 v_return:=case
   when new.status='won' then greatest(coalesce(new.potential_return,0),0)
   when new.status='void' then greatest(coalesce(new.stake,0),0)
   else 0
 end;

 if v_return>0 then
   insert into public.bankroll_transactions(
     owner_id,user_id,coupon_id,transaction_type,type,amount,occurred_at,note
   ) values (
     v_owner,v_owner,new.id,'return','payout',v_return,coalesce(new.settled_at,now()),
     case when new.status='void' then 'Zwrot stawki (kupon anulowany): ' else 'Wypłata kuponu: ' end||coalesce(new.name,'kupon')
   )
   on conflict (owner_id,coupon_id,transaction_type)
   where coupon_id is not null and transaction_type in ('stake','return')
   do update set amount=excluded.amount,occurred_at=excluded.occurred_at,note=excluded.note;
 else
   delete from public.bankroll_transactions
   where owner_id=v_owner and coupon_id=new.id and transaction_type='return';
 end if;

 return new;
end;
$function$;

drop trigger if exists moneyball_sync_coupon_bankroll on public.coupons;
create trigger moneyball_sync_coupon_bankroll
after insert or update of status,stake,potential_return,coupon_type,name,settled_at or delete
on public.coupons
for each row execute function public.moneyball_sync_coupon_bankroll();

update public.coupons
set stake=stake
where coalesce(coupon_type,'MAIN')<>'TEST';
