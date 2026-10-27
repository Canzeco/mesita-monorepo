-- MESITA-2831: the Enrichment settings drop the old Atlas name. "Atlas" once
-- named the venue research subsystem (0022: an `atlas` bucket and a pre-read
-- toggle); both are gone, and Atlas now means only the admin taxonomy page
-- (Configurations › Atlas). The last trace was the `atlas` prefix on every
-- app_config.enrichment_config key. Pato, 2026-10-26: "kill this. its not
-- this anymore at all" → each `atlas<X>` key becomes `enrich<X>`, carrying
-- its live value over. A key missing live stays missing (the reader
-- defaults it); any other `atlas*` key is dropped, not renamed.
--
-- The CHECK names the keys, so it is dropped before the blob moves and
-- recreated against the new names after. The readers (enrichment-config.ts,
-- config-section-enricher.ts) ship the same names in the same PR.

alter table public.app_config
  drop constraint if exists app_config_enrichment_config_check;

update public.app_config
   set enrichment_config = (
     select coalesce(jsonb_object_agg(
       case when e.key like 'atlas%' then 'enrich' || substr(e.key, 6) else e.key end,
       e.value), '{}'::jsonb)
       from jsonb_each(enrichment_config) as e
      where e.key not in ('atlasPerRunCostCapUsd')
   )
 where exists (
   select 1 from jsonb_object_keys(enrichment_config) as k where k like 'atlas%'
 );

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
    and coalesce(enrichment_config->>'enrichSynthesisQuality', '') in ('economy', 'standard', 'high')
    and coalesce(enrichment_config->>'enrichVisionQuality', '') in ('economy', 'standard', 'high')
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
