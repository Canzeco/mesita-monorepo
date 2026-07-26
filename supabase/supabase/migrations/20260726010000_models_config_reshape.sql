-- Models config reshape — Perplexity is ONLY Enricher + Memo, and NEVER a main
-- model. The main model is always OpenAI (a chat model, or an embedding model
-- for Lineup).
--
-- Supersedes the { provider, model }-per-subsystem shape from
-- 20260726000000_models_config.sql (shipped the same day, staged + unread, so
-- overwriting the seeded row is safe — nothing consumes the blob yet). New shape:
--   supabase : { model }              OpenAI chat (general EF default)
--   enricher : { model, perplexity }  OpenAI main + Perplexity leg ("off" = none)
--   lineup   : { model }              OpenAI embedding
--   memo     : { model, perplexity }  OpenAI main + Perplexity leg ("off" = none)
--
-- Changes the column default AND reseeds the single row (id = 1). Keys are the
-- contract shared with web-admin models-config/types.ts.

alter table public.app_settings
  alter column models_config set default $models$
{
  "v": 1,
  "supabase": { "model": "gpt-4o-mini" },
  "enricher": { "model": "gpt-4o-mini", "perplexity": "sonar-pro" },
  "lineup":   { "model": "text-embedding-3-small" },
  "memo":     { "model": "gpt-4o-mini", "perplexity": "sonar-pro" }
}
$models$::jsonb;

update public.app_settings
  set models_config = $models$
{
  "v": 1,
  "supabase": { "model": "gpt-4o-mini" },
  "enricher": { "model": "gpt-4o-mini", "perplexity": "sonar-pro" },
  "lineup":   { "model": "text-embedding-3-small" },
  "memo":     { "model": "gpt-4o-mini", "perplexity": "sonar-pro" }
}
$models$::jsonb
  where id = 1;
