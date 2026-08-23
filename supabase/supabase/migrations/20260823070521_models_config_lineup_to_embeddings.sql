-- MESITA-1216: models_config.lineup → models_config.embeddings.
--
-- The key never ordered anything. It selects the PLACE-EMBEDDING model (enrich
-- function 9); the name outlived the Lineup engine MESITA-1048 deleted, and it
-- leaked through every note and detail string that cites the key path.
--
-- Readers accept BOTH spellings (_shared/models-config.ts, the admin
-- models-config coercer) and the validator EF writes only the new one, so this
-- migration is the belt to that braces: it rewrites the row nobody has saved
-- since the deploy, and moves the column DEFAULT so a fresh app_config row is
-- born with the right key.
--
-- Idempotent: the update only fires on rows that still carry `lineup`.

alter table public.app_config
  alter column models_config set default $models$
{
  "v": 1,
  "supabase":   { "model": "gpt-4o-mini" },
  "enricher":   { "model": "gpt-4o-mini", "perplexity": "sonar-pro" },
  "embeddings": { "model": "text-embedding-3-small" },
  "memo":       { "model": "gpt-4o-mini", "perplexity": "sonar-pro" }
}
$models$::jsonb;

update public.app_config
   set models_config =
         (models_config - 'lineup')
         || jsonb_build_object('embeddings', models_config -> 'lineup')
 where models_config ? 'lineup';
