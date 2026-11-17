CREATE OR REPLACE FUNCTION public.moneyball_tracker_category_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with unclassified as (
  select id
  from public.moneyball_tracker_categories
  where owner_id is null and category_key = 'UNCLASSIFIED'
  limit 1
),
prediction_counts as (
  select coalesce(a.category_id, (select id from unclassified)) as category_id,
         count(*)::bigint as record_count
  from public.predictions p
  left join public.moneyball_tracker_category_aliases a
    on a.source_table = 'predictions'
   and a.source_value = coalesce(nullif(upper(btrim(p.group_name)), ''), '__NULL__')
  where p.owner_id = auth.uid()
  group by 1
),
coupon_counts as (
  select coalesce(a.category_id, (select id from unclassified)) as category_id,
         count(*)::bigint as record_count
  from public.coupons c
  left join public.moneyball_tracker_category_aliases a
    on a.source_table = 'coupons'
   and a.source_value = coalesce(nullif(upper(btrim(c.coupon_type)), ''), '__NULL__')
  where c.owner_id = auth.uid()
  group by 1
),
category_rows as (
  select c.category_key, c.display_name, c.category_group, c.sort_order,
         coalesce(p.record_count, 0)::bigint as prediction_count,
         coalesce(k.record_count, 0)::bigint as coupon_count
  from public.moneyball_tracker_categories c
  left join prediction_counts p on p.category_id = c.id
  left join coupon_counts k on k.category_id = c.id
  where c.owner_id is null or c.owner_id = auth.uid()
),
decision_counts as (
  select case
    when p.decision_status is not null then p.decision_status
    when p.verdict = 'WYBRANY' then 'FINAL'
    when p.verdict = 'ODRZUCONY' then 'REJECTED'
    when p.verdict = 'WSTĘPNY' then 'PRELIMINARY'
    when p.verdict = 'BRAK DANYCH' then 'NO_DATA'
    else 'UNKNOWN'
  end as label, count(*)::bigint as record_count
  from public.predictions p
  where p.owner_id = auth.uid()
  group by 1
),
prediction_sources as (
  select coalesce(p.source_class, 'UNCLASSIFIED') as label, count(*)::bigint as record_count
  from public.predictions p
  where p.owner_id = auth.uid()
  group by 1
),
coupon_sources as (
  select coalesce(c.source_class, 'UNCLASSIFIED') as label, count(*)::bigint as record_count
  from public.coupons c
  where c.owner_id = auth.uid()
  group by 1
),
prediction_settlements as (
  select upper(coalesce(nullif(p.settlement_status, ''), 'PENDING')) as label,
         count(*)::bigint as record_count
  from public.predictions p
  where p.owner_id = auth.uid()
  group by 1
),
coupon_settlements as (
  select upper(coalesce(nullif(c.status, ''), 'PENDING')) as label,
         count(*)::bigint as record_count
  from public.coupons c
  where c.owner_id = auth.uid()
  group by 1
)
select jsonb_build_object(
  'categories', coalesce((
    select jsonb_agg(jsonb_build_object(
      'category_key', category_key,
      'display_name', display_name,
      'category_group', category_group,
      'prediction_count', prediction_count,
      'coupon_count', coupon_count
    ) order by sort_order)
    from category_rows
  ), '[]'::jsonb),
  'decisions', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', record_count) order by label) from decision_counts), '[]'::jsonb),
  'prediction_sources', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', record_count) order by label) from prediction_sources), '[]'::jsonb),
  'coupon_sources', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', record_count) order by label) from coupon_sources), '[]'::jsonb),
  'prediction_settlements', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', record_count) order by label) from prediction_settlements), '[]'::jsonb),
  'coupon_settlements', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', record_count) order by label) from coupon_settlements), '[]'::jsonb)
);
$function$
;
revoke all on function public.moneyball_tracker_category_summary() from public, anon;
grant execute on function public.moneyball_tracker_category_summary() to authenticated;
comment on function public.moneyball_tracker_category_summary() is 'Owner-scoped aggregate Tracker counts; avoids downloading the full predictions table.';
