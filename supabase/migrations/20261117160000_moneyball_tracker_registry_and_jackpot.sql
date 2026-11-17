-- MONEYBALL GLOBAL Tracker registry and Jackpot foundation.
-- Additive only: no existing prediction, coupon, result, or bankroll row is rewritten.
-- System categories and legacy aliases are read-only; owner-created categories remain owner-scoped.
-- Jackpot numbering is generated once and cannot be edited or deleted through the authenticated API.

alter table public.predictions
  add column if not exists decision_status text,
  add column if not exists source_class text;

alter table public.coupons
  add column if not exists source_class text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'predictions_decision_status_check') then
    alter table public.predictions
      add constraint predictions_decision_status_check
      check (decision_status is null or decision_status in (
        'FINAL', 'WATCH', 'LEAN', 'CONDITIONAL', 'REJECTED', 'PASS', 'PAPER'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'predictions_source_class_check') then
    alter table public.predictions
      add constraint predictions_source_class_check
      check (source_class is null or source_class in ('USER', 'MODEL', 'PAPER'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_source_class_check') then
    alter table public.coupons
      add constraint coupons_source_class_check
      check (source_class is null or source_class in ('USER', 'MODEL', 'PAPER'));
  end if;
end $$;

create table if not exists public.moneyball_tracker_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  category_key text not null,
  display_name text not null,
  description text,
  category_group text not null check (category_group in ('CORE', 'SPORT', 'LEGACY')),
  sort_order integer not null default 0,
  is_system boolean not null default false,
  include_in_official_finance boolean not null default false,
  created_at timestamptz not null default now(),
  constraint moneyball_tracker_categories_system_owner_check
    check ((is_system and owner_id is null) or (not is_system and owner_id is not null))
);

create unique index if not exists moneyball_tracker_categories_system_key_uq
  on public.moneyball_tracker_categories(category_key) where owner_id is null;
create unique index if not exists moneyball_tracker_categories_owner_key_uq
  on public.moneyball_tracker_categories(owner_id, category_key) where owner_id is not null;

alter table public.moneyball_tracker_categories enable row level security;
revoke all on public.moneyball_tracker_categories from anon;
grant select, insert, update, delete on public.moneyball_tracker_categories to authenticated;

drop policy if exists moneyball_tracker_categories_select on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_select
  on public.moneyball_tracker_categories for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

drop policy if exists moneyball_tracker_categories_insert on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_insert
  on public.moneyball_tracker_categories for insert to authenticated
  with check (owner_id = auth.uid() and is_system = false);

drop policy if exists moneyball_tracker_categories_update on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_update
  on public.moneyball_tracker_categories for update to authenticated
  using (owner_id = auth.uid() and is_system = false)
  with check (owner_id = auth.uid() and is_system = false);

drop policy if exists moneyball_tracker_categories_delete on public.moneyball_tracker_categories;
create policy moneyball_tracker_categories_delete
  on public.moneyball_tracker_categories for delete to authenticated
  using (owner_id = auth.uid() and is_system = false);

comment on table public.moneyball_tracker_categories is
  'Owner-scoped MONEYBALL Tracker categories plus immutable global system categories.';

insert into public.moneyball_tracker_categories
  (owner_id, category_key, display_name, description, category_group, sort_order, is_system, include_in_official_finance)
values
  (null, 'TYP_DNIA', 'TYP DNIA', 'Główny wybór dnia', 'CORE', 10, true, false),
  (null, 'MAIN_A', 'MAIN A', 'Podstawowy rejestr MAIN A', 'CORE', 20, true, false),
  (null, 'MAIN_B', 'MAIN B', 'Podstawowy rejestr MAIN B', 'CORE', 30, true, false),
  (null, 'EXTRA', 'EXTRA', 'Dodatkowe selekcje i kupony', 'CORE', 40, true, false),
  (null, 'MEGA', 'MEGA', 'Kupony MEGA', 'CORE', 50, true, false),
  (null, 'LOW_LEAGUE', 'LOW LEAGUE', 'Osobny rejestr niższych lig', 'CORE', 60, true, false),
  (null, 'MULTI_SPORT', 'MULTI-SPORT', 'Wydarzenia spoza piłki nożnej', 'SPORT', 70, true, false),
  (null, 'NHL_NBA', 'NHL / NBA', 'Osobne rejestry hokeja i koszykówki', 'SPORT', 80, true, false),
  (null, 'JACKPOT', 'JACKPOT', 'Kupony z niezmienną numeracją', 'CORE', 90, true, false),
  (null, 'LEGACY_MAIN', 'MAIN · legacy', 'Historyczna grupa MAIN — bez automatycznego przepisywania do MAIN A/B', 'LEGACY', 110, true, false),
  (null, 'LEGACY_GOALS', 'GOALS · legacy', 'Historyczna grupa GOALS', 'LEGACY', 120, true, false),
  (null, 'LEGACY_TEST', 'TEST · legacy', 'Historyczne wpisy testowe', 'LEGACY', 130, true, false),
  (null, 'LEGACY_BASELINE', 'BASELINE / NISKA WIARYGODNOŚĆ', 'Historyczna grupa zachowana bez zmiany', 'LEGACY', 140, true, false),
  (null, 'LEGACY_MARKET_DATA_TEST', 'MARKET DATA / TEST', 'Historyczna grupa techniczna zachowana bez zmiany', 'LEGACY', 150, true, false);

create table if not exists public.moneyball_tracker_category_aliases (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('predictions', 'coupons')),
  source_value text not null,
  category_id uuid not null references public.moneyball_tracker_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint moneyball_tracker_category_aliases_source_uq unique (source_table, source_value)
);

alter table public.moneyball_tracker_category_aliases enable row level security;
revoke all on public.moneyball_tracker_category_aliases from anon;
grant select on public.moneyball_tracker_category_aliases to authenticated;

drop policy if exists moneyball_tracker_category_aliases_select on public.moneyball_tracker_category_aliases;
create policy moneyball_tracker_category_aliases_select
  on public.moneyball_tracker_category_aliases for select to authenticated
  using (true);

insert into public.moneyball_tracker_category_aliases (source_table, source_value, category_id)
select v.source_table, v.source_value, c.id
from (values
  ('predictions', 'MAIN A', 'MAIN_A'),
  ('predictions', 'MAIN B', 'MAIN_B'),
  ('predictions', 'EXTRA', 'EXTRA'),
  ('predictions', 'MEGA', 'MEGA'),
  ('predictions', 'MAIN', 'LEGACY_MAIN'),
  ('predictions', 'GOALS', 'LEGACY_GOALS'),
  ('predictions', 'TEST', 'LEGACY_TEST'),
  ('predictions', 'BASELINE / NISKA WIARYGODNOŚĆ', 'LEGACY_BASELINE'),
  ('predictions', 'MARKET DATA / TEST', 'LEGACY_MARKET_DATA_TEST'),
  ('coupons', 'MAIN', 'LEGACY_MAIN'),
  ('coupons', 'MEGA', 'MEGA'),
  ('coupons', 'EXTRA', 'EXTRA'),
  ('coupons', 'TEST', 'LEGACY_TEST')
) as v(source_table, source_value, category_key)
join public.moneyball_tracker_categories c
  on c.category_key = v.category_key and c.owner_id is null;

create unique index if not exists moneyball_coupons_owner_id_id_uq
  on public.coupons(owner_id, id);

create table if not exists public.moneyball_jackpot_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sequence_no bigint generated always as identity unique,
  coupon_id uuid not null,
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint moneyball_jackpot_entries_owner_coupon_uq unique (owner_id, coupon_id),
  constraint moneyball_jackpot_entries_coupon_owner_fk
    foreign key (owner_id, coupon_id)
    references public.coupons(owner_id, id) on delete restrict
);

