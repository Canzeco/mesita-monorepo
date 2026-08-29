-- Raise the Intake vote threshold default from 3 to 5 (Pato live 2026-08-29).
-- Only rows still on the old shipped default — custom admin values are untouched.

update public.app_config
   set enrichment_config = jsonb_set(
     coalesce(enrichment_config, '{}'::jsonb),
     '{atlasRequestThreshold}',
     '5'::jsonb,
     true
   )
 where coalesce((enrichment_config->>'atlasRequestThreshold')::int, 3) = 3;
