// MESITA-1051 — third search leg: prior Google names.
// Service-role only (the table is EF-locked). Callers already hold adminClient.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export async function placeIdsMatchingNameHistory(
  admin: SupabaseClient,
  pattern: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("place_name_history")
    .select("place_id")
    .ilike("google_name", pattern)
    .limit(16);
  if (error) {
    console.error("[place-name-history] search:", error.message);
    return [];
  }
  const ids = [
    ...new Set(
      (data ?? [])
        .map((r) => (r as { place_id?: unknown }).place_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  return ids;
}

export function mergePlaceRowsById<T extends { id: string }>(
  primary: T[],
  extra: T[],
  cap: number,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of [...primary, ...extra]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= cap) break;
  }
  return out;
}
