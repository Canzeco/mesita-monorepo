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

import type { SignalPlace } from "./discovery-signals.ts";
import { isEnrichedPlace } from "./place-family-keys.ts";

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
 * Places Lineup projection: `toSignalPlace` plus the name vector, which only
 * some rows carry. New blend call sites use this so Name can actually fire.
 */
export function toLineupPlace(row: Record<string, unknown>): SignalPlace {
  return {
    ...toSignalPlace(row),
    nameEmbedding: row.name_embedding,
  };
}

