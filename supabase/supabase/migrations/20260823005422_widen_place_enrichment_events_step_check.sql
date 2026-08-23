-- The PULSE queue goes to TEN steps and gains one EXTRA (MESITA-1230), and the
-- old CHECK accepted only a single digit: `step ~ '^S[0-9]$'`.
--
-- This is not cosmetic. reportEnrichmentStep is BEST-EFFORT — it swallows its
-- own insert errors so a logging failure can never fail a run that already did
-- the work. So with the old constraint, step 10 and the extra would have been
-- rejected by Postgres, the error would have been swallowed, the rows would
-- never appear, and pulseHighWater would have capped at 9 forever with no
-- surface reporting anything wrong. The guard that caught this before it
-- shipped is the first test in _shared/pulse-pieces.test.ts (MESITA-1219).
--
-- Two shapes are legal now:
--   S0 .. S99  a queue position (S0 is the pre-run seed gate)
--   SX         the EXTRA marker — semantics runs outside the queue, so it has
--              no rung to number and must not borrow one
alter table public.place_enrichment_events
  drop constraint if exists place_enrichment_events_step_check;

alter table public.place_enrichment_events
  add constraint place_enrichment_events_step_check
  check (step ~ '^S([0-9]{1,2}|X)$');
