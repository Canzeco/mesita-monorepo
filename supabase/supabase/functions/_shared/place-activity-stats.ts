// Profile Stats (MESITA-2735): Mesita Views and Mesita Likes of a place.
// EVERY OPEN IS A VIEW (Pato, MESITA-3422: "if someone sees one profile twice,
// it counts as two view events"): views come from place_view_counts, which
// counts place_events (one row per open, the number Business shows). Likes
// stay one per member (place_activity, kind saved).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PlaceProfileStats = {
  viewed: number;
  saved: number;
};

async function countSaved(admin: SupabaseClient, placeId: string): Promise<number> {
  const { count, error } = await admin
    .from("place_activity")
    .select("*", { count: "exact", head: true })
    .eq("place_id", placeId)
    .eq("kind", "saved");
  if (error) {
    console.error("[place-activity-stats] saved:", error.message);
    return 0;
  }
  return typeof count === "number" && count >= 0 ? count : 0;
}

/** Every open per place (place_view_counts). Null when the read failed. */
async function viewCounts(
  admin: SupabaseClient,
  placeIds: readonly string[],
): Promise<Map<string, number> | null> {
  const { data, error } = await admin.rpc("place_view_counts", { p_place_ids: placeIds });
  if (error) {
    console.error("[place-activity-stats] views:", error.message);
    return null;
  }
  const out = new Map<string, number>();
  for (const r of (data ?? []) as { place_id: string; views: number | string }[]) {
    out.set(r.place_id, Number(r.views) || 0);
  }
  return out;
}

/** Best-effort counts for admin Profile Stats. Errors read as 0. */
export async function fetchPlaceProfileStats(
  admin: SupabaseClient,
  placeId: string,
): Promise<PlaceProfileStats> {
  const [views, saved] = await Promise.all([
    viewCounts(admin, [placeId]),
    countSaved(admin, placeId),
  ]);
  return { viewed: views?.get(placeId) ?? 0, saved };
}

/** Views and likes for many places at once — the Single Place table
 *  (MESITA-2809). Views from place_view_counts (every open, MESITA-3422);
 *  likes page place_activity by 1000 per id chunk, since a capped read would
 *  undercount. Best-effort: a failed read leaves the place out,
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
    const views = await viewCounts(admin, chunk);
    let ok = views != null;
    for (const [id, n] of views ?? []) {
      const c = counts.get(id);
      if (c) c.viewed = n;
    }
    for (let from = 0; ok; from += PAGE) {
      const { data, error } = await admin
        .from("place_activity")
        .select("place_id, kind")
        .in("place_id", chunk)
        .eq("kind", "saved")
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
        if (r.kind === "saved") c.saved++;
      }
      if (!data || data.length < PAGE) break;
    }
    if (ok) for (const [id, c] of counts) out.set(id, c);
  }
  return out;
}
