// Shared embedding + ranking helpers for any EF that runs RAG over places.
//
// Lives in _shared/ (not a separate EF) because the helpers are pure or
// near-pure (a SHA-1 digest, a cosine, an OpenAI HTTP call). The candidate-pool
// query lives in `_shared/place-pool.ts`.
//
// Used by: supabase-edgefunc-recall-places (Memo's RAG leg) and the Enricher's
// On-Update synthesis. MESITA-1048 deleted the swipe/map rankers that were the
// other callers; these helpers stay — the vectors are paid data, not the
// algorithm, and the rebuilt engine wants them.
//
// MESITA-720: place vectors are produced from a short synthesized blurb
// (embedding_source_text), never from tags. Prefer On-Update synthesis; the
// lazy path here synthesizes when the stored blurb is missing.
//
// Model: app_settings.models_config.lineup.model (admin Models page). The
// `lineup` blob KEY is legacy naming kept for wire compatibility with the
// admin Models page — it selects the place-embedding model, nothing else.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type EmbeddablePlace,
  digest,
  placeEmbeddingFacts,
  vectorLiteral,
} from "./embeddings-vector.ts";
import {
  callEmbeddings,
  embedBatch,
  embedSingle,
  EMBEDDING_DIMS,
  DEFAULT_EMBEDDING_MODEL,
} from "./embeddings-http.ts";
import { loadModelsConfig } from "./models-config.ts";
import { synthesizePlaceEmbeddingText } from "./place-embeddings.ts";

export { rankByCosine, shouldEmbed } from "./embeddings-vector.ts";
export { embedBatch, embedSingle, EMBEDDING_DIMS, DEFAULT_EMBEDDING_MODEL };

/** Resolve the place-embedding model from models_config (with default). */
export async function resolveEmbeddingModel(
  admin: SupabaseClient,
): Promise<string> {
  const cfg = await loadModelsConfig(admin);
  return cfg.embeddingModel || DEFAULT_EMBEDDING_MODEL;
}

// Lazy-embeds + persists a slice of places. Returns a map of place.id →
// { embedding, hash, text } for every row that landed; the caller patches its
// local rows from this map so we never need a re-SELECT after writing.
export async function embedAndPersistPlaces<T extends EmbeddablePlace>(
  rows: T[],
  admin: SupabaseClient,
  apiKey: string,
  logPrefix: string,
  embeddingModel?: string,
): Promise<Map<string, { embedding: number[]; hash: string; text: string }>> {
  const models = await loadModelsConfig(admin);
  const model = embeddingModel ??
    (models.embeddingModel || DEFAULT_EMBEDDING_MODEL);
  const synthModel = models.enricherModel;
  const inputs = await Promise.all(rows.map(async (r) => {
    const text = r.embedding_source_text?.trim()
      ? r.embedding_source_text.trim()
      : await synthesizePlaceEmbeddingText(r, apiKey, synthModel);
    // Same contract as On-Update: hash the FACTS that produced the blurb so
    // profile edits invalidate, not LLM wording drift.
    const hash = await digest(placeEmbeddingFacts(r));
    return { id: r.id, text, hash };
  }));
  const out = new Map<string, { embedding: number[]; hash: string; text: string }>();
  try {
    const r = await callEmbeddings(inputs.map((i) => i.text), apiKey, model);
    if (!r.ok) {
      console.error(`[${logPrefix}] batch-embed HTTP`, r.status, (await r.text()).slice(0, 240));
      return out;
    }
    const data = (await r.json()) as { data?: { embedding: number[]; index: number }[] };
    const byIdx = new Map<number, number[]>();
    for (const d of data.data ?? []) byIdx.set(d.index, d.embedding);

    // N updates in parallel — PostgREST handles 50 concurrent single-row
    // updates fine, and serialising would dominate the EF budget.
    await Promise.all(inputs.map(async (inp, i) => {
      const v = byIdx.get(i);
      if (!v || v.length !== EMBEDDING_DIMS) return;
      const { error } = await admin
        .from("profiles")
        .update({
          embedding: vectorLiteral(v),
          embedding_source_hash: inp.hash,
          embedding_source_text: inp.text,
        })
        .eq("id", inp.id);
      if (error) {
        console.error(`[${logPrefix}] embed write:`, error.message);
        return;
      }
      out.set(inp.id, { embedding: v, hash: inp.hash, text: inp.text });
    }));
    return out;
  } catch (err) {
    console.error(`[${logPrefix}] embed exception:`, err);
    return out;
  }
}
