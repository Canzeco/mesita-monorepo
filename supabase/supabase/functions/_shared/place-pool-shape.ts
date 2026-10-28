// The Feed's place shape and the helper that makes a row safe to return
// (consumer-web-list-catalog). Was `recommender-pool-shape.ts` until
// MESITA-1048.

import type { WeeklyHours } from "./local-time.ts";
import { withFamilyKeys } from "./place-family-keys.ts";

// Shape of a candidate place row: the public place projection. `embedding`
// is the one internal column a pool could carry; stripInternal drops it
// before the row crosses back over the wire to a client.
export type PlaceProfileRow = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  price_level: number | null;
  state: string;
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
  // Paid OpenAI vector. No pool selects it since its last reader, the Swipe
  // deck, retired (MESITA-2328); never returned to a client.
  embedding?: unknown | null;
};

// TWO jobs, both load-bearing — do not "simplify" this away:
//   1. Drops the internal `embedding` column so the row is safe to return to a
//      client. The leading-underscore rest-omit destructuring discards it.
//   2. Attaches `family_keys` via place-taxonomy (stored / Atlas / Google).
//      consumer "What" discovery filter reads that field straight off the
//      wire; drop it and the filter silently matches nothing.
// `name` is the Mesita name (MESITA-2828); a cleared name already fell back
// to google_name in the trigger, so there is no work here.
export function stripInternal(
  v: PlaceProfileRow,
): Omit<PlaceProfileRow, "embedding"> & { family_keys: string[] } {
  const {
    embedding: _e,
    ...rest
  } = v;
  return withFamilyKeys(rest);
}
