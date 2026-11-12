-- Backfill canonical fields from legacy aliases without deleting or rewriting source data.
UPDATE public.matches
SET competition = league
WHERE competition IS NULL AND league IS NOT NULL;

UPDATE public.scan_runs
SET matches_count = matches_found
WHERE matches_count IS NULL AND matches_found IS NOT NULL;
