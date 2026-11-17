-- Tighten profile and audit write permissions and provision profiles on signup.
drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_owner_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_owner_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists audit_events_owner_all on public.audit_events;
create policy audit_events_owner_select on public.audit_events
  for select to authenticated using (owner_id = auth.uid());
create policy audit_events_owner_insert on public.audit_events
  for insert to authenticated with check (owner_id = auth.uid());

create or replace function public.handle_new_moneyball_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_moneyball_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_moneyball on auth.users;
create trigger on_auth_user_created_moneyball
  after insert on auth.users
  for each row execute function public.handle_new_moneyball_user();
