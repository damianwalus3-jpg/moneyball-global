-- Tracker-only RLS query-plan and FK index hardening.
-- Preserve the same owner/system access rules while evaluating auth.uid() once per statement.
create index if not exists moneyball_tracker_category_aliases_category_id_idx
  on public.moneyball_tracker_category_aliases(category_id);

drop policy if exists moneyball_tracker_categories_select on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_select
  on public.moneyball_tracker_categories for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

drop policy if exists moneyball_tracker_categories_insert on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_insert
  on public.moneyball_tracker_categories for insert to authenticated
  with check (owner_id = (select auth.uid()) and is_system = false);

drop policy if exists moneyball_tracker_categories_update on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_update
  on public.moneyball_tracker_categories for update to authenticated
  using (owner_id = (select auth.uid()) and is_system = false)
  with check (owner_id = (select auth.uid()) and is_system = false);

drop policy if exists moneyball_tracker_categories_delete on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_delete
  on public.moneyball_tracker_categories for delete to authenticated
  using (owner_id = (select auth.uid()) and is_system = false);

drop policy if exists moneyball_jackpot_entries_select on public.moneyball_jackpot_entries;
create policy moneyball_jackpot_entries_select
  on public.moneyball_jackpot_entries for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists moneyball_jackpot_entries_insert on public.moneyball_jackpot_entries;
create policy moneyball_jackpot_entries_insert
  on public.moneyball_jackpot_entries for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists moneyball_jackpot_entries_update on public.moneyball_jackpot_entries;
create policy moneyball_jackpot_entries_update
  on public.moneyball_jackpot_entries for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
