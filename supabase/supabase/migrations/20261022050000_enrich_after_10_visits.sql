-- MESITA-2653 (Pato, 2026-10-21: "set it to 10 for the moment"): a Created
-- place enriches by itself after 10 different guests open its profile. The
-- knob is admin › Enrichment › Enrich ("Enrich after N visits"); it read 1.
update public.app_config
set enrichment_config = jsonb_set(
  coalesce(enrichment_config, '{}'::jsonb),
  '{atlasRequestThreshold}',
  '10'::jsonb,
  true
)
where id = 1;
