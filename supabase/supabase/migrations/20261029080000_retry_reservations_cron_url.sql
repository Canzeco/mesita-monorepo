-- MESITA-3048 — the retry cron calls the function by its new name.
-- supabase-cron-reservation-retries became supabase-cron-retry-reservations
-- (every function name is caller-channel-verb-noun). Same job, same schedule,
-- same auth as 20260727130000_reservation_retry_scheduler.sql; only the URL
-- changes. The migration lands a few minutes before the new function deploys,
-- so a few minutes of ticks may 404; the next tick picks up every due ticket.
-- Kill switch: select cron.unschedule('run-reservation-retries');
select cron.unschedule('run-reservation-retries')
where exists (select 1 from cron.job where jobname = 'run-reservation-retries');

select cron.schedule(
  'run-reservation-retries',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-retry-reservations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
