// In-process ranking pipeline for the consumer swipe view.
//
// Absorbed from the former `recommender-rank-swipe` internal EF
// (MESITA-54): the HTTP hop was a synchronous 1:1 forward with a single
// product caller, so per the actor-origin grammar the pipeline now runs
// in-process inside `consumer-web-recommend-swipe`. Any future surface that
// needs the same ranking imports this module — no endpoint required.
//
// Pure ranking pipeline. Takes a location + optional consumer profile and
// returns a curated deck for the consumer swipe view. Anonymous requests
// are valid — discovery is public until sign-up, so the caller passes
// profile=null when there's no session.
//
// Pipeline (MESITA-718 — live Lineup v12):
//   1. Pull a bounded candidate pool by bounding-box radius (cheap).
//   2. Lazy-embed any candidates missing an embedding (batched, capped).
//   3. Compose a one-sentence intent query; embed once → EM cosines.
//   4. Load app_settings.scoring_config; score EM·SM·GP·RP·XX per lane;
//      merge Organic → Inorganic (keep-lane-on-dupe).
//   5. Trim to limit (laneN usually caps first).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  embedAndPersistPlaces,
  embedSingle,
  shouldEmbed,
} from "./embeddings.ts";
import {
  type ConsumerProfile,
  fetchCandidatePool,
  stripInternal,
  type PlaceRow,
} from "./recommender-pool.ts";
import {
  composeIntent,
  fallbackRank,
} from "./recommender-rank-swipe-helpers.ts";
import { loadScoringSettings } from "./lineup-config.ts";
import { cosineById, lineupReorder } from "./lineup-rank.ts";
import { laneCountsTotal } from "./lineup-scoring.ts";

const CANDIDATE_POOL = 200;
const LAZY_EMBED_BATCH = 50;

export type RankSwipeInput = {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  limit: number;
  profile: ConsumerProfile | null;
};

export type RankSwipeResult =
  | {
    ok: true;
    deck: Omit<PlaceRow, "embedding" | "embedding_source_hash" | "embedding_source_text">[];
    summary: {
      candidates: number;
      embedded: number;
      intent?: string;
      caller?: string;
      lineup?: boolean;
      laneTotal?: number;
    };
  }
  | { ok: false; error: string };

// Runs the full swipe-deck ranking pipeline in-process. `callerName` labels
// the embedding backfill + summary for observability (pass the natural EF
// name).
export async function rankSwipeDeck(
  admin: SupabaseClient,
  openaiKey: string | undefined,
  callerName: string,
  input: RankSwipeInput,
): Promise<RankSwipeResult> {
  const { lat, lng, radiusKm, limit, profile } = input;

  // ── 1. Candidate pool ──────────────────────────────────────────────
  const poolRes = await fetchCandidatePool<PlaceRow>(admin, {
    lat,
    lng,
    radiusKm,
    poolSize: CANDIDATE_POOL,
  });
  if (!poolRes.ok) {
    return { ok: false, error: `candidate_pool: ${poolRes.error}` };
  }
  const candidates = poolRes.rows;
  if (candidates.length === 0) {
    return { ok: true, deck: [], summary: { candidates: 0, embedded: 0 } };
  }

  // ── 2. Lazy embedding backfill ─────────────────────────────────────
  const needsEmbed = candidates.filter(shouldEmbed).slice(0, LAZY_EMBED_BATCH);
  let embeddedCount = 0;
  if (needsEmbed.length > 0 && openaiKey) {
    const patched = await embedAndPersistPlaces(needsEmbed, admin, openaiKey, callerName);
    embeddedCount = patched.size;
    for (const c of candidates) {
      const p = patched.get(c.id);
      if (p) {
        c.embedding = p.embedding;
        c.embedding_source_hash = p.hash;
        c.embedding_source_text = p.text;
      }
    }
  }

  // ── 3. Intent + EM cosines ─────────────────────────────────────────
  const intent = composeIntent({ profile, lat, lng, candidates });
  let cosine = new Map<string, number>();
  if (openaiKey) {
    try {
      const intentVec = await embedSingle(intent, openaiKey);
      cosine = cosineById(candidates, intentVec);
    } catch (err) {
      console.error(`[${callerName}] intent embed failed:`, err);
    }
  }

  // ── 4. Lineup v12 (live scoring_config) ────────────────────────────
  const settings = await loadScoringSettings(admin);
  const xxSeed = `${callerName}:${lat?.toFixed(3) ?? "x"}:${lng?.toFixed(3) ?? "x"}`;

  const hasEm = [...cosine.values()].some((c) => c >= 0);
  let ordered: PlaceRow[];
  if (hasEm) {
    ordered = lineupReorder(candidates, cosine, settings, {
      lat,
      lng,
      xxSeed,
    });
  } else {
    // No usable embeddings → partner-first fallback (pre-Lineup path).
    ordered = fallbackRank(candidates);
  }

  const deck = ordered.slice(0, limit);

  return {
    ok: true,
    deck: deck.map(stripInternal),
    summary: {
      candidates: candidates.length,
      embedded: embeddedCount,
      intent,
      caller: callerName,
      lineup: hasEm,
      laneTotal: laneCountsTotal(settings.laneN),
    },
  };
}
