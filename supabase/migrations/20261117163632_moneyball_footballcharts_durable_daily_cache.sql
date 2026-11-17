create table if not exists public.moneyball_provider_cache (
  owner_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  provider text not null,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  expires_at timestamptz not null,
  refreshing_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint moneyball_provider_cache_pkey primary key (owner_id, cache_key)
);

create index if not exists moneyball_provider_cache_expiry_idx
  on public.moneyball_provider_cache (expires_at);

alter table public.moneyball_provider_cache enable row level security;

drop policy if exists moneyball_provider_cache_select_own on public.moneyball_provider_cache;
create policy moneyball_provider_cache_select_own
  on public.moneyball_provider_cache for select to authenticated
  using (auth.uid() = owner_id);

drop policy if exists moneyball_provider_cache_insert_own on public.moneyball_provider_cache;
create policy moneyball_provider_cache_insert_own
  on public.moneyball_provider_cache for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists moneyball_provider_cache_update_own on public.moneyball_provider_cache;
create policy moneyball_provider_cache_update_own
  on public.moneyball_provider_cache for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on public.moneyball_provider_cache from anon, public;
grant select, insert, update on public.moneyball_provider_cache to authenticated;
