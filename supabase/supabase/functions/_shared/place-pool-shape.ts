// Shared place/consumer shapes and two tiny helpers used by the place-reading
// EFs. Was `recommender-pool-shape.ts` until MESITA-1048. Lives next to
// place-pool.ts (the candidate-pool query) so callers can import types without
// pulling the Supabase query path.

import type { WeeklyHours } from "./local-time.ts";
import { withFamilyKeys } from "./place-family-keys.ts";

// Shape of a candidate place row: the public place projection plus the one
// internal column the pool still carries, `embedding`. stripInternal drops it
// before the row crosses back over the wire to a client.
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
  // IANA timezone string when enrichment filled it. Informational.
  timezone: string | null;
  closes_at: string | null;
  // Normalised weekly hours (see WeeklyHours / migrations 0008 + 20252120001).
  // Null when unenriched.
  hours: WeeklyHours | null;
  phone: string | null;
  pitch: string | null;
  story: string | null;
  description: string | null;
  zone: string | null;
  city: string | null;
  photos: string[] | null;
  [key: string]: unknown;
  // Paid OpenAI vector. Read by the cosine rank in Memo's RAG leg; never
  // returned to a client.
  embedding: unknown | null;
};

// Minimal consumer-context shape. Anonymous requests pass null.
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

// TWO jobs, both load-bearing — do not "simplify" this away:
//   1. Drops the internal `embedding` column so the row is safe to return to a
//      client. The leading-underscore rest-omit destructuring discards it.
//   2. Attaches `family_keys` via place-taxonomy (stored / Atlas / Google).
//      consumer "What" discovery filter reads that field straight off the
//      wire; drop it and the filter silently matches nothing.
// `name` is already the resolved display label (generated column, MESITA-925),
// so cleared Mesita overrides fall back to google_name with no work here.
export function stripInternal(
  v: PlaceRow,
): Omit<PlaceRow, "embedding"> & { family_keys: string[] } {
  const { embedding: _e, ...rest } = v;
  return withFamilyKeys(rest);
}
