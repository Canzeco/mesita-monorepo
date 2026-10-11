-- MESITA-2144 (step 1 of 2): enrichment_config stops requiring atlasPerRunCostCapUsd.
--
-- Nothing has read the per-run dollar cap since the dollar abort was retired,
-- and the same merge stops _shared/enrichment-config.ts writing it: the
-- normalizer drops it like any other unknown key, so every enricher-section
-- save (Creation, Enrichment and the Models page's Enricher half) writes a blob
-- without it. The CHECK below made the key mandatory —
-- coalesce(..., -1) >= 0 fails on a missing key — so those saves would 23514.
--
-- Loosening only. Migrations apply before the Edge Functions redeploy, so the
-- old functions (still writing the key) and the new ones (not writing it) both
-- pass this. The stored key itself is stripped by step 2's drop migration.
--
-- The definition is the live one (pg_get_constraintdef on yjalywfzdelacdzccpgb,
-- 2026-10-11) with that one clause removed. 'high' stays in both quality lists
-- for now: MESITA-2126 rewrote the stored value, and the writer still accepts
-- and maps it during a deploy window.

alter table public.app_config
  drop constraint if exists app_config_enrichment_config_check;

alter table public.app_config
  add constraint app_config_enrichment_config_check check (
    jsonb_typeof(enrichment_config) = 'object'
    and coalesce((enrichment_config->>'atlasGatherGoogleImages')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasGatherInstagramDepth')::int, -1) between 1 and 30
    and coalesce((enrichment_config->>'atlasGatherInstagramPosts')::int, -1) between 0 and 30
    and coalesce((enrichment_config->>'atlasGatherInstagramPosts')::int, 999)
        <= coalesce((enrichment_config->>'atlasGatherInstagramDepth')::int, 0)
    and coalesce((enrichment_config->>'atlasGatherReviews')::int, -1) between 0 and 100
    and jsonb_typeof(enrichment_config->'atlasImageVisionEnabled') = 'boolean'
    and coalesce((enrichment_config->>'atlasAnalyzeGoogleImages')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasAnalyzeInstagramImages')::int, -1) between 0 and 30
    and coalesce((enrichment_config->>'atlasSaveTotalImages')::int, -1) between 0 and 10
    and jsonb_typeof(enrichment_config->'atlasSaveImagesToStorage') = 'boolean'
    and jsonb_typeof(enrichment_config->'atlasImageAnalysisPrompt') = 'string'
    and length(enrichment_config->>'atlasImageAnalysisPrompt') <= 4000
    and jsonb_typeof(enrichment_config->'atlasImageSortingPrompt') = 'string'
    and length(enrichment_config->>'atlasImageSortingPrompt') <= 4000
    and coalesce(enrichment_config->>'atlasSynthesisQuality', '') in ('economy', 'standard', 'high')
    and coalesce(enrichment_config->>'atlasVisionQuality', '') in ('economy', 'standard', 'high')
    and coalesce(enrichment_config->>'atlasPerplexityPreset', '') in (
      'fast-search', 'pro-search', 'deep-research', 'advanced-deep-research'
    )
    and coalesce((enrichment_config->>'atlasDiscoverWebsiteN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverInstagramN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverFacebookN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverOpentableN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverUbereatsN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasRequestThreshold')::int, -1) between 1 and 100
  );
