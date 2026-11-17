-- MONEYBALL clean database: typed observations, model evaluation and notifications
create table public.team_form (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fixture_id uuid references public.fixtures(id),
  observed_at timestamptz not null default now(),
  form_window integer not null check (form_window > 0),
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  source_id uuid references public.providers(id)
);
create table public.team_match_stats (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  source_id uuid not null references public.providers(id),
  fetched_at timestamptz not null default now(),
  stats jsonb not null,
  unique(fixture_id, team_id, source_id)
);
create table public.xg_observations (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  source_id uuid not null references public.providers(id),
  xg numeric(8,4) not null check (xg >= 0),
  xga numeric(8,4) check (xga >= 0),
  fetched_at timestamptz not null default now(),
  unique(fixture_id, team_id, source_id)
);
create table public.lineup_observations (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  source_id uuid not null references public.providers(id),
  status text not null check (status in ('predicted','confirmed','unavailable')),
  is_confirmed boolean not null default false,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create table public.injury_observations (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  source_id uuid not null references public.providers(id),
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create table public.prediction_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  prediction_id uuid not null references public.predictions(id),
  outcome text not null,
  is_correct boolean not null,
  brier_contribution numeric(12,8),
  log_loss_contribution numeric(12,8),
  evaluation_version text not null,
  scored_at timestamptz not null default now(),
  unique(prediction_id, evaluation_version)
);
create table public.calibration_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  model_version_id uuid references public.model_versions(id),
  market text not null,
  period_start date not null,
  period_end date not null,
  sample_size integer not null check (sample_size > 0),
  brier_score numeric(12,8),
  log_loss numeric(12,8),
  reliability_bins jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create table public.jackpot_pools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  rules jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','closed','settled')),
  created_at timestamptz not null default now()
);
create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(owner_id, endpoint)
);
create table public.backup_manifests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  format_version integer not null,
  row_counts jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now()
);

-- Source observations are shared and read-only to authenticated users.
do $$
declare t text;
begin
  foreach t in array array['team_form','team_match_stats','xg_observations','lineup_observations','injury_observations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_read', t);
  end loop;
end $$;

-- User-owned evaluation, calibration, Jackpot and browser push data.
do $$
declare t text;
begin
  foreach t in array array['prediction_evaluations','calibration_reports','jackpot_pools','web_push_subscriptions','backup_manifests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t || '_owner_all', t);
  end loop;
end $$;

create index prediction_evaluations_owner_scored_idx on public.prediction_evaluations(owner_id, scored_at desc);
create index team_form_team_observed_idx on public.team_form(team_id, observed_at desc);
create index xg_fixture_team_idx on public.xg_observations(fixture_id, team_id);
