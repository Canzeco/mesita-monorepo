-- The open-hours-aware retry scheduler for the Reservationist.
--
-- The call engine can't sleep 30 minutes (edge runtime ~400s), so a venue that
-- doesn't answer parks the ticket: attempts_state='scheduled' plus the instant
-- the next try may fire (+5 min if the venue was open, ~30 min after it next
-- opens if it was closed — math in _shared/reservation-retry.ts). A pg_cron
-- job wakes the due ones through supabase-cron-reservation-retries.

alter table public.reservations
  add column if not exists next_attempt_at timestamptz;

comment on column public.reservations.next_attempt_at is
  'When the parked call attempt may fire. Set with attempts_state=''scheduled'' by the call engine; cleared when a run starts or the ticket reaches a terminal state. Polled by supabase-cron-reservation-retries.';

-- The poller''s exact predicate — tiny partial index, so waking is a seek even
-- once the table holds every reservation ever made.
create index if not exists reservations_due_retry_idx
  on public.reservations (next_attempt_at)
  where status = 'pending' and attempts_state = 'scheduled';

-- Wake due tickets every minute. Same pg_net + vault pattern as the Enricher
-- poller: the scheduler_service_role_key satisfies requireInternalCaller.
-- Kill switch: select cron.unschedule('run-reservation-retries');
select cron.unschedule('run-reservation-retries')
where exists (select 1 from cron.job where jobname = 'run-reservation-retries');

select cron.schedule(
  'run-reservation-retries',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-reservation-retries',
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
