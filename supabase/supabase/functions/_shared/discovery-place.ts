// The place row, split into the two lanes (MESITA-1196).
//
// Every engine that ranks needs the same two projections, and they must stay
// separate: one carries what the EARNED signals may read, the other carries
// what the BOUGHT slotting pass may read, and nothing carries both. Doing this
// per-engine would mean each new surface re-deriving the split — and the first
// one to hand a whole row to the blend quietly reunites the lanes.
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
import { isPlacePromoting, type PromotingFields } from "./place-promoting.ts";

/**
 * The columns a ranking engine must SELECT beyond PLACE_PUBLIC_COLUMNS.
 *
 * Only `embedding` — everything else the two lanes need is already in the
 * public projection. It is excluded from that list on purpose (a 1536-float
 * vector has no business on a consumer payload), and `stripInternal` drops it
 * again on the way out.
 */
export const DISCOVERY_EXTRA_COLUMNS = "embedding" as const;

/** Every column the earned lane reads, by its name on `places`. */
export const EARNED_LANE_COLUMNS = [
  "lat",
  "lng",
  "hours",
  "category",
  "google_stars_overall",
  "google_review_count",
  "embedding",
] as const;

/** Every column the bought lane reads. Disjoint from the list above, by design. */
export const BOUGHT_LANE_COLUMNS = [
  "plan",
  "welcome_free_rate",
  "welcome_premium_rate",
  "free_rate",
  "premium_rate",
  "strike_count",
  "last_strike_at",
  "promo_paused_until",
  "plan_forfeited_at",
  "reward_lane_pending_review_at",
] as const;

function nOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Lane 1's projection. Rates and pause columns stay off SignalPlace.
 * Promotion reads the computed `promoting` boolean, not those columns.
 *
 * `mesita_stars_overall` is deliberately NOT folded into the rating: Mesita's
 * own review counts are thin enough today that blending them would move the
 * Bayesian shrinkage on noise. That is a second signal when it has volume, not
 * a second term in this one.
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
  };
}

/**
 * Places Lineup projection. `toSignalPlace` stays the earned-lane split
 * (no `plan`, no name vector, no `promoting`). New blend call sites use
 * this so Name, Partnership, and Promotion can actually fire.
 */
export function toLineupPlace(row: Record<string, unknown>): SignalPlace {
  return {
    ...toSignalPlace(row),
    nameEmbedding: row.name_embedding,
    plan: typeof row.plan === "string"
      ? row.plan
      : row.plan == null
      ? null
      : String(row.plan),
    promoting: isPlacePromoting(row),
  };
}

/**
 * Lane 2's projection. `placePromotingLevel` reads these and nothing else, and
 * it is the only thing in Discovery permitted to.
 */
export function toPromotingFields(row: Record<string, unknown>): PromotingFields {
  return row as unknown as PromotingFields;
}
