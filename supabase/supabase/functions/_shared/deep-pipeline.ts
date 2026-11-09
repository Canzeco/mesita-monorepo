// THE DEEP PIPELINE (MESITA-2327): open-ended, qualitative discovery — "an
// intimate jazz bar for a second date". Its caller is the Chat Agent
// (consumer-web-ask-memo), which sits above the pipelines and never calls a
// source itself.
//
//   Sources  Mesita Places Search (the summary embedding) · Mesita Social
//            Search (Soon: no engine retrieves events yet)
//   Signal   Description (`descriptionSimilarity`, pipeline-signals.ts)
//   Gates    none (closed places never appear: Discovery › General's
//            active check rides the pool query)
//   Score    the Description signal; ties break on name, then id
//
// LAZY: the query is embedded only here, once, and only for a usable query.
// No other pipeline pays for an embedding it does not read. Candidate
// summary vectors are precomputed (`place_profiles.embedding`).
//
// NO POOL CAP (MESITA-2330): the kNN runs in Postgres (`deep_knn`), which
// orders EVERY gated place by cosine distance and returns the nearest
// `limit`. The cosine here (`descriptionSimilarity`) stays the scoring
// contract: it re-scores and re-sorts what comes back. A place with no
// summary vector cannot be judged and is left out, not ranked as a mismatch.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { descriptionSimilarity } from "./pipeline-signals.ts";
import type { DeepConfig, GeneralConfig } from "./discovery-config.ts";
import { embedSingle } from "./embeddings-http.ts";
import { resolveEmbeddingModel } from "./embeddings.ts";

/** A query shorter than this is not a description of anything. */
export const DEEP_MIN_QUERY = 3;

export type DeepRow = {
  id: string;
  slug?: string | null;
  name?: string | null;
  address?: string | null;
  family_keys?: string[] | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
  description?: string | null;
  embedding?: unknown;
};

export type DeepPlace = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  familyKeys: string[];
  rating: number | null;
  reviewCount: number | null;
  /** The Description signal, 0..1. */
  similarity: number;
  /** The place's About, trimmed: the evidence Chat can quote. */
  about: string | null;
};

export type DeepDeps = {
  query: string;
  config: DeepConfig;
  /** Embeds the query; called at most once. Null = cannot embed. */
  embed: (text: string) => Promise<number[] | null>;
  /** Mesita Places Search for Deep: the nearest places to the query
   *  vector across the whole gated catalog; null on error. */
  pool: (vector: number[], config: DeepConfig) => Promise<DeepRow[] | null>;
};

const ABOUT_MAX = 280;

export async function runDeepPipeline(
  deps: DeepDeps,
): Promise<{ places: DeepPlace[]; embedded: boolean }> {
  const query = deps.query.trim();
  if (query.length < DEEP_MIN_QUERY) return { places: [], embedded: false };
  const vector = await deps.embed(query);
  if (!vector) return { places: [], embedded: false };
  const rows = await deps.pool(vector, deps.config);
  if (!rows) return { places: [], embedded: true };
  const places = rows
    .map((row) => ({ row, sim: descriptionSimilarity(vector, row.embedding) }))
    .filter((x): x is { row: DeepRow; sim: number } =>
      x.sim !== null && x.sim >= deps.config.minSimilarity && Boolean(String(x.row.name ?? "").trim())
    )
    .sort((a, b) =>
      b.sim - a.sim ||
      String(a.row.name).localeCompare(String(b.row.name)) ||
      a.row.id.localeCompare(b.row.id)
    )
    .slice(0, deps.config.limit)
    .map(({ row, sim }): DeepPlace => ({
      id: row.id,
      slug: row.slug ?? null,
      name: String(row.name),
      address: row.address ?? null,
      familyKeys: Array.isArray(row.family_keys) ? row.family_keys : [],
      rating: typeof row.google_stars_overall === "number" ? row.google_stars_overall : null,
      reviewCount: typeof row.google_review_count === "number" ? row.google_review_count : null,
      similarity: Math.round(sim * 1000) / 1000,
      about: row.description ? row.description.slice(0, ABOUT_MAX) : null,
    }));
  return { places, embedded: true };
}

/** The production sources for Deep: OpenAI for the one query vector, and
 *  Mesita Places Search (`deep_knn`) over active, ready places with a
 *  summary vector, gated by Discovery › General. */
export function deepDepsFor(
  admin: SupabaseClient,
  general: GeneralConfig,
  openaiKey: string,
): Pick<DeepDeps, "embed" | "pool"> {
  return {
    embed: async (text) => {
      if (!openaiKey) return null;
      try {
        return await embedSingle(text, openaiKey, await resolveEmbeddingModel(admin));
      } catch (err) {
        console.error("[deep-pipeline] embed:", err instanceof Error ? err.message : err);
        return null;
      }
    },
    pool: async (vector, config) => {
      // The kNN in Postgres over every gated place (MESITA-2330): no cap
      // can drop a matching place.
      const { data, error } = await admin.rpc("deep_knn", {
        p_query: JSON.stringify(vector),
        p_limit: config.limit,
        p_min_similarity: config.minSimilarity,
        p_require_active: general.requireActive,
      });
      if (error) {
        console.error("[deep-pipeline] pool:", error.message);
        return null;
      }
      return (data ?? []) as unknown as DeepRow[];
    },
  };
}
