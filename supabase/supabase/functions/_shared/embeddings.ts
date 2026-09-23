// Shared embedding + ranking helpers for any EF that runs RAG over places.
//
// Lives in _shared/ (not a separate EF) because the helpers are pure or
// near-pure (a cosine, an OpenAI HTTP call). The candidate-pool
// query lives in `_shared/place-pool.ts`.
//
// Used by: supabase-edgefunc-recall-places (Memo's RAG leg: embedSingle,
// rankByCosine) and `_shared/consumer-search-lane.ts` (resolveEmbeddingModel).
// MESITA-1048 (#953) deleted the swipe/map rankers that were the other
// callers, and with them the only callers of the lazy embed-and-persist path
// that lived here; these helpers stay — the vectors are paid data, not the
// algorithm, and the rebuilt engine wants them.
//
// MESITA-720: place vectors are produced from a short synthesized blurb
// (embedding_source_text), never from tags. `_shared/place-embeddings.ts` is
// their only writer.
//
// Model: app_config.models_config.embeddings.model (admin Models page). The
// key was called `lineup` until MESITA-1216 — it never ordered anything, it
// selects the place-embedding model and nothing else. The reader still accepts
// the old spelling for blobs written before the rename.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { DEFAULT_EMBEDDING_MODEL } from "./embeddings-http.ts";
import { loadModelsConfig } from "./models-config.ts";

export { rankByCosine, shouldEmbed } from "./embeddings-vector.ts";
export {
  DEFAULT_EMBEDDING_MODEL,
  embedBatch,
  EMBEDDING_DIMS,
  embedSingle,
} from "./embeddings-http.ts";

/** Resolve the place-embedding model from models_config (with default). */
export async function resolveEmbeddingModel(
  admin: SupabaseClient,
): Promise<string> {
  const cfg = await loadModelsConfig(admin);
  return cfg.embeddingModel || DEFAULT_EMBEDDING_MODEL;
}
