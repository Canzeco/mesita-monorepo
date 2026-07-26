-- Models config — which AI model each subsystem uses, on the app_settings singleton.
--
-- Backs the admin console's Models Config page (admin.mesita.ai/models-config)
-- via admin-web-get-models-config / admin-web-update-models-config. One central
-- place to pick the provider + model for each part of the stack instead of
-- editing each Edge Function.
--
-- Convention mirrors the Sourcing / Reservations / Rewards / Memo knobs: config
-- lives as ONE jsonb blob on the single-row public.app_settings (id = 1,
-- RLS-enabled, no policies → EF-only). Adding the column to the existing row
-- resolves to the defaults below with no data migration.
--
-- Subsystems (blob keys):
--   supabase → the general default model for Edge Functions that call an LLM
--              and don't have a more specific override.
--   enricher → the place-intelligence pipeline (Atlas/Enricher). Perplexity
--              sonar-pro today (validation leg).
--   lineup   → the recommendation engine's EMBEDDING model (place embeddings).
--   memo     → the consumer AI concierge (consumer-web-ask-memo). Mirrors the
--              existing memo_openai_model knob; centralised here going forward.
--
-- Each subsystem is { provider, model }. provider ∈ ('openai','perplexity').
--
-- Enforcement: STAGED. This persists ahead of the wiring — the EFs above just
-- read/write the blob so the page round-trips; the subsystems still run their
-- in-code / per-page model settings until each is pointed at this blob in a
-- follow-up. Deliberately overlaps the Memo Config model knob by design.
-- Keys are the contract shared with the admin catalog (web-admin models-config/types.ts).

alter table public.app_settings
  add column if not exists models_config jsonb not null default $models$
{
  "v": 1,
  "supabase": { "provider": "openai", "model": "gpt-4o-mini" },
  "enricher": { "provider": "perplexity", "model": "sonar-pro" },
  "lineup":   { "provider": "openai", "model": "text-embedding-3-small" },
  "memo":     { "provider": "openai", "model": "gpt-4o-mini" }
}
$models$::jsonb;
