// _shared/update-place.ts
//
// Thin PLACE update door: validates the three jsonb keys that have a real
// schema (place-jsonb-schemas.ts) when present, and explicitly refuses
// `name` (an extra runtime belt alongside place-name-writes.test.ts's
// source-grep — Postgres already rejects a `name` write with 428C9, but
// refusing here surfaces the mistake as a validation error instead of a
// raw DB error). Everything else passes through unchecked: places has 40+
// writable columns (place-columns.ts's COLUMNS), and validating all of them
// is not this PR's job (see non-goals).
//
// This door validates SHAPE, not AUTHORIZATION — which fields a given
// caller may legitimately touch (business editing its own place vs. the
// Enricher writing signal columns vs. Stripe flipping plan state) stays
// that caller's own responsibility, exactly as it is today.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleReviewsSchema, PlaceDetailsSchema, PopularTimesSchema } from "./place-jsonb-schemas.ts";

export async function updatePlace(
  admin: SupabaseClient,
  placeId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true; value: { id: string } } | { ok: false; error: string }> {
  if ("name" in patch) {
    return { ok: false, error: "places.name is a generated column and cannot be written" };
  }
  const out = { ...patch };
  if ("details" in patch) {
    const r = PlaceDetailsSchema.parse(patch.details);
    if (!r.ok) return { ok: false, error: `details: ${r.error}` };
    out.details = r.value;
  }
  if ("google_reviews" in patch) {
    const r = GoogleReviewsSchema.parse(patch.google_reviews);
    if (!r.ok) return { ok: false, error: `google_reviews: ${r.error}` };
    out.google_reviews = r.value;
  }
  if ("popular_times" in patch) {
    const r = PopularTimesSchema.parse(patch.popular_times);
    if (!r.ok) return { ok: false, error: `popular_times: ${r.error}` };
    out.popular_times = r.value;
  }
  const { error } = await admin.from("places").update(out).eq("id", placeId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { id: placeId } };
}
