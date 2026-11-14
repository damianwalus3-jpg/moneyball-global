-- One prediction worker is sufficient for the eight daily UEFA Nations League fixtures.
-- The old five-offset fan-out repeated work and analysed unrelated European fixtures.
DO $$
BEGIN
  PERFORM cron.alter_job(5, schedule => '*/15 * * * *', active => true);
  PERFORM cron.alter_job(6, active => false);
  PERFORM cron.alter_job(7, active => false);
  PERFORM cron.alter_job(8, active => false);
  PERFORM cron.alter_job(9, active => false);
END
$$;
