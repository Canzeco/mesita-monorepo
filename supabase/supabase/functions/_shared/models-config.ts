// Central reader for public.app_config.models_config (admin Models page).
// Binding rule: every serving path that picks an LLM/embedding model must
// go through this helper — hardcoded model strings are a compliance bug.
//
// Shape (20260726010000_models_config_reshape):
//   supabase   : { model }              OpenAI chat (general EF default)
//   enricher   : { model, perplexity }  OpenAI main + Perplexity leg
//   embeddings : { model }              OpenAI embedding (see the note below)
//   memo       : { model, perplexity }  OpenAI main + Perplexity leg
//
// "off" on a perplexity leg means skip Perplexity for that subsystem.
//
// THE KEY IS `embeddings`, AND `lineup` IS STILL READ (MESITA-1216). It selects
// the PLACE-EMBEDDING model — enrich function 9 — and never had anything to do
// with candidate ordering; the name outlived the engine MESITA-1048 deleted.
//
// The legacy read is NOT decoration. This is a JSONB blob, so a stored row
// written before the rename still says `lineup`, and dropping the fallback
// would silently fall back to the code default on every place — a model swap
// nobody asked for, invisible until the vectors disagree. Keep reading both
// until a migration has rewritten every row AND no rollback target remains.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type ModelsConfig = {
  v?: number;
  supabase?: { model?: string };
  enricher?: { model?: string; perplexity?: string };
  embeddings?: { model?: string };
  /** Pre-MESITA-1216 spelling of `embeddings`. Read-only fallback. */
  lineup?: { model?: string };
  memo?: { model?: string; perplexity?: string };
};

export const DEFAULT_MODELS_CONFIG: Required<
  Pick<ModelsConfig, "supabase" | "enricher" | "embeddings" | "memo">
> = {
  supabase: { model: "gpt-4o-mini" },
  enricher: { model: "gpt-4o-mini", perplexity: "sonar-pro" },
  embeddings: { model: "text-embedding-3-small" },
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
  /** From `embeddings.model`, falling back to the legacy `lineup.model`. */
  embeddingModel: string;
  memoModel: string;
  memoPerplexity: string;
  raw: ModelsConfig | null;
}> {
  const { data, error } = await admin
    .from("app_config")
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
    // Both spellings, new one first — a row written before MESITA-1216 still
    // says `lineup`, and losing it would silently re-vector the catalog.
    embeddingModel: nonEmpty(
      raw?.embeddings?.model ?? raw?.lineup?.model,
      DEFAULT_MODELS_CONFIG.embeddings.model!,
    ),
    memoModel: nonEmpty(raw?.memo?.model, DEFAULT_MODELS_CONFIG.memo.model!),
    memoPerplexity: nonEmpty(
      raw?.memo?.perplexity,
      DEFAULT_MODELS_CONFIG.memo.perplexity!,
    ),
    raw,
  };
}
