-- Playground reservations — the confirmation leg (two-direction agent model).
--
-- The reservations agent speaks in TWO directions:
--   Leg 1 · consumer → business  the agent calls the venue on behalf of the
--                                guest to REQUEST the reservation (the
--                                existing intent loop).
--   Leg 2 · business → consumer  once the venue CONFIRMS, the agent calls the
--                                human guest back to confirm. Only after a
--                                confirmation — declined / unreachable /
--                                unresolved runs never fire it.
--
-- `status` becomes the ticket's VERDICT (it was a write-once 'pending'):
--   pending      intent loop still running
--   confirmed    venue said yes (conversation analysis: call_successful)
--   declined     venue answered and said no — terminal, never retried
--   unresolved   venue answered but no verdict landed inside the watch budget
--   unreachable  no answer after every planned intent
--   error        engine failure (see call_status)
--
-- `callback_state` is leg 2's lifecycle:
--   none     leg 1 not finished yet
--   skipped  leg 1 ended without a confirmation — no guest call
--   calling | ringing | answered | no_answer | unknown | failed

alter table public.playground_reservations
  add column if not exists callback_state           text not null default 'none',
  add column if not exists callback_conversation_id text,
  add column if not exists callback_at              timestamptz,
  add column if not exists confirmed_at             timestamptz;

-- Backfill verdicts for pre-leg-2 tickets from the intent-loop state: answered
-- runs never read a verdict (unresolved), exhausted never connected
-- (unreachable); stale 'running' rows stay pending.
update public.playground_reservations
set status = case attempts_state
      when 'answered'  then 'unresolved'
      when 'exhausted' then 'unreachable'
      when 'error'     then 'error'
      else status
    end,
    callback_state = case
      when attempts_state in ('answered', 'exhausted', 'error') then 'skipped'
      else callback_state
    end
where status = 'pending';

comment on column public.playground_reservations.status is
  'Ticket verdict: pending | confirmed | declined | unresolved | unreachable | error. Set by the intent loop from the ElevenLabs conversation analysis.';
comment on column public.playground_reservations.callback_state is
  'Business→consumer confirmation-call lifecycle: none | skipped | calling | ringing | answered | no_answer | unknown | failed. Fires only after status=confirmed.';
comment on column public.playground_reservations.callback_conversation_id is
  'ElevenLabs conversation_id of the guest confirmation call, when it went out.';
comment on column public.playground_reservations.confirmed_at is
  'When the venue confirmed the reservation (leg 1 verdict = confirmed).';
