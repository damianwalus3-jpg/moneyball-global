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
