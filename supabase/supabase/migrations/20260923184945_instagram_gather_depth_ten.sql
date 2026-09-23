-- MESITA-2033: depth/posts 30→10 so profile-embedded posts skip the post-scraper.
-- Only rows still on the old shipped defaults — custom admin values are untouched.

update public.app_config
   set enrichment_config = jsonb_set(
     coalesce(enrichment_config, '{}'::jsonb),
     '{atlasGatherInstagramDepth}',
     '10'::jsonb,
     true
   )
 where coalesce((enrichment_config->>'atlasGatherInstagramDepth')::int, 30) = 30;

update public.app_config
   set enrichment_config = jsonb_set(
     coalesce(enrichment_config, '{}'::jsonb),
     '{atlasGatherInstagramPosts}',
     '10'::jsonb,
     true
   )
 where coalesce((enrichment_config->>'atlasGatherInstagramPosts')::int, 10) = 30;
