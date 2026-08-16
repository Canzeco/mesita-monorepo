// Bounded candidate-pool query over the active place catalog.
//
// Was `recommender-pool.ts` until MESITA-1048. The Lineup scoring engine that
// named it is gone; the query survived because Memo's RAG leg
// (supabase-edgefunc-recall-places) genuinely needs it: pull a bounded set of
// ACTIVE places — by bounding box when the caller has a location, otherwise
// newest-first — then cosine-rank them against an embedded intent.
//
// Keeping the SELECT in one place means a new place column flows into every
// reader without per-EF edits.
//
// Place/consumer shapes + clampPositive/stripInternal live in
// place-pool-shape.ts; re-exported here so callers can import either.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { PLACE_PUBLIC_COLUMNS } from "./place-columns.ts";
import { haversineKm, radiusBoundingBox } from "./geo.ts";

export {
  clampPositive,
  type ConsumerProfile,
  type PlaceRow,
  stripInternal,
} from "./place-pool-shape.ts";

// The public projection plus ONE extra column: `embedding`, the paid OpenAI
// vector cosine ranking reads. The other three columns this projection used to
// carry died with the Lineup engine (MESITA-1048):
//   • manual_priority           — the MP subscore's input. The COLUMN stays in
//                                 the database (dropping it means rebuilding
//                                 projects_view and both INSTEAD OF triggers,
//                                 which reopened an anon-browse RLS hole once
//                                 before), but no code reads it anymore.
//   • embedding_source_hash     — only the lazy-embed writeback needed these,
//   • embedding_source_text       and nothing on this path writes.
// `embedding` is stripped by stripInternal before a row crosses back over the
// wire to a client.
const POOL_PLACE_COLUMNS = PLACE_PUBLIC_COLUMNS + ", embedding";

type CandidatePoolOptions = {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  poolSize: number;
};

type CandidatePoolResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; error: string };

// Returns the rows trimmed to radius (when location is supplied) and capped
// at poolSize. Callers cast the result to their local PlaceRow type so they
// can keep stricter typing.
export async function fetchCandidatePool<T extends { lat: number | null; lng: number | null }>(
  admin: SupabaseClient,
  { lat, lng, radiusKm, poolSize }: CandidatePoolOptions,
): Promise<CandidatePoolResult<T>> {
  if (lat != null && lng != null) {
    const { latDelta, lngDelta } = radiusBoundingBox(lat, radiusKm);
    const { data, error } = await admin
      .from("projects_view")
      .select(POOL_PLACE_COLUMNS)
      .eq("status", "active")
      .gte("lat", lat - latDelta)
      .lte("lat", lat + latDelta)
      .gte("lng", lng - lngDelta)
      .lte("lng", lng + lngDelta)
      .limit(poolSize);
    if (error) return { ok: false, error: error.message };
    // Exact haversine trim — bounding box is coarse, especially at higher
    // latitudes where the lng span overshoots.
    const trimmed = ((data ?? []) as unknown as T[]).filter(
      (v) => haversineKm(lat, lng, v.lat, v.lng) <= radiusKm,
    );
    return { ok: true, rows: trimmed };
  }

  const { data, error } = await admin
    .from("projects_view")
    .select(POOL_PLACE_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(poolSize);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as unknown as T[] };
}
