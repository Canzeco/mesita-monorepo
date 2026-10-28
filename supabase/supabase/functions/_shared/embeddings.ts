// Resolves the place-embedding model for the EFs that embed a query against
// the place vectors (`_shared/name-pipeline.ts`). The OpenAI HTTP call
// lives in `embeddings-http.ts`, the cosine math in `embeddings-vector.ts`.
//
// MESITA-720: place vectors are produced from a short synthesized blurb
// (embedding_source_text), never from tags. `_shared/place-embeddings.ts` is
// their only writer.
//
// Model: app_config.models_config.embeddings.model (admin Models page).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { DEFAULT_EMBEDDING_MODEL } from "./embeddings-http.ts";
import { loadModelsConfig } from "./models-config.ts";

/** Resolve the place-embedding model from models_config (with default). */
export async function resolveEmbeddingModel(
  admin: SupabaseClient,
): Promise<string> {
  const cfg = await loadModelsConfig(admin);
  return cfg.embeddingModel || DEFAULT_EMBEDDING_MODEL;
}
