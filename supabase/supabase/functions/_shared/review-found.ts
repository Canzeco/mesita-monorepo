// Review-source found booleans on place_profiles (MESITA-2189). The profiles
// view does not carry these columns; admin reads and the enrichment writer
// peel them before touching the view.

import {
  REVIEW_FOUND_FLAG_KEYS,
  type ReviewFoundFlagKey,
} from "./review-sources.ts";

export { REVIEW_FOUND_FLAG_KEYS, type ReviewFoundFlagKey };

export type ReviewFoundFlags = Record<ReviewFoundFlagKey, boolean>;

export function emptyReviewFound(): ReviewFoundFlags {
  return {
    google_found: false,
    instagram_found: false,
    facebook_found: false,
  };
}

/** Strict boolean read: only `true` counts as found. */
export function reviewFoundFromRow(row: Record<string, unknown>): ReviewFoundFlags {
  const out = emptyReviewFound();
  for (const key of REVIEW_FOUND_FLAG_KEYS) {
    if (row[key] === true) out[key] = true;
  }
  return out;
}

/** Apply a patch: only explicit booleans override the previous flags. */
export function mergeReviewFoundFlags(
  prev: ReviewFoundFlags,
  patch: Partial<Record<ReviewFoundFlagKey, unknown>>,
): ReviewFoundFlags {
  const out = { ...prev };
  for (const key of REVIEW_FOUND_FLAG_KEYS) {
    const next = patch[key];
    if (typeof next === "boolean") out[key] = next;
  }
  return out;
}
