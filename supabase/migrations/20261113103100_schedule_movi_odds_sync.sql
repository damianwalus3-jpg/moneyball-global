select cron.schedule(
  'moneyball-movi-odds-every-30m',
  '*/30 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='moneyball_project_url')
             || '/functions/v1/moneyball-movi-odds-sync',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey',(select decrypted_secret from vault.decrypted_secrets where name='moneyball_publishable_key'),
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='moneyball_anon_jwt'),
        'x-cron-token',(select decrypted_secret from vault.decrypted_secrets where name='moneyball_cron_token')
      ),
      body := jsonb_build_object(
        'trigger','scheduled',
        'owner_id',(select id from auth.users order by created_at asc limit 1)
      ),
      timeout_milliseconds := 120000
    );
  $job$
);
