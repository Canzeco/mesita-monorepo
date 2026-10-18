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
// summary vectors are precomputed (`place_profiles.embedding`); the cosine
// runs in process over a bounded pool. A place with no summary vector
// cannot be judged and is left out, not ranked as a mismatch.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { descriptionSimilarity } from "./pipeline-signals.ts";
import { applyGeneralGateQuery, type GeneralGateQuery } from "./discovery-general-gate.ts";
import type { DeepConfig, GeneralConfig } from "./discovery-config.ts";
import { embedSingle } from "./embeddings-http.ts";
import { resolveEmbeddingModel } from "./embeddings.ts";

/** A query shorter than this is not a description of anything. */
export const DEEP_MIN_QUERY = 3;
/** In-process cosine budget: a bounded pool, not every vector. */
export const DEEP_POOL = 300;

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
  /** Mesita Places Search for Deep; null on error. */
  pool: () => Promise<DeepRow[] | null>;
};

const ABOUT_MAX = 280;

export async function runDeepPipeline(
  deps: DeepDeps,
): Promise<{ places: DeepPlace[]; embedded: boolean }> {
  const query = deps.query.trim();
  if (query.length < DEEP_MIN_QUERY) return { places: [], embedded: false };
  const [vector, rows] = await Promise.all([deps.embed(query), deps.pool()]);
  if (!vector || !rows) return { places: [], embedded: Boolean(vector) };
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

const DEEP_COLUMNS =
  "id, slug, name, address, family_keys, google_stars_overall, google_review_count, description, embedding";

/** The production sources for Deep: OpenAI for the one query vector, and
 *  Mesita Places Search over active, ready places with a summary vector. */
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
    pool: async () => {
      const base = admin
        .from("profiles")
        .select(DEEP_COLUMNS)
        .eq("state", "active")
        .eq("content_state", "ready")
        .not("embedding", "is", null)
        // The same capped slice every time (MESITA-2338).
        .order("id", { ascending: true });
      const query = applyGeneralGateQuery(
        base as unknown as GeneralGateQuery,
        { ...general, minReviews: 0 },
      ) as unknown as typeof base;
      const { data, error } = await query.limit(DEEP_POOL);
      if (error) {
        console.error("[deep-pipeline] pool:", error.message);
        return null;
      }
      return (data ?? []) as unknown as DeepRow[];
    },
  };
}

/**
 * Deep's answer as context for the Chat model: the places, their Description
 * score and their own About. Chat may recommend only from this list when it
 * names a Mesita place; it advises and writes nothing.
 */
export function deepContextForChat(places: readonly DeepPlace[]): string {
  if (places.length === 0) return "";
  const lines = places.map((p, i) => {
    const facts = [
      p.address,
      p.rating !== null ? `${p.rating}★${p.reviewCount !== null ? ` (${p.reviewCount} reviews)` : ""}` : null,
      `match ${p.similarity}`,
    ].filter(Boolean).join(" · ");
    return `${i + 1}. ${p.name} — ${facts}${p.about ? `\n   ${p.about}` : ""}`;
  });
  return [
    "Mesita places that may fit the guest's request, best match first (Mesita looked these up for this turn; you did not). When you recommend a Mesita place, choose from this list; never invent one.",
    ...lines,
  ].join("\n");
}
