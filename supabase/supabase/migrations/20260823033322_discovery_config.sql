-- Discovery config (MESITA-1196) — the ranking model's operator surface.
--
-- Discovery was torn down to a flat random query in MESITA-1183, which also
-- dropped `filters_config`. This is deliberately NOT that column coming back:
-- filters_config answered "what may a guest exclude" and encoded the old
-- six-filter-module model. This one answers "how is the catalog ordered", and
-- its shape is the two lanes Docs › Discovery §A describes —
--
--   weights   one EXPONENT per earned signal (proximity, timing, category,
--             popularity, semantic, randomness). Signals compose as s^w, so 0
--             means OFF, <1 softens and >1 sharpens.
--   slotting  the BOUGHT lane, kept out of the blend on purpose: every Nth
--             deck position is a slot a promoting place is moved forward into.
--             Money buys a position, never a score (Pato, 2026-08-22).
--
-- The default seeded here mirrors DISCOVERY_DEFAULTS in
-- functions/_shared/discovery-config.ts exactly. The normalizer is tolerant —
-- a missing key falls back — so the default is a convenience for the console's
-- first render, not a contract. The KEYS are code-defined (SIGNAL_KEYS); the
-- console edits numbers, never the vocabulary.

alter table public.app_config
  add column if not exists discovery_config jsonb not null default jsonb_build_object(
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
    )
  );

comment on column public.app_config.discovery_config is
  'Discovery ranking model: per-signal exponents (weights) + the bought-slot lane (slotting). Keys are code-defined in functions/_shared/discovery-signals.ts. See Notion Docs > Discovery.';
