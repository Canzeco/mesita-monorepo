-- Discovery boxes: filters + engines (MESITA-1276).
--
-- The Discovery page is ONE page of BOXES (Pato, 2026-08-23) and two of them
-- had no storage: FILTERS (what may enter the pool) and ENGINES (which
-- surfaces read any of it). This adds both to the existing blob.
--
-- FILTERS IS NOT `filters_config` COMING BACK. That column was dropped in
-- MESITA-1183 and answered a GUEST-facing question — what may a guest exclude.
-- These are OPERATOR pool policy: catalog-wide admission rules a guest never
-- sees and cannot express. Different question, different owner.
--
-- `requireReady` ships ON because it is already the shipped behaviour:
-- MESITA-1228 hardcoded `content_status = 'ready'` into both Swipe and Map.
-- Adopting a live gate at its current value is the only default that changes
-- nothing on landing. The quality floors and the hard radius ship OFF, because
-- Popularity and Proximity already DEMOTE on those axes and a filter would
-- delete the same place a signal was merely ranking down.
--
-- Two statements, deliberately: the DEFAULT is what a fresh database seeds
-- (the catalog is reset often), and the UPDATE merges the new keys into the
-- row that already exists. `||` is a shallow merge, so the operator's stored
-- weights and slotting survive untouched — and the coalesce guards a row that
-- somehow holds NULL.

alter table public.app_config
  alter column discovery_config set default jsonb_build_object(
    'weights', jsonb_build_object(
      'proximity',  1,
      'timing',     1,
      'category',   1,
      'popularity', 1,
      'semantic',   1,
      'randomness', 0.35
    ),
    'slotting', jsonb_build_object(
      'enabled',  true,
      'everyNth', 5
    ),
    'filters', jsonb_build_object(
      'requireReady',  true,
      'minRating',     0,
      'minReviews',    0,
      'maxDistanceKm', 0
    ),
    'engines', jsonb_build_object(
      'swipe', jsonb_build_object('ranked', true)
    )
  );

update public.app_config
set discovery_config =
  jsonb_build_object(
    'filters', jsonb_build_object(
      'requireReady',  true,
      'minRating',     0,
      'minReviews',    0,
      'maxDistanceKm', 0
    ),
    'engines', jsonb_build_object(
      'swipe', jsonb_build_object('ranked', true)
    )
  ) || coalesce(discovery_config, '{}'::jsonb)
where id = 1;

comment on column public.app_config.discovery_config is
  'Discovery: per-signal exponents (weights) + the bought-slot lane (slotting) + pool admission (filters) + per-engine ranking (engines). Keys are code-defined in functions/_shared/discovery-signals.ts and discovery-config.ts. See Notion Docs > Discovery.';
