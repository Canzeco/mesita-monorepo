// Reviews numbers (MESITA-2189). Google stars, the review count, and the
// two follower counts are not enrichment facts and are not typed on Profile.
// The verifier in review-sources.ts is the only writer. Create and Enrich
// strip them off the gathered place; Create then stores Google's two from
// the Details call that minted the row, through the verifier's own patch
// (MESITA-2306).

export const REVIEWS_TILE_COLUMNS = [
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "facebook_followers",
] as const;

/** Drop the four tile columns so a gathered place cannot publish them.
 *  Flags and numbers are applied afterwards from the verifier result. */
export function omitReviewsTileColumns<T extends Record<string, unknown>>(place: T): T {
  const next = { ...place };
  for (const key of REVIEWS_TILE_COLUMNS) delete next[key];
  return next;
}
