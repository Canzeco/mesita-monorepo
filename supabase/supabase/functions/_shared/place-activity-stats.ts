// Profile Stats for admin (MESITA-2735): unique members who saved or viewed
// a place. One row per consumer × place × kind in place_activity — count is
// the member cardinality, not event volume (a re-opened profile bumps
// created_at but does not add a row).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PlaceProfileStats = {
  viewed: number;
  saved: number;
};

async function countKind(
  admin: SupabaseClient,
  placeId: string,
  kind: "viewed" | "saved",
): Promise<number> {
  const { count, error } = await admin
    .from("place_activity")
    .select("*", { count: "exact", head: true })
    .eq("place_id", placeId)
    .eq("kind", kind);
  if (error) {
    console.error(`[place-activity-stats] ${kind}:`, error.message);
    return 0;
  }
  return typeof count === "number" && count >= 0 ? count : 0;
}

/** Best-effort counts for admin Profile Stats. Errors read as 0. */
export async function fetchPlaceProfileStats(
  admin: SupabaseClient,
  placeId: string,
): Promise<PlaceProfileStats> {
  const [viewed, saved] = await Promise.all([
    countKind(admin, placeId, "viewed"),
    countKind(admin, placeId, "saved"),
  ]);
  return { viewed, saved };
}
