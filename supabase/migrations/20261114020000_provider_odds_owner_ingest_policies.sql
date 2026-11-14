-- Allow authenticated users to ingest odds only into their own rows.
-- The cron-scoped policy remains available for verified scheduled ingestion.
create policy "provider_odds_owner_insert"
on public.provider_odds
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "provider_odds_owner_update"
on public.provider_odds
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
