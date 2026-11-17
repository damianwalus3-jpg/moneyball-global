-- Preserve immutable Jackpot sequence values across the existing JSON backup/restore workflow.
-- Replaces the identity generator with an owner-scoped, transaction-locked sequence allocator.
-- Existing Jackpot rows (currently none) are not rewritten.

alter table public.moneyball_jackpot_entries
  alter column sequence_no drop identity if exists;

alter table public.moneyball_jackpot_entries
  drop constraint if exists moneyball_jackpot_entries_sequence_no_key;

alter table public.moneyball_jackpot_entries
  add constraint moneyball_jackpot_entries_owner_sequence_uq unique (owner_id, sequence_no);

create or replace function public.moneyball_jackpot_entries_assign_sequence()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.sequence_no is null then
    perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
    select coalesce(max(sequence_no), 0) + 1
      into new.sequence_no
      from public.moneyball_jackpot_entries
      where owner_id = new.owner_id;
  end if;
  return new;
end;
$$;

revoke all on function public.moneyball_jackpot_entries_assign_sequence() from public, anon, authenticated;

drop trigger if exists moneyball_jackpot_entries_assign_sequence on public.moneyball_jackpot_entries;
create trigger moneyball_jackpot_entries_assign_sequence
  before insert on public.moneyball_jackpot_entries
  for each row execute function public.moneyball_jackpot_entries_assign_sequence();

comment on column public.moneyball_jackpot_entries.sequence_no is
  'Immutable owner-scoped display sequence. Assigned under transaction advisory lock; explicit values are accepted only to preserve backup restores.';
