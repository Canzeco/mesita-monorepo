/** Review-source found booleans on place_profiles (MESITA-2189). */

export type ReviewFoundFlags = {
  google_found: boolean;
  instagram_found: boolean;
  facebook_found: boolean;
};

export function emptyReviewFound(): ReviewFoundFlags {
  return {
    google_found: false,
    instagram_found: false,
    facebook_found: false,
  };
}

/** Strict read: only `true` counts as found (matches admin EFs). */
export function reviewFoundFlags(raw: {
  google_found?: unknown;
  instagram_found?: unknown;
  facebook_found?: unknown;
}): ReviewFoundFlags {
  return {
    google_found: raw.google_found === true,
    instagram_found: raw.instagram_found === true,
    facebook_found: raw.facebook_found === true,
  };
}

type ReviewFoundLike = {
  google_found?: unknown;
  instagram_found?: unknown;
  facebook_found?: unknown;
};

/** After a partial EF response: only explicit booleans override prior flags. */
export function mergeReviewFoundFlags(prev: ReviewFoundLike, patch: ReviewFoundLike): ReviewFoundFlags {
  const base = reviewFoundFlags(prev);
  return {
    google_found: typeof patch.google_found === "boolean" ? patch.google_found : base.google_found,
    instagram_found: typeof patch.instagram_found === "boolean"
      ? patch.instagram_found
      : base.instagram_found,
    facebook_found: typeof patch.facebook_found === "boolean"
      ? patch.facebook_found
      : base.facebook_found,
  };
}
