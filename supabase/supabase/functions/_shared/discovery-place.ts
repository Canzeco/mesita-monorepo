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

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { SignalPlace } from "./discovery-signals.ts";
import { isPlacePromoting, type PromotingFields } from "./place-promoting.ts";
import { pulseOf } from "./pulse-pieces.ts";

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
 *
 * `intake_high_water` (MESITA-1598) is read straight off the row like any
 * other field — it is NOT selected by `EARNED_LANE_COLUMNS` (`places.
 * enrichment` sits behind the `profiles` view and isn't in the public
 * projection), so a row only carries it when the caller ran
 * `attachIntakeHighWater` first. A row that never got that side-read simply
 * has the key absent, which `mesitaLevel` reads as "unknown" (full credit),
 * never a silent penalty.
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
    intakeHighWater: nOrNull(row.intake_high_water),
  };
}

/**
 * The side-read `mesita_level` needs but `profiles` doesn't carry
 * (MESITA-1598): `places.enrichment->highWater` for a batch of place ids,
 * merged onto each row as `intake_high_water` — the same shape
 * `toLineupPlace` already knows how to read off any other column. Call this
 * AFTER the main admission query and BEFORE ranking; rows for ids the query
 * returns nothing for simply keep no key, which `mesitaLevel` treats as
 * "unknown" rather than a confirmed zero.
 *
 * One batched query regardless of pool size — never N+1, and it never joins
 * into the ranking query itself, so a surface that doesn't call this pays
 * nothing extra.
 */
export async function attachIntakeHighWater<
  T extends Record<string, unknown>,
>(
  admin: SupabaseClient,
  rows: T[],
): Promise<(T & { intake_high_water?: number })[]> {
  if (rows.length === 0) return [];
  const ids = rows
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return rows;

  const { data, error } = await admin
    .from("place_profiles")
    .select("id, enrichment")
    .in("id", ids);
  if (error) {
    // Degrade to UNKNOWN for everyone, never to a confirmed-zero — a failed
    // side-read must not read as "the whole pool is at the Created floor".
    // Logged, not thrown: ranking must not 500 over this query hiccuping.
    console.error("[discovery-place] attachIntakeHighWater:", error.message);
    return rows;
  }
  const byId = new Map<string, number>();
  for (const row of (data ?? []) as { id: string; enrichment: unknown }[]) {
    byId.set(row.id, pulseOf(row.enrichment));
  }
  // A row the query returned nothing for (a place-id-shaped id that isn't
  // actually in `places`, or an org-pool oddity) gets a real 0 — it IS
  // confirmed unenriched by absence, not merely un-fetched.
  return rows.map((r) => ({
    ...r,
    intake_high_water: byId.get(r.id as string) ?? 0,
  }));
}

/**
 * Lane 2's projection. `placePromotingLevel` reads these and nothing else, and
 * it is the only thing in Discovery permitted to.
 */
export function toPromotingFields(row: Record<string, unknown>): PromotingFields {
  return row as unknown as PromotingFields;
}
