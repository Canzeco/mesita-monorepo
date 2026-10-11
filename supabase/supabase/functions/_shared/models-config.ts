// Central reader for public.app_config.models_config (admin Models page).
// Binding rule: every serving path that picks an LLM/embedding model must
// go through this helper — hardcoded model strings are a compliance bug.
//
// Keys read here (20260726010000_models_config_reshape):
//   enricher   : { model }              OpenAI main
//   embeddings : { model }              OpenAI embedding — the PLACE-EMBEDDING model
//                                       (enrich function 8). Was `lineup` until
//                                       MESITA-1216; migration 20260823070521
//                                       rewrote every stored row.
//   memo       : { model }              OpenAI main (Discovery chat)
//
// The stored blob still carries `supabase`, `ojo` and `enricher.perplexity`
// (the admin whole-blob save writes them back); nothing reads them, and
// MESITA-2091 owns dropping them. A stored `memo.perplexity` is unread too, and
// the next Models save drops it (MESITA-2136).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type ModelsConfig = {
  v?: number;
  enricher?: { model?: string };
  embeddings?: { model?: string };
  memo?: { model?: string };
};

export const DEFAULT_MODELS_CONFIG: Required<
  Pick<ModelsConfig, "enricher" | "embeddings" | "memo">
> = {
  enricher: { model: "gpt-4o-mini" },
  embeddings: { model: "text-embedding-3-small" },
  memo: { model: "gpt-4o-mini" },
};

function nonEmpty(s: unknown, fallback: string): string {
  return typeof s === "string" && s.trim() !== "" ? s.trim() : fallback;
}

/** Load models_config with hardcoded defaults for any missing key. */
export async function loadModelsConfig(
  admin: SupabaseClient,
): Promise<{
  enricherModel: string;
  embeddingModel: string;
  memoModel: string;
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
    enricherModel: nonEmpty(
      raw?.enricher?.model,
      DEFAULT_MODELS_CONFIG.enricher.model!,
    ),
    embeddingModel: nonEmpty(
      raw?.embeddings?.model,
      DEFAULT_MODELS_CONFIG.embeddings.model!,
    ),
    memoModel: nonEmpty(raw?.memo?.model, DEFAULT_MODELS_CONFIG.memo.model!),
  };
}
