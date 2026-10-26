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

/** Views and likes for many places at once — the Single Place table
 *  (MESITA-2809). Pages place_activity by 1000 per id chunk, since a capped
 *  read would undercount. Best-effort: a failed read leaves the place out,
 *  and the table says "?" for it rather than a false 0. */
export async function fetchPlaceProfileStatsMany(
  admin: SupabaseClient,
  placeIds: readonly string[],
): Promise<Map<string, PlaceProfileStats>> {
  const out = new Map<string, PlaceProfileStats>();
  const PAGE = 1000;
  for (let i = 0; i < placeIds.length; i += 100) {
    const chunk = placeIds.slice(i, i + 100);
    const counts = new Map<string, PlaceProfileStats>(
      chunk.map((id) => [id, { viewed: 0, saved: 0 }]),
    );
    let ok = true;
    for (let from = 0;; from += PAGE) {
      const { data, error } = await admin
        .from("place_activity")
        .select("place_id, kind")
        .in("place_id", chunk)
        .in("kind", ["viewed", "saved"])
        .order("place_id")
        .order("consumer_id")
        .order("kind")
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[place-activity-stats] many:", error.message);
        ok = false;
        break;
      }
      for (const r of (data ?? []) as { place_id: string; kind: string }[]) {
        const c = counts.get(r.place_id);
        if (!c) continue;
        if (r.kind === "viewed") c.viewed++;
        else if (r.kind === "saved") c.saved++;
      }
      if (!data || data.length < PAGE) break;
    }
    if (ok) for (const [id, c] of counts) out.set(id, c);
  }
  return out;
}
