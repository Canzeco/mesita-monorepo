// The exact columns business-web-get-place reads, plus the photo cap.
//
// It lives BESIDE index.ts rather than inside it because index.ts calls
// `Deno.serve` at module load: importing it to assert the projection would
// start a server. A sibling module is importable, so the audience boundary
// below is a test (place-projection.test.ts) instead of a comment.
//
// AUDIENCE BOUNDARY. `_shared/place-columns.ts::PLACE_PUBLIC_COLUMNS` is NOT
// a clearance list — it is the CONSUMER projection, and it also carries
// `plan`, `listing_type`, `strike_count`, `last_strike_at`,
// `promo_paused_until` and `plan_forfeited_at`. "It is in
// PLACE_PUBLIC_COLUMNS" therefore proves nothing about what a BUSINESS may
// see. This file hand-picks instead, and every column has a stated reason.

/** From `projects` — the commercial row that holds the place. */
export const PROJECT_COLUMNS: readonly string[] = [
  "id",
  // The raw state. `listed` derives from it; the console shows the raw label
  // only as the REASON when listed is false (Paused, Waiting on review…).
  "state",
  // Intaker lifecycle, so the screen can say Enriching rather than a bare No.
  "content_state",
  // ISO 4217 for this place. Already shown in Identity.
  "currency",
  "organization_id",
  "claimed_at",
  "created_at",
  "updated_at",
];

/** From the embedded `places` row — what the address IS. */
export const PLACE_COLUMNS: readonly string[] = [
  "name",
  "address",
  "zone",
  "city",
  "category",
  "category_label",
  "phone",
  "timezone",
  "enriched_at",
  // The storefront images. Theirs: uploaded by them, or enriched for them.
  // Public bucket (`place-images`), so these are permanent /object/public/
  // URLs with no token and no expiry.
  "photos",
  // Public Google facts about their own address. Shown as one Identity row.
  "google_stars_overall",
  "google_review_count",
];

/** Columns that must NEVER appear in this projection. `plan` and
 *  `listing_type` encode the retired two-tier membership (MESITA-1534); the
 *  strike/promo columns are lane inputs; the rest are operator machinery. */
export const FORBIDDEN_COLUMNS: readonly string[] = [
  "plan",
  "listing_type",
  "strike_count",
  "last_strike_at",
  "promo_paused_until",
  "plan_forfeited_at",
  "reward_lane_pending_review_at",
  "google_place_id",
  "embedding",
  "name_embedding",
  "embedding_source_text",
  "enrichment",
  "check_pin",
  "cfdi_rfc",
];

export const GET_PLACE_SELECT =
  `${PROJECT_COLUMNS.join(", ")}, place_profiles!inner(${PLACE_COLUMNS.join(", ")})`;

/** Photos are capped for the wire, not for the truth: `totalPhotos` still
 *  reports the real count so the screen can say "10 of 13".
 *
 *  The cap is applied HERE, in TypeScript, and not in the select — `photos`
 *  is a `text[]` and PostgREST's `select=` has no array-slice syntax, so the
 *  whole array always crosses PG → EF. This bounds EF → client only, which
 *  is the hop that renders. */
export const MAX_PHOTOS = 10;

/** Tolerant on purpose: the column is `not null default '{}'`, but a row can
 *  still carry nulls or non-strings inside the array, and a bad element must
 *  never reach an `<img src>`. */
export function capPhotos(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .slice(0, MAX_PHOTOS);
}

/** The true count, before the cap. */
export function totalPhotos(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.filter((p) => typeof p === "string" && p.trim() !== "").length;
}
