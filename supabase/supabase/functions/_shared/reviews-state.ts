// Reviews numbers (MESITA-2189). Google stars, the review count, and the
// two follower counts are not enrichment facts and are not typed on Profile.
// The verifier in review-sources.ts is the only writer. Create and Enrich
// strip them off the gathered place; Create then stores Google's two from
// the Details call that minted the row, through the verifier's own patch
// (MESITA-2306); Third puts back whatever the verifier stored on
// gathered.sources.reviews.

export const REVIEWS_TILE_COLUMNS = [
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "facebook_followers",
] as const;

export type ReviewsTileColumn = (typeof REVIEWS_TILE_COLUMNS)[number];

/** Drop the four tile columns so a gathered place cannot publish them.
 *  Flags and numbers are applied afterwards from the verifier result. */
export function omitReviewsTileColumns<T extends Record<string, unknown>>(place: T): T {
  const next = { ...place };
  for (const key of REVIEWS_TILE_COLUMNS) delete next[key];
  return next;
}

export type SocialUrlPair = {
  instagram_url: string | null;
  facebook_url: string | null;
};

/** A replay of the same account is not a change. Only a different non-empty
 *  account counts. Facebook `profile.php?id=` stays in the comparison;
 *  tracking params do not. */
export function socialAccountReplaced(prev: string | null, next: unknown): boolean {
  if (typeof next !== "string" || !next.trim() || !prev?.trim()) return false;
  return canonicalSocialUrl(prev) !== canonicalSocialUrl(next);
}

const TRACKING_PARAMS = new Set([
  "fbclid",
  "hl",
  "igsh",
  "igshid",
  "ref",
  "refsrc",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

function canonicalSocialUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "m.facebook.com" || host === "fb.com" || host.endsWith(".facebook.com")) {
      host = "facebook.com";
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    const query = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    return `https://${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

/** Which social URLs a profile save must verify. Undefined in `next`
 *  means that URL was not in the patch. Equality is exact: a resubmitted
 *  form must not fetch again. */
export function socialSourcesToEmpty(
  prev: SocialUrlPair,
  next: { instagram_url?: string | null; facebook_url?: string | null },
): { instagram: boolean; facebook: boolean } {
  return {
    instagram: next.instagram_url !== undefined && next.instagram_url !== prev.instagram_url,
    facebook: next.facebook_url !== undefined && next.facebook_url !== prev.facebook_url,
  };
}
