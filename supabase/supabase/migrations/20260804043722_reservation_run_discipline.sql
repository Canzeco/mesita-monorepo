-- Run discipline + abuse guards (eng-review round 2, RESERVATIONS-PROTOCOL.md).
--
--   run_id / claimed_at   every engine claim stamps both; background writes are
--                         guarded .eq(run_id) so a reschedule/cancel/console
--                         action ORPHANS a mid-flight run instead of racing it,
--                         and the cron reaps claims stuck > 10 min (isolate
--                         death mid-call previously left 'running' forever).
--   outage_retries        platform failures (quota, 5xx) park WITHOUT burning
--                         protocol attempts; this counts the outage backoff.
--   reschedules_today/_day  per-ticket daily reschedule cap (each reschedule
--                         resets call_attempts, i.e. buys venue calls).
--   modification_of       old reserved_at when a CONFIRMED ticket reschedules —
--                         a1 runs a "modification" call; if it exhausts
--                         unreachable, the OLD slot owes a release notice.
--   reservation_call_counters + bump fn  per-place daily venue-call meter
--                         (atomic upsert-increment, service-role only).

alter table public.reservations
  add column if not exists run_id uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists outage_retries integer not null default 0,
  add column if not exists reschedules_today integer not null default 0,
  add column if not exists reschedules_day date,
  add column if not exists modification_of timestamptz;

create table if not exists public.reservation_call_counters (
  project_id uuid not null,
  day date not null,
  calls integer not null default 0,
  primary key (project_id, day)
);
alter table public.reservation_call_counters enable row level security;

create or replace function public.bump_reservation_call_counter(pid uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into reservation_call_counters (project_id, day, calls)
  values (pid, current_date, 1)
  on conflict (project_id, day)
  do update set calls = reservation_call_counters.calls + 1
  returning calls;
$$;
revoke all on function public.bump_reservation_call_counter(uuid) from public, anon, authenticated;
