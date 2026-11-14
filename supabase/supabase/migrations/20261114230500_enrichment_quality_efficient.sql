-- MESITA-3963: the Enricher's `efficient` tier (gpt-6-luna, MESITA-3945) was
-- refused by this CHECK, which still listed only economy / standard / high, so
-- the admin Models save of Efficient failed with 23514. Recreate the CHECK with
-- `efficient` added (body otherwise unchanged from 20261027070000), then make
-- efficient the live pick for writing and photos (Pato, 2026-11-14: "by
-- default select the most efficient"; MESITA-3959 made it the code default).

alter table public.app_config
  drop constraint if exists app_config_enrichment_config_check;

update public.app_config
   set enrichment_config = enrichment_config
     || '{"enrichSynthesisQuality": "efficient", "enrichVisionQuality": "efficient"}'::jsonb
 where id = 1;

alter table public.app_config
  add constraint app_config_enrichment_config_check check (
    jsonb_typeof(enrichment_config) = 'object'
    and coalesce((enrichment_config->>'enrichGatherGoogleImages')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichGatherInstagramDepth')::int, -1) between 1 and 30
    and coalesce((enrichment_config->>'enrichGatherInstagramPosts')::int, -1) between 0 and 30
    and coalesce((enrichment_config->>'enrichGatherInstagramPosts')::int, 999)
        <= coalesce((enrichment_config->>'enrichGatherInstagramDepth')::int, 0)
    and coalesce((enrichment_config->>'enrichGatherReviews')::int, -1) between 0 and 100
    and jsonb_typeof(enrichment_config->'enrichImageVisionEnabled') = 'boolean'
    and coalesce((enrichment_config->>'enrichAnalyzeGoogleImages')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichAnalyzeInstagramImages')::int, -1) between 0 and 30
    and coalesce((enrichment_config->>'enrichSaveTotalImages')::int, -1) between 0 and 10
    and jsonb_typeof(enrichment_config->'enrichSaveImagesToStorage') = 'boolean'
    and jsonb_typeof(enrichment_config->'enrichImageAnalysisPrompt') = 'string'
    and length(enrichment_config->>'enrichImageAnalysisPrompt') <= 4000
    and jsonb_typeof(enrichment_config->'enrichImageSortingPrompt') = 'string'
    and length(enrichment_config->>'enrichImageSortingPrompt') <= 4000
    and coalesce(enrichment_config->>'enrichSynthesisQuality', '') in ('efficient', 'economy', 'standard', 'high')
    and coalesce(enrichment_config->>'enrichVisionQuality', '') in ('efficient', 'economy', 'standard', 'high')
    and coalesce(enrichment_config->>'enrichPerplexityPreset', '') in (
      'fast-search', 'pro-search', 'deep-research', 'advanced-deep-research'
    )
    and coalesce((enrichment_config->>'enrichDiscoverWebsiteN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichDiscoverInstagramN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichDiscoverFacebookN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichDiscoverOpentableN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichDiscoverUbereatsN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'enrichRequestThreshold')::int, -1) between 1 and 100
  );
