create table if not exists public.moneyball_auto_scan_state (
 owner_id uuid not null,
 scan_date date not null,
 scan_run_id uuid,
 next_offset integer not null default 0 check (next_offset >= 0),
 status text not null default 'queued' check (status in ('queued','running','completed','failed')),
 last_started_at timestamptz,
 last_completed_at timestamptz,
 last_error text,
 last_summary jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(owner_id,scan_date)
);
alter table public.moneyball_auto_scan_state enable row level security;
revoke all on public.moneyball_auto_scan_state from public, anon, authenticated;
grant all on public.moneyball_auto_scan_state to service_role;
comment on table public.moneyball_auto_scan_state is 'Private cursor for automatic paginated Moneyball analysis of all European matches scheduled for the current Brussels day.';

select cron.schedule(
 'moneyball-auto-predict',
 '*/2 * * * *',
 $job$
   select net.http_post(
     url := (select decrypted_secret from vault.decrypted_secrets where name='moneyball_project_url') || '/functions/v1/moneyball-auto-scan',
     headers := jsonb_build_object(
       'Content-Type','application/json',
       'apikey',(select decrypted_secret from vault.decrypted_secrets where name='moneyball_publishable_key'),
       'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='moneyball_anon_jwt'),
       'x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='moneyball_cron_token')
     ),
     body := jsonb_build_object(
       'owner_id',(select decrypted_secret from vault.decrypted_secrets where name='moneyball_owner_id'),
       'date',to_char(now() at time zone 'Europe/Brussels','YYYY-MM-DD')
     ),
     timeout_milliseconds := 120000
   );
 $job$
);