alter table public.moneyball_jackpot_entries enable row level security;
revoke all on public.moneyball_jackpot_entries from anon;
grant select, insert, update on public.moneyball_jackpot_entries to authenticated;

drop policy if exists moneyball_jackpot_entries_select on public.moneyball_jackpot_entries;
create policy moneyball_jackpot_entries_select
  on public.moneyball_jackpot_entries for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists moneyball_jackpot_entries_insert on public.moneyball_jackpot_entries;
create policy moneyball_jackpot_entries_insert
  on public.moneyball_jackpot_entries for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists moneyball_jackpot_entries_update on public.moneyball_jackpot_entries;
create policy moneyball_jackpot_entries_update
  on public.moneyball_jackpot_entries for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.moneyball_jackpot_entries_guard_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.sequence_no is distinct from old.sequence_no then
    raise exception 'Jackpot sequence numbers are immutable';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Jackpot ownership is immutable';
  end if;
  if new.coupon_id is distinct from old.coupon_id then
    raise exception 'Jackpot coupon links are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.moneyball_jackpot_entries_guard_update() from public, anon, authenticated;

drop trigger if exists moneyball_jackpot_entries_guard_update on public.moneyball_jackpot_entries;
create trigger moneyball_jackpot_entries_guard_update
  before update on public.moneyball_jackpot_entries
  for each row execute function public.moneyball_jackpot_entries_guard_update();

comment on table public.moneyball_jackpot_entries is
  'Append-only owner-scoped Jackpot register. Sequence number is generated once and immutable; entries are not deletable through authenticated API.';
