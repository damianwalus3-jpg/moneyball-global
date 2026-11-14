create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.moneyball_cron_request_allowed(p_owner_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','vault'
as $function$
declare
  request_headers jsonb;
  supplied_token text;
  stored_token text;
  stored_owner text;
begin
  request_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  supplied_token := request_headers ->> 'x-cron-token';
  select decrypted_secret into stored_token from vault.decrypted_secrets where name='moneyball_cron_token' limit 1;
  select decrypted_secret into stored_owner from vault.decrypted_secrets where name='moneyball_owner_id' limit 1;
  return supplied_token is not null
    and stored_token is not null
    and stored_owner is not null
    and supplied_token = stored_token
    and p_owner_id::text = stored_owner;
end;
$function$;

grant execute on function private.moneyball_cron_request_allowed(uuid) to anon, authenticated, service_role;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and coalesce(qual,'') ilike '%moneyball_cron_request_allowed%'
  loop
    execute format(
      'alter policy %I on %I.%I using (private.moneyball_cron_request_allowed(owner_id)) with check (private.moneyball_cron_request_allowed(owner_id))',
      p.policyname,p.schemaname,p.tablename
    );
  end loop;
end
$$;

revoke all on function public.moneyball_cron_request_allowed(uuid) from anon, authenticated;
