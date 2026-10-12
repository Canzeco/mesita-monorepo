// The place row, projected for the signals (MESITA-1196).
//
// Every engine that ranks needs the same projection: what the earned signals
// may read, and nothing else. Doing this per-engine would mean each new
// surface re-deriving it — and the first one to hand a whole row to the blend
// lets a signal reach for any column the query happened to select.
//
// WHY A TRANSLATION LAYER AT ALL. `places` stores the review numbers under
// GOOGLE's names — `google_stars_overall`, `google_review_count` — because
// that is whose observation they are. The signal library calls them `rating`
// and `user_ratings_total` because a scoring function should not have to know
// which vendor supplied a fact; the day a second source lands, the signal does
// not change, this file does.
//
// This mapping fails SILENTLY when it is wrong, which is why it is a module
// with a test rather than an inline object literal: read the wrong column and
// Popularity sees null for every place, falls back to the catalog prior, and
// scores the entire deck identically — a dead signal that looks perfectly
// healthy in every log and every response.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { SignalPlace } from "./discovery-signals.ts";
import { isEnrichedPlace } from "./place-family-keys.ts";
import { crenupOf } from "./crenup-ladder.ts";
import { chunked, ID_CHUNK } from "./postgrest.ts";

/**
 * The columns a ranking engine must SELECT beyond PLACE_PUBLIC_COLUMNS.
 *
 * Only `embedding` — everything else the signals need is already in the
 * public projection. It is excluded from that list on purpose (a 1536-float
 * vector has no business on a consumer payload), and `stripInternal` drops it
 * again on the way out.
 */
export const DISCOVERY_EXTRA_COLUMNS = "embedding" as const;

/** Every column the earned signals read, by its name on `places`. */
export const EARNED_LANE_COLUMNS = [
  "lat",
  "lng",
  "hours",
  "category",
  "google_stars_overall",
  "google_review_count",
  "embedding",
  // `enriched_at` is the one column `isEnrichedPlace` reads (MESITA-2154);
  // `content_state` rides along for the lifecycle. Both are already in
  // PLACE_PUBLIC_COLUMNS, so no consumer payload grows.
  "content_state",
  "enriched_at",
] as const;

function nOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * The signals' projection — the columns in EARNED_LANE_COLUMNS, under the
 * signal library's own names.
 *
 * `enriched` is set HERE, explicitly, and the signal never re-derives it
 * (MESITA-1858). Since MESITA-2154 `isEnrichedPlace` reads `enriched_at`
 * alone, so a Created place (content_state ready, no stamp) scores OFF and a
 * relation that lacks the column reads not-enriched — the safe direction. A
 * synthesized Google row is still excluded by name: consumer-web-list-places
 * builds it with `googleOnly: true` on a hit Mesita has never touched, and
 * it must never take the enriched multiplier whatever else it carries.
 */
export function toSignalPlace(row: Record<string, unknown>): SignalPlace {
  return {
    lat: nOrNull(row.lat),
    lng: nOrNull(row.lng),
    hours: row.hours,
    category: typeof row.category === "string" ? row.category : null,
    family_keys: Array.isArray(row.family_keys) ? (row.family_keys as string[]) : null,
    rating: nOrNull(row.google_stars_overall),
    user_ratings_total: nOrNull(row.google_review_count),
    embedding: row.embedding,
    enriched: row.googleOnly === true ? false : isEnrichedPlace(row as {
      enriched_at?: string | null;
    }),
  };
}

/**
 * Places Lineup projection: `toSignalPlace` plus the two facts only some rows
 * carry, the name vector and the Crenup high-water. New blend call sites use
 * this so Name can actually fire.
 *
 * `crenup_high_water` (MESITA-1598) is read straight off the row like any
 * other field — it is NOT selected by `EARNED_LANE_COLUMNS` (`places.
 * enrichment` sits behind the `profiles` view and isn't in the public
 * projection), so a row only carries it when the caller ran
 * `attachCrenupHighWater` first. THE `enriched` SIGNAL READS IT (MESITA-1858
 * kept the gradient: the binary alone is a constant on every lane that admits
 * only enriched rows). A row without it scores the binary instead.
 */
export function toLineupPlace(row: Record<string, unknown>): SignalPlace {
  return {
    ...toSignalPlace(row),
    nameEmbedding: row.name_embedding,
    crenupHighWater: nOrNull(row.crenup_high_water),
  };
}

/**
 * The side-read the retired `mesita_level` gradient needed and `profiles`
 * doesn't carry (MESITA-1598): `places.enrichment->highWater` for a batch of
 * place ids, merged onto each row as `crenup_high_water` — the same shape
 * `toLineupPlace` already knows how to read off any other column. Call this
 * AFTER the main admission query and BEFORE ranking.
 *
 * THIS IS WHAT MAKES `enriched` AN AXIS (MESITA-1858). The signal's binary
 * half reads the same predicate the ranked lanes admit on, so without this
 * side-read it answers 1 for every row it is ever handed. The gradient it
 * feeds is the only part of the signal that can reorder an admitted pool.
 *
 * Batched in `ID_CHUNK`s, run in parallel — never N+1, and it never joins
 * into the ranking query itself, so a surface that doesn't call this pays
 * nothing extra. Chunked since MESITA-2047: an `in` list rides in the URL,
 * and Scroll's closed-within-reach band can hand this hundreds of ids, which
 * one request would have lost to the URL length limit.
 */
export async function attachCrenupHighWater<
  T extends Record<string, unknown>,
>(
  admin: SupabaseClient,
  rows: T[],
): Promise<(T & { crenup_high_water?: number })[]> {
  if (rows.length === 0) return [];
  const ids = rows
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return rows;

  const parts = await Promise.all(
    chunked(ids, ID_CHUNK).map((part) =>
      admin
        .from("place_profiles")
        .select("id, enrichment")
        .in("id", part)
    ),
  );
  const failed = parts.find((r) => r.error);
  if (failed?.error) {
    // Degrade to UNKNOWN for everyone, never to a confirmed-zero — a failed
    // side-read must not read as "the whole pool is at the Created floor".
    // Logged, not thrown: ranking must not 500 over this query hiccuping.
    console.error("[discovery-place] attachCrenupHighWater:", failed.error.message);
    return rows;
  }
  const byId = new Map<string, number>();
  for (const { data } of parts) {
    for (const row of (data ?? []) as { id: string; enrichment: unknown }[]) {
      byId.set(row.id, crenupOf(row.enrichment));
    }
  }
  // A row the query returned nothing for (a place-id-shaped id that isn't
  // actually in `places`, or an org-pool oddity) gets a real 0 — it IS
  // confirmed unenriched by absence, not merely un-fetched.
  return rows.map((r) => ({
    ...r,
    crenup_high_water: byId.get(r.id as string) ?? 0,
  }));
}
