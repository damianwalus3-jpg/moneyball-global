-- Add a reversible archive flag to owner-created Tracker categories.
-- System categories stay active and read-only; no category history is deleted.
alter table public.moneyball_tracker_categories
  add column if not exists is_active boolean not null default true;
