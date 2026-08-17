-- MESITA-1083 — Filters config: the policy blob behind every consumer filter
-- surface, editable at /filters-config in the admin console.
--
-- Two tiers. GENERAL is the law — which of the six modules exist (context ·
-- where · distance · when · what · random), what a fresh sheet opens on, the
-- bounds a surface may not exceed, and how the filter store behaves. SURFACES
-- is one entry per consumer screen (swipe · catalog · chat · social · map ·
-- search), each either inheriting the law or overriding it.
--
-- The blob lands BEFORE any reader, exactly like ojo_config: the page and the
-- consumer wiring ship independently, and the consumer reads live policy on
-- its first run. Every knob is labeled "not wired" in the UI until then —
-- house rule: an unenforced config is a bug, and a staged one must say so.
--
-- DELIBERATELY NOT SEEDED. A NULL column is how the console knows no operator
-- has chosen anything yet, so the page can say "these are the launch values"
-- rather than implying someone picked them. The first save writes the whole
-- v1 blob; until then the admin client renders the code defaults, which
-- mirror the shipped consumer engine.
--
-- Shape (v1):
--   version   1
--   general   { modules, defaults, bounds, behavior }
--   surfaces  { <surface>: { enabled, modules, overrides, resultCap } }

alter table public.app_settings
  add column if not exists filters_config jsonb;

comment on column public.app_settings.filters_config is
  'Consumer discovery-filter policy — MESITA-1083. Edited at /filters-config; the v1 blob lives under the "v1" key. STAGED: no consumer reads it yet, the sheet still runs its own code defaults. NULL = never saved.';
