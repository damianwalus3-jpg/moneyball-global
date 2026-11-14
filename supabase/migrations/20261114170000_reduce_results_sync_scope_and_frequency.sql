-- Keep production result reconciliation within the current Brussels match day.
-- The previous seven-day scan repeatedly exceeded Supabase Edge CPU limits.
DO $$
DECLARE
  v_job_id bigint;
  v_command text;
BEGIN
  SELECT jobid, command
    INTO v_job_id, v_command
  FROM cron.job
  WHERE jobname = 'moneyball-results-sync-every-10m'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(
      v_job_id,
      schedule => '*/15 * * * *',
      command => replace(v_command, 'moneyball-results-sync?days=7', 'moneyball-results-sync?days=1')
    );
  END IF;
END
$$;
