-- Provide an explicit bucket for legacy predictions with missing or unknown group labels.
-- Existing prediction rows are not rewritten.
insert into public.moneyball_tracker_categories
  (owner_id, category_key, display_name, description, category_group, sort_order, is_system, include_in_official_finance)
select null, 'UNCLASSIFIED', 'UNCLASSIFIED', 'Historyczne wpisy bez rozpoznanej kategorii lub etykiety group_name', 'LEGACY', 160, true, false
where not exists (
  select 1 from public.moneyball_tracker_categories
  where owner_id is null and category_key = 'UNCLASSIFIED'
);

insert into public.moneyball_tracker_category_aliases (source_table, source_value, category_id)
select 'predictions', '__NULL__', c.id
from public.moneyball_tracker_categories c
where c.owner_id is null and c.category_key = 'UNCLASSIFIED'
  and not exists (
    select 1 from public.moneyball_tracker_category_aliases a
    where a.source_table = 'predictions' and a.source_value = '__NULL__'
  );
