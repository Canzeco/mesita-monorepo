// In-process ranking pipeline for the consumer swipe view.
//
// Absorbed from the former `recommender-rank-swipe` artificial-caller EF
// (MESITA-54): the HTTP hop was a synchronous 1:1 forward with a single
// natural caller, so per the actor-origin grammar the pipeline now runs
// in-process inside `consumer-web-recommend-swipe`. Any future surface that
// needs the same ranking imports this module — no endpoint required.
//
// Pure ranking pipeline. Takes a location + optional consumer profile and
// returns a curated 50-card deck for the consumer swipe view. Anonymous
// requests are valid — discovery is public until sign-up, so the caller
// passes profile=null when there's no session.
//
// Pipeline:
//   1. Pull a bounded candidate pool by bounding-box radius (cheap).
//   2. Lazy-embed any candidates missing an embedding (single batched
//      OpenAI call, capped so first-cold-request stays sub-EF-timeout).
//   3. Compose a one-sentence intent query from the profile + location
//      + time of day + dominant categories in the pool.
//   4. Embed the intent once and ORDER BY cosine.
//   5. Diversify (no >4 cards in the same category) + trim to limit.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  embedAndPersistPlaces,
  embedSingle,
  rankByCosine,
  shouldEmbed,
} from "./embeddings.ts";
import {
  type ConsumerProfile,
  fetchCandidatePool,
  stripInternal,
  type PlaceRow,
} from "./recommender-pool.ts";
import { demoteClosed } from "./local-time.ts";
import {
  applyTierBoost,
  composeIntent,
  diversify,
  fallbackRank,
} from "./recommender-rank-swipe-helpers.ts";

const CANDIDATE_POOL = 200;
const MAX_PER_CATEGORY = 4;
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
    deck: Omit<PlaceRow, "embedding" | "embedding_source_hash">[];
    summary: {
      candidates: number;
      embedded: number;
      intent?: string;
      caller?: string;
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
      }
    }
  }

  // ── 3. Compose user-intent query ───────────────────────────────────
  const intent = composeIntent({ profile, lat, lng, candidates });

  // ── 4. Rank by embedding similarity (or fall back to partner-first) ──
  let ranked: PlaceRow[];
  if (openaiKey) {
    try {
      const intentVec = await embedSingle(intent, openaiKey);
      ranked = rankByCosine(candidates, intentVec);
    } catch (err) {
      console.error(`[${callerName}] intent embed failed:`, err);
      ranked = fallbackRank(candidates);
    }
  } else {
    ranked = fallbackRank(candidates);
  }

  // ── 5. Tier boost + open-now demotion + diversity + trim ────────────
  // Premium guests get a stronger partner-first deck (a real perk: better,
  // more rewarding recommendations). Free guests keep the pure relevance
  // order. The boost is a stable partial reorder, so within partners /
  // within non-partners the relevance ranking from step 4 is preserved.
  const boosted = applyTierBoost(ranked, profile?.tier ?? null);
  // "Demote, don't hide" (same product call as Memo): float open places above
  // closed ones from each place's stored hours + local time, preserving the
  // relevance/partner order inside each open/unknown/closed bucket. Places with
  // no hours data are neutral — never penalised.
  const opened = demoteClosed(boosted, (r) => r.hours, (r) => r.lng);
  const deck = diversify(opened, limit, MAX_PER_CATEGORY);

  return {
    ok: true,
    deck: deck.map(stripInternal),
    summary: {
      candidates: candidates.length,
      embedded: embeddedCount,
      intent,
      caller: callerName,
    },
  };
}
