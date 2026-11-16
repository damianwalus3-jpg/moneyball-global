-- MoviOdds requires a paid API key. Keep the optional function available for a future
-- explicitly configured provider, but stop the scheduled calls while no key is configured.
DO $$
BEGIN
  PERFORM cron.alter_job(10, active => false);
END
$$;