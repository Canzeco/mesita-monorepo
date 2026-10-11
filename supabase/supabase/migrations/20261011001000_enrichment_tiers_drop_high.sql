-- MESITA-2126: the Enricher has two quality tiers. "high" ran the same gpt-4o
-- as "standard"; rewrite any stored "high" so the data matches the two-tier
-- world. A no-op at run time (same model), and the readers map a leftover
-- "high" to "standard" anyway. One guarded statement per key (safeupdate).

update public.app_config
   set enrichment_config = jsonb_set(enrichment_config, '{atlasSynthesisQuality}', '"standard"'::jsonb, false)
 where id = 1
   and enrichment_config->>'atlasSynthesisQuality' = 'high';

update public.app_config
   set enrichment_config = jsonb_set(enrichment_config, '{atlasVisionQuality}', '"standard"'::jsonb, false)
 where id = 1
   and enrichment_config->>'atlasVisionQuality' = 'high';
