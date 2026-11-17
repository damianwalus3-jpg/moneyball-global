-- MONEYBALL clean database: initial schema
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/Brussels',
  locale text not null default 'pl',
  created_at timestamptz not null default now()
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('fixtures','results','statistics','xg','odds','lineups','other')),
  homepage_url text,
  active boolean not null default true
);
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id),
  provider_competition_id text,
  country_code text,
  country_name text,
  name text not null,
  tier integer,
  gender text not null default 'men',
  active boolean not null default true,
  unique(provider_id, provider_competition_id)
);
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id),
  provider_team_id text,
  name text not null,
  country_code text,
  unique(provider_id, provider_team_id)
);
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id),
  provider_fixture_id text not null,
  competition_id uuid not null references public.competitions(id),
  season text,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  kickoff_utc timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','postponed','cancelled','abandoned','unknown')),
  home_score integer,
  away_score integer,
  neutral_venue boolean not null default false,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, provider_fixture_id),
  check (home_team_id <> away_team_id)
);
create index fixtures_kickoff_idx on public.fixtures(kickoff_utc);
create index fixtures_competition_idx on public.fixtures(competition_id, kickoff_utc);
create table public.fixture_sources (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  provider_id uuid not null references public.providers(id),
  source_url text,
  fetched_at timestamptz not null default now(),
  payload_hash text,
  verification_status text not null default 'observed'
);
create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  requested_date date not null,
  timezone text not null default 'Europe/Brussels',
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed')),
  fixtures_found integer not null default 0,
  fixtures_new integer not null default 0,
  coverage jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  description text not null,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id),
  fixture_id uuid not null references public.fixtures(id),
  model_version_id uuid references public.model_versions(id),
  market text not null check (market in ('1X2','DOUBLE_CHANCE','GOALS','BTTS')),
  selection text not null,
  probability numeric(7,6) check (probability between 0 and 1),
  probabilities jsonb not null default '{}'::jsonb,
  data_coverage numeric(5,2) check (data_coverage between 0 and 100),
  sample_size integer check (sample_size >= 0),
  rationale jsonb not null default '{}'::jsonb,
  missing_inputs text[] not null default '{}',
  status text not null default 'candidate' check (status in ('candidate','watch','rejected','published','superseded')),
  supersedes_id uuid references public.predictions(id),
  created_at timestamptz not null default now()
);
create index predictions_owner_created_idx on public.predictions(owner_id, created_at desc);
create index predictions_fixture_idx on public.predictions(fixture_id);
create table public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id),
  provider_id uuid not null references public.providers(id),
  bookmaker text not null,
  market text not null,
  selection text not null,
  decimal_odds numeric(10,4) not null check (decimal_odds > 1),
  source_timestamp timestamptz,
  fetched_at timestamptz not null default now()
);
create index odds_fixture_market_idx on public.odds_snapshots(fixture_id, market, fetched_at desc);
create table public.match_results (
  fixture_id uuid primary key references public.fixtures(id),
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  provider_id uuid references public.providers(id),
  source_url text,
  verified_at timestamptz not null default now()
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Kupon analityczny',
  status text not null default 'draft' check (status in ('draft','open','won','lost','void','partial')),
  stake numeric(12,2) not null check (stake > 0),
  total_odds numeric(14,6) not null default 1 check (total_odds > 1),
  gross_return numeric(14,2),
  net_profit numeric(14,2),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create table public.coupon_legs (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id),
  market text not null,
  selection text not null,
  odds numeric(10,4) not null check (odds > 1),
  status text not null default 'pending' check (status in ('pending','won','lost','void')),
  unique(coupon_id, fixture_id)
);
create table public.paper_ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  coupon_id uuid references public.coupons(id),
  transaction_type text not null check (transaction_type in ('stake','return','adjustment')),
  amount numeric(12,2) not null,
  idempotency_key text not null,
  note text,
  created_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);
create table public.tracker_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);
create table public.jackpot_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open','won','lost','void')),
  stake numeric(12,2) not null check (stake > 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create table public.jackpot_entry_legs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.jackpot_entries(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id),
  market text not null,
  selection text not null,
  odds numeric(10,4) not null check (odds > 1),
  unique(entry_id, fixture_id)
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Shared football reference data is read-only to signed-in users.
do $$
declare t text;
begin
  foreach t in array array['providers','competitions','teams','fixtures','fixture_sources','model_versions','odds_snapshots','match_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_read', t);
  end loop;
end $$;

-- Private user data is strictly owner-scoped.
do $$
declare t text;
begin
  foreach t in array array['profiles','scan_runs','predictions','coupons','paper_ledger_transactions','tracker_categories','jackpot_entries','audit_events'] loop
    execute format('alter table public.%I enable row level security', t);
    if t = 'profiles' then
      execute 'create policy profiles_owner_all on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid())';
    else
      execute format('create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t || '_owner_all', t);
    end if;
  end loop;
end $$;

alter table public.coupon_legs enable row level security;
create policy coupon_legs_owner_all on public.coupon_legs for all to authenticated
using (exists (select 1 from public.coupons c where c.id = coupon_id and c.owner_id = auth.uid()))
with check (exists (select 1 from public.coupons c where c.id = coupon_id and c.owner_id = auth.uid()));

alter table public.jackpot_entry_legs enable row level security;
create policy jackpot_entry_legs_owner_all on public.jackpot_entry_legs for all to authenticated
using (exists (select 1 from public.jackpot_entries j where j.id = entry_id and j.owner_id = auth.uid()))
with check (exists (select 1 from public.jackpot_entries j where j.id = entry_id and j.owner_id = auth.uid()));
