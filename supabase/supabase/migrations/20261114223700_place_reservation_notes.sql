-- MESITA-3955 PLACE NOTES (Pato, 2026-11-14: "after each call is finished,
-- its important for the workflow to have like some small context of the
-- restaurant ... call a is done, doc x is edited; call b starts, doc x is read
-- at init for the agent ... dox x must not be a record of all the calls, it
-- must be a summary of all the calls").
--
-- One row per place: a short text about how the place handles reservations
-- (seating, booking rules, how to reach them, quirks). After every finished
-- call with the place, eleven-webhook-post-call has a model rewrite it from
-- the old notes plus the transcript (_shared/place-notes.ts); the next call
-- to or from the place reads it. A rewrite under a length limit, never a log,
-- and never guest data.
--
-- last_conversation_id makes a repeated post-call message a no-op.
-- Additive: nothing reads the table until the EFs deploy.

create table if not exists public.place_reservation_notes (
  place_id uuid primary key references public.place_profiles (id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 1500),
  calls integer not null default 0 check (calls >= 0),
  last_conversation_id text,
  updated_at timestamptz not null default now()
);
alter table public.place_reservation_notes enable row level security;
revoke all on table public.place_reservation_notes from anon, authenticated;
comment on table public.place_reservation_notes is
  'MESITA-3955: one short summary per place of how it handles reservations, rewritten after every finished call with the place (eleven-webhook-post-call) and read by the next call (a1 call variable venue_notes, a4 caller check). Service role only.';
