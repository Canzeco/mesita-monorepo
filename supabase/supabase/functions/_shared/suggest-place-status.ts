import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { PredictionStatus } from "./suggest-places-helpers.ts";

// One owner-lookup pass over a place-row set, returning the per-placeId
// PredictionStatus. `web_listed` for unowned rows; `verified_partner_self/_other`
// for owned ones depending on whether the caller is the owner.
export async function statusesForPlaces(
  admin: SupabaseClient,
  rows: Array<{ id: string; google_place_id: string }>,
  callerId: string | null,
): Promise<Map<string, PredictionStatus>> {
  if (rows.length === 0) return new Map();
  const { data, error } = await admin
    .from("project_members")
    .select("place_id, manager_id")
    .in("place_id", rows.map((r) => r.id))
    .eq("role", "owner");
  if (error) {
    console.error("[suggest-places] owner lookup:", error.message);
  }
  const ownerByPlace = new Map<string, string>();
  for (
    const m of (data ?? []) as Array<{
      place_id: string;
      manager_id: string;
    }>
  ) {
    ownerByPlace.set(m.place_id, m.manager_id);
  }
  const out = new Map<string, PredictionStatus>();
  for (const v of rows) {
    const ownerId = ownerByPlace.get(v.id);
    out.set(
      v.google_place_id,
      ownerId
        ? callerId && ownerId === callerId
          ? "verified_partner_self"
          : "verified_partner_other"
        : "web_listed",
    );
  }
  return out;
}
