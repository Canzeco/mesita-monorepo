-- Sandbox retired (decision 2026-07-27): ONE ticket table. The admin
-- Playground now creates REAL rows in public.reservations flagged is_test,
-- the two-leg call engine (supabase-edgefunc-reservation-call) runs on the
-- real table for every ticket, and playground_reservations is dropped
-- (worthless emulation data, operator-cleared before the drop).
--
-- New enum values: the engine's terminal outcomes beyond the original set.
-- 'unreachable' = both call attempts went unanswered; 'unresolved' = the
-- venue answered but the call produced no verdict. Engine crashes never
-- touch status — they park as attempts_state='error' on a pending row.
alter type public.reservation_status add value if not exists 'unreachable';
alter type public.reservation_status add value if not exists 'unresolved';

alter table public.reservations
  add column if not exists is_test boolean not null default false,
  add column if not exists business_number text,
  add column if not exists consumer_number text,
  add column if not exists attempts jsonb not null default '[]'::jsonb,
  add column if not exists attempts_planned integer not null default 2,
  add column if not exists attempts_state text not null default 'idle',
  add column if not exists callback_state text not null default 'none',
  add column if not exists callback_conversation_id text,
  add column if not exists callback_at timestamptz;

drop table if exists public.playground_reservations;
