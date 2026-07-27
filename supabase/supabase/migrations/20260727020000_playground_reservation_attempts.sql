-- Playground reservation INTENTS (attempts) — MESITA-750 follow-up.
--
-- A playground run is now ticket-first: admin-web-create-playground-reservation
-- inserts the ticket and responds immediately, then an EdgeRuntime background
-- task runs up to reservations_config.attempts call intents (place the call →
-- watch the ElevenLabs conversation → retry on no-answer). Each intent lands in
-- the `attempts` log; `attempts_state` is the loop's lifecycle for the sandbox
-- UI to poll.
--
--   attempts         jsonb array of { n, started_at, conversation_id, result }
--                    result: dialing | ringing | answered | no_answer |
--                            unknown | placement failed: …
--   attempts_planned how many intents this run may use (config attempts at
--                    run time — the "3 intents")
--   attempts_state   running | answered | exhausted | error
--
-- The legacy last-call columns (call_status / conversation_id / called_at /
-- call_attempts) now mirror the LATEST intent.

alter table public.playground_reservations
  add column if not exists attempts         jsonb   not null default '[]'::jsonb,
  add column if not exists attempts_planned integer not null default 1,
  add column if not exists attempts_state   text    not null default 'running';

-- Backfill pre-intents rows (single-shot runs): terminal, one attempt whose
-- result is the recorded call_status.
update public.playground_reservations
set attempts_planned = 1,
    attempts_state = case when call_status = 'placed' then 'answered' else 'exhausted' end,
    attempts = case
      when call_status is not null then jsonb_build_array(jsonb_build_object(
        'n', 1,
        'started_at', coalesce(called_at, created_at),
        'conversation_id', conversation_id,
        'result', case when call_status = 'placed' then 'answered' else call_status end
      ))
      else '[]'::jsonb
    end;

comment on column public.playground_reservations.attempts is
  'Per-intent log: [{ n, started_at, conversation_id, result }]. result: dialing | ringing | answered | no_answer | unknown | placement failed: …';
comment on column public.playground_reservations.attempts_planned is
  'How many call intents this run may use — reservations_config.attempts at run time.';
comment on column public.playground_reservations.attempts_state is
  'Intent-loop lifecycle: running | answered | exhausted | error. The sandbox UI polls while running.';
