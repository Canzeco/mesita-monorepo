-- Discovery Swipe box (Pato, 2026-08-26).
--
-- Swipe ranking is its own engine: hard filters + a two-signal sum + partner
-- bias. Defaults land on a fresh database and merge into the live blob so
-- Name / Map / Catalog keys survive. Runtime normalizeDiscoveryConfig is the
-- real source of truth — this write makes the stored jsonb match the console
-- before the first Save.

update public.app_config
set discovery_config =
  jsonb_build_object(
    'swipe', jsonb_build_object(
      'radiusKm', 5,
      'closingBufferMin', 30,
      'weightProximity', 0.7,
      'starsExponent', 1.5,
      'logDivisor', 10,
      'partnerBias', jsonb_build_object(
        'none', 1,
        'partner', 1.25,
        'conservative', 1.5,
        'aggressive', 1.75,
        'dominant', 2
      ),
      'randomnessMax', 1.3,
      'categoryFilter', false,
      'minReviews', 1,
      'savedAt', null
    )
  ) || coalesce(discovery_config, '{}'::jsonb)
where id = 1;

comment on column public.app_config.discovery_config is
  'Discovery: Name + Map + Swipe + Catalog + Social + Chat + the six-signal blob (weights/params/slotting/filters/engines). Swipe is the two-signal sum. Keys are code-defined in functions/_shared/discovery-config.ts. See Notion Docs > Discovery.';
