// Shared place/consumer shapes and tiny helpers used by the recommender
// pipelines. Lives next to recommender-pool.ts (the candidate-pool query)
// so rankers and EF entrypoints can import types without pulling the
// Supabase query path.

import type { WeeklyHours } from "./local-time.ts";

// Shape of a candidate place row as projected by RECOMMENDER_PLACE_COLUMNS.
// Both rankers (recommender-rank-swipe.ts, recommender-rank-map.ts) cast the
// candidate pool to this type. The trailing `embedding` /
// `embedding_source_hash` are ranker-internal and get stripped by
// stripInternal before the row crosses back over the wire to the client.
export type PlaceRow = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  vibe: string | null;
  price_level: number | null;
  listing_type: "partner" | "web";
  status: string;
  fiscal_type: string | null;
  plan: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  // IANA timezone string when enrichment filled it; the rankers derive their
  // own zone from lng (see _shared/local-time.ts) so this stays informational.
  timezone: string | null;
  closes_at: string | null;
  // Normalised weekly hours (see WeeklyHours / migrations 0008 + 20252120001).
  // Powers the "open now" demotion in both rankers. Null when unenriched.
  hours: WeeklyHours | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  photos: string[] | null;
  [key: string]: unknown;
  embedding: unknown | null;
  embedding_source_hash: string | null;
};

// Minimal consumer-context the rankers thread into intent composition /
// category proposal. Anonymous requests pass null; tier drives the Premium
// overlay and aspirational curation.
export type ConsumerProfile = {
  full_name: string | null;
  country: string | null;
  birthday: string | null;
  sex: string | null;
  tier?: string | null;
};

export function clampPositive(v: unknown, def: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

// Drops the two ranker-internal columns so the row is safe to return to the
// client. The leading-underscore rest-omit destructuring discards them.
export function stripInternal(
  v: PlaceRow,
): Omit<PlaceRow, "embedding" | "embedding_source_hash"> {
  const { embedding: _e, embedding_source_hash: _h, ...rest } = v;
  return rest;
}
