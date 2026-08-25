-- MESITA-1248 remainder: fold the leftover atlas_* Intake knobs and memo_*
-- scalars into per-domain jsonb, matching verification_config / sourcing_config.
-- Wire camelCase (atlasGatherGoogleImages, …) is unchanged. enrichment_triggers
-- stays its own column — the Intake page already saves that whole grid.

alter table public.app_config
  add column if not exists enrichment_config jsonb not null default '{}'::jsonb,
  add column if not exists memo_config jsonb not null default '{}'::jsonb;

update public.app_config
set
  enrichment_config = jsonb_build_object(
    'atlasGatherGoogleImages', atlas_gather_google_images,
    'atlasGatherInstagramDepth', atlas_gather_instagram_depth,
    'atlasGatherInstagramPosts', atlas_gather_instagram_posts,
    'atlasGatherReviews', atlas_gather_reviews,
    'atlasImageVisionEnabled', atlas_image_vision_enabled,
    'atlasAnalyzeGoogleImages', atlas_analyze_google_images,
    'atlasAnalyzeInstagramImages', atlas_analyze_instagram_images,
    'atlasSaveTotalImages', atlas_save_total_images,
    'atlasSaveImagesToStorage', atlas_save_images_to_storage,
    'atlasImageAnalysisPrompt', atlas_image_analysis_prompt,
    'atlasImageSortingPrompt', atlas_image_sorting_prompt,
    'atlasSynthesisQuality', atlas_synthesis_quality,
    'atlasVisionQuality', atlas_vision_quality,
    'atlasPerplexityPreset', atlas_perplexity_preset,
    'atlasPerRunCostCapUsd', atlas_per_run_cost_cap_usd,
    'atlasDiscoverWebsiteN', atlas_discover_website_n,
    'atlasDiscoverInstagramN', atlas_discover_instagram_n,
    'atlasDiscoverFacebookN', atlas_discover_facebook_n,
    'atlasDiscoverOpentableN', atlas_discover_opentable_n,
    'atlasDiscoverUbereatsN', atlas_discover_ubereats_n
  ),
  memo_config = jsonb_build_object(
    'greeting', memo_greeting,
    'instructions', memo_instructions,
    'openaiModel', memo_openai_model,
    'perplexityModel', memo_perplexity_model,
    'provider', memo_provider,
    'webGrounding', memo_web_grounding
  )
where id = 1;

alter table public.app_config
  drop constraint if exists app_config_enrichment_config_check,
  drop constraint if exists app_config_memo_config_check;

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
    and coalesce((enrichment_config->>'atlasPerRunCostCapUsd')::numeric, -1) >= 0
    and coalesce((enrichment_config->>'atlasDiscoverWebsiteN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverInstagramN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverFacebookN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverOpentableN')::int, -1) between 0 and 10
    and coalesce((enrichment_config->>'atlasDiscoverUbereatsN')::int, -1) between 0 and 10
  );

alter table public.app_config
  add constraint app_config_memo_config_check check (
    jsonb_typeof(memo_config) = 'object'
    and jsonb_typeof(memo_config->'greeting') = 'string'
    and jsonb_typeof(memo_config->'instructions') = 'string'
    and jsonb_typeof(memo_config->'openaiModel') = 'string'
    and jsonb_typeof(memo_config->'perplexityModel') = 'string'
    and jsonb_typeof(memo_config->'provider') = 'string'
    and jsonb_typeof(memo_config->'webGrounding') = 'boolean'
  );

comment on column public.app_config.enrichment_config is
  'Intake knobs (admin /enricher-config). Wire camelCase atlasGatherGoogleImages etc. Image funnel lock is EF write-path only.';

comment on column public.app_config.memo_config is
  'Memo greeting/instructions/legacy model keys. models_config.memo is SoT for the brain; greeting/instructions have no live write path.';

alter table public.app_config
  drop column if exists atlas_gather_google_images,
  drop column if exists atlas_gather_instagram_depth,
  drop column if exists atlas_gather_instagram_posts,
  drop column if exists atlas_gather_reviews,
  drop column if exists atlas_image_vision_enabled,
  drop column if exists atlas_analyze_google_images,
  drop column if exists atlas_analyze_instagram_images,
  drop column if exists atlas_save_total_images,
  drop column if exists atlas_save_images_to_storage,
  drop column if exists atlas_image_analysis_prompt,
  drop column if exists atlas_image_sorting_prompt,
  drop column if exists atlas_synthesis_quality,
  drop column if exists atlas_vision_quality,
  drop column if exists atlas_perplexity_preset,
  drop column if exists atlas_per_run_cost_cap_usd,
  drop column if exists atlas_discover_website_n,
  drop column if exists atlas_discover_instagram_n,
  drop column if exists atlas_discover_facebook_n,
  drop column if exists atlas_discover_opentable_n,
  drop column if exists atlas_discover_ubereats_n,
  drop column if exists memo_greeting,
  drop column if exists memo_instructions,
  drop column if exists memo_openai_model,
  drop column if exists memo_perplexity_model,
  drop column if exists memo_provider,
  drop column if exists memo_web_grounding;
