-- Columns the four Reservationist agents' tools write (eleven-a1..a4 caller
-- families, 2026-07-27). All additive, all nullable-or-defaulted — no reader
-- breaks.
--   reported_verdict    a1's own report of what the venue said (confirmed |
--                       counter_offer | declined) — richer than the engine's
--                       call_successful inference; the negotiation loop
--                       (follow-up) consumes it.
--   alternatives        speakable counter-offer options the venue gave
--                       ("afuera a las 10", "adentro a las 9") — jsonb array
--                       of strings.
--   outcome_note        free note from whichever agent last touched the ticket.
--   guest_confirmed_at  a2 recorded the human guest's confirmation — the
--                       consumer side of "both sides confirmed".
--   cancelled_by        who cancelled: consumer | business | agent | admin.
alter table public.reservations
  add column if not exists reported_verdict text,
  add column if not exists alternatives jsonb not null default '[]'::jsonb,
  add column if not exists outcome_note text,
  add column if not exists guest_confirmed_at timestamptz,
  add column if not exists cancelled_by text;
