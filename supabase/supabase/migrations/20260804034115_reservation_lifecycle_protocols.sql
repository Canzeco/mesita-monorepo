-- Reservations lifecycle protocols — the columns the missing legs need.
-- (RESERVATIONS-PROTOCOL.md: legs 3, 5 and 6 had no state to persist, which is
-- exactly why they stopped silently.)
--
--   callback_*  leg 3 · the a2 guest-callback retry ladder (attempt count +
--               when the next may fire; callback_state='scheduled' parks it).
--   notice_*    legs 5/6 · the cancellation notice owed to the OTHER side:
--               notice_kind 'venue_cancel' (guest cancelled a confirmed table →
--               a1 tells the venue) or 'guest_cancel' (venue cancelled → a2
--               tells the guest). state: none|pending|scheduled|running|done|
--               failed. A ticket owes at most ONE notice — cancellation
--               happens once, and only the non-cancelling side needs the call.

alter table public.reservations
  add column if not exists callback_attempts integer not null default 0,
  add column if not exists callback_next_attempt_at timestamptz,
  add column if not exists notice_kind text,
  add column if not exists notice_state text not null default 'none',
  add column if not exists notice_attempts integer not null default 0,
  add column if not exists notice_next_at timestamptz,
  add column if not exists notice_conversation_id text;
