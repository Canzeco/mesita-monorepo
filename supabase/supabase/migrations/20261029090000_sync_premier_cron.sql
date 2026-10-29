-- MESITA-3050 — Premier's sync cron calls the function by its new name.
-- supabase-cron-sync-boosts became supabase-cron-sync-premier (Premier is the
-- product word since MESITA-2925), and the job is renamed with it. Same
-- schedule, auth and timeout as 20261029030000_premier_line.sql; only the
-- job name and URL change. The migration lands a few minutes before the new
-- function deploys, so a tick or two may 404; the next one settles everything
-- due.
-- Kill switch: select cron.unschedule('sync-premier');
select cron.unschedule('sync-boosts')
where exists (select 1 from cron.job where jobname = 'sync-boosts');
select cron.unschedule('sync-premier')
where exists (select 1 from cron.job where jobname = 'sync-premier');

select cron.schedule(
  'sync-premier',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-sync-premier',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
