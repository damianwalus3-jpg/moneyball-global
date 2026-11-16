-- Restore the intended 15-minute odds refresh cadence for today's supported fixtures.
DO $$
BEGIN
  PERFORM cron.alter_job(10, schedule => '*/15 * * * *', active => true);
END
$$;