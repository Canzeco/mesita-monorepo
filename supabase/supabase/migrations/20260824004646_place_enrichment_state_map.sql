-- MESITA-1249: materialize the enrichment progress meter onto the place.
--
-- `places.enrichment` = { functions: {pulse:{status,at,detail}, ... x 11},
-- highWater: 0-9, blockedAt: {key,index,status}|null } — exactly what
-- pulseHighWater/pulseBlockedAt (_shared/pulse-pieces.ts) already compute
-- from public.place_enrichment_events on every read via the
-- place_enrich_events_latest RPC. This materializes their OUTPUT; the write
-- side (pulse-report.ts's reportPulsePieces) keeps it current going forward.
--
-- DELIBERATELY NOT folded here: enrich_every_days / enrich_mode /
-- enrich_next_at (the schedule). Those three are read AND WRITTEN directly
-- by queue_due_place_enrichments, a live PL/pgSQL cron function — folding
-- them means rewriting that function body, which is the exact class of
-- change (a stored function body that doesn't auto-follow a column
-- restructure) that caused this repo's own documented 2-day enrichment
-- outage (MESITA-1143). The meter (pure read-path win, zero cron risk) and
-- the schedule (real risk to a fragile live function) are two different
-- shapes of change; this migration ships only the first. The three scalar
-- columns are untouched and stay the schedule's source of truth.
--
-- Default matches a freshly-created, never-enriched place: no functions run
-- yet, high-water 0 (the CREATED floor), not blocked.
alter table public.places
  add column enrichment jsonb not null default jsonb_build_object(
    'functions', '{}'::jsonb,
    'highWater', 0,
    'blockedAt', null
  );

comment on column public.places.enrichment is
  'Materialized enrichment progress meter (MESITA-1249): {functions, highWater, blockedAt}. Shape/keys owned by _shared/schema-catalog.ts (EnrichmentMapSchema) and _shared/pulse-pieces.ts (the 11 PulseStep keys). Kept current by pulse-report.ts on every write; backfilled once from place_enrichment_events at migration time. Does NOT include the enrichment schedule (enrich_every_days/enrich_mode/enrich_next_at stay separate columns, read by the live cron function queue_due_place_enrichments).';
