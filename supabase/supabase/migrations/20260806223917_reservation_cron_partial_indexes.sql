-- MESITA-941: covering partial indexes for reservation cron hot paths.
-- Book retries already have reservations_due_retry_idx (status+attempts_state).
-- Cancel-notice + guest-callback cron filters had no matching index.

create index if not exists reservations_due_notice_idx
  on public.reservations (notice_next_at)
  where notice_state in ('pending', 'scheduled');

create index if not exists reservations_due_callback_idx
  on public.reservations (callback_next_attempt_at)
  where callback_state = 'scheduled';

comment on index public.reservations_due_notice_idx is
  'Hot path for supabase-cron-reservation-retries cancel-notice sweep.';

comment on index public.reservations_due_callback_idx is
  'Hot path for supabase-cron-reservation-retries guest-callback sweep.';
