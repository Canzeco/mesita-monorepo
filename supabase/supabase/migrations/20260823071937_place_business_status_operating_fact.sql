-- MESITA-1239: Operating — Google's business_status as the seventh place fact.
--
-- "A PLACE CAN BE ACTIVE IN GOOGLE BUT NOT LISTED ON MESITA." (Pato, 2026-08-22)
-- Listed and Operating are different questions:
--   Listed    — can a guest reach this place on Mesita (projects.status).
--   Operating — does the business still exist and trade, per Google.
--
-- Google returns businessStatus on every Place Details call. MESITA-1253 made
-- it a liveness GATE (create refuses CLOSED_PERMANENTLY; enrich fails the run
-- of a place that has since died) but never PERSISTED it, so an operator
-- looking at a place cannot see what Google says, and an already-listed place
-- that dies stays listed until something re-enriches it.
--
-- VERBATIM, not a boolean. CLOSED_TEMPORARILY (a refurb, a seasonal close —
-- still a real business) and CLOSED_PERMANENTLY (dead) mean different things
-- operationally, and collapsing them throws away the distinction that makes
-- the fact worth storing. NULL = Google has not told us, which is a third
-- state and not the same as OPERATIONAL.
--
-- The companion timestamp answers "how stale is this claim". A six-month-old
-- OPERATIONAL is not the same fact as today's, and without it the column reads
-- as current no matter how old it is.
--
-- NOT a gate. Flag, never withhold — the same posture as Ojo. Google is wrong
-- sometimes, and auto-unlisting on a third-party signal would vanish a live
-- place from Mesita with no human in the loop.

alter table public.places
  add column if not exists business_status text,
  add column if not exists business_status_at timestamptz;

comment on column public.places.business_status is
  'Operating (MESITA-1239): Google businessStatus, verbatim — OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY, NULL when Google is silent. A FLAG for operators, never a visibility gate; Listed is projects.status.';

comment on column public.places.business_status_at is
  'When business_status was last observed from Google. NULL alongside a NULL status; without it a stale claim reads as current.';
