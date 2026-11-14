-- Poll only the active Nations League fixture set and refresh it every 15 minutes.
DO $$
BEGIN
  PERFORM cron.alter_job(10, schedule => '*/15 * * * *', active => true);
END
$$;
