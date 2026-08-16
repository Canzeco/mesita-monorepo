// Central reader for public.app_settings.models_config (admin Models page).
// Binding rule: every serving path that picks an LLM/embedding model must
// go through this helper — hardcoded model strings are a compliance bug.
//
// Shape (20260726010000_models_config_reshape):
//   supabase : { model }              OpenAI chat (general EF default)
//   enricher : { model, perplexity }  OpenAI main + Perplexity leg
//   lineup   : { model }              OpenAI embedding (see the note below)
//   memo     : { model, perplexity }  OpenAI main + Perplexity leg
//
// "off" on a perplexity leg means skip Perplexity for that subsystem.
//
// LEGACY KEY: the blob key is still `lineup` even though MESITA-1048 deleted
// the Lineup engine. It selects the PLACE-EMBEDDING model and nothing else —
// the vectors, and Memo's RAG recall over them, are very much alive. Renaming
// the key means a data migration plus a matching change to the admin Models
// page, so it stays; the derived field below is called `embeddingModel` so
// reading code says what it means.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type ModelsConfig = {
  v?: number;
  supabase?: { model?: string };
  enricher?: { model?: string; perplexity?: string };
  lineup?: { model?: string };
  memo?: { model?: string; perplexity?: string };
};

export const DEFAULT_MODELS_CONFIG: Required<
  Pick<ModelsConfig, "supabase" | "enricher" | "lineup" | "memo">
> = {
  supabase: { model: "gpt-4o-mini" },
  enricher: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  lineup: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
};

function nonEmpty(s: unknown, fallback: string): string {
  return typeof s === "string" && s.trim() !== "" ? s.trim() : fallback;
}

/** Load models_config with hardcoded defaults for any missing key. */
export async function loadModelsConfig(
  admin: SupabaseClient,
): Promise<{
  supabaseModel: string;
  enricherModel: string;
  enricherPerplexity: string;
  /** From the legacy `lineup` blob key. The place-embedding model. */
  embeddingModel: string;
  memoModel: string;
  memoPerplexity: string;
  raw: ModelsConfig | null;
}> {
  const { data, error } = await admin
    .from("app_settings")
    .select("models_config")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("[models-config] load:", error.message);
  }
  const raw = (data?.models_config ?? null) as ModelsConfig | null;
  return {
    supabaseModel: nonEmpty(
      raw?.supabase?.model,
      DEFAULT_MODELS_CONFIG.supabase.model!,
    ),
    enricherModel: nonEmpty(
      raw?.enricher?.model,
      DEFAULT_MODELS_CONFIG.enricher.model!,
    ),
    enricherPerplexity: nonEmpty(
      raw?.enricher?.perplexity,
      DEFAULT_MODELS_CONFIG.enricher.perplexity!,
    ),
    embeddingModel: nonEmpty(
      raw?.lineup?.model,
      DEFAULT_MODELS_CONFIG.lineup.model!,
    ),
    memoModel: nonEmpty(raw?.memo?.model, DEFAULT_MODELS_CONFIG.memo.model!),
    memoPerplexity: nonEmpty(
      raw?.memo?.perplexity,
      DEFAULT_MODELS_CONFIG.memo.perplexity!,
    ),
    raw,
  };
}
