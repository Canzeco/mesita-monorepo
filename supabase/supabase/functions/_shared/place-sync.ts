// One Sync for Google, Instagram, and Facebook.
//
// The function fetches, checks, and normalizes. It does not write.
// A manual Reviews sync persists the patch. Enrichment folds the same
// patch into the run draft and commits once.
//
// Instagram Found and Facebook Found follow the last check (MESITA-3247): an
// answer sets true with the new count; a failure sets false and leaves the
// last count, so a timeout never blanks a real number. No link sets false and
// leaves the count: both callers pass the link the place ends up with, so a
// missing one means the place has none (MESITA-3251). Google Found is not here:
// Details just answered in the same Enrich, and a failed lookup must not undo it.

export type SyncSourceName = "google" | "instagram" | "facebook" | "google_reviews";

export type SyncSourceStatus = "no_link" | "synced" | "error";

export type SyncSourceResult = {
  source: SyncSourceName;
  status: SyncSourceStatus;
  error: string | null;
  patch: Record<string, unknown>;
};

export type PlaceSyncResult = {
  lastSyncedAt: string;
  sources: SyncSourceResult[];
  patch: Record<string, unknown>;
};

export type SyncLinks = {
  googlePlaceId?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
};

export type GoogleSummary = { stars: number | null; count: number | null };

type Ok<T> = { ok: true; value: T } | { ok: false; error: string };

export type SyncFetchers = {
  googleSummary: (googlePlaceId: string) => Promise<Ok<GoogleSummary>>;
  instagramSummary: (url: string) => Promise<Ok<{ followers: number | null }>>;
  facebookSummary: (url: string) => Promise<Ok<{ followers: number | null }>>;
  googleReviews: (googlePlaceId: string) => Promise<Ok<unknown[]>>;
};

function linked(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

function outcome(
  source: SyncSourceName,
  status: SyncSourceStatus,
  error: string | null,
  patch: Record<string, unknown> = {},
): SyncSourceResult {
  return { source, status, error, patch };
}

/** Replace the review list. A second sync with the same list does not append. */
export function replaceGoogleReviews(reviews: unknown[]): unknown[] {
  return reviews.slice();
}

export function syncPatch(sources: readonly SyncSourceResult[], now: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const source of sources) Object.assign(patch, source.patch);
  patch.source_sync = {
    lastSyncedAt: now,
    sources: sources.map((source) => ({
      source: source.source,
      status: source.status,
      error: source.error,
    })),
  };
  return patch;
}

export async function syncSavedLinks(opts: {
  links: SyncLinks;
  fetchers: SyncFetchers;
  now?: string;
}): Promise<PlaceSyncResult> {
  const now = opts.now ?? new Date().toISOString();
  const googleId = linked(opts.links.googlePlaceId);
  const instagram = linked(opts.links.instagramUrl);
  const facebook = linked(opts.links.facebookUrl);

  const [google, instagramResult, facebookResult, reviews] = await Promise.all([
    googleId
      ? opts.fetchers.googleSummary(googleId).then((result) =>
        result.ok
          ? outcome("google", "synced", null, {
            google_stars_overall: result.value.stars,
            google_review_count: result.value.count,
          })
          : outcome("google", "error", result.error)
      )
      : Promise.resolve(outcome("google", "no_link", null)),
    instagram
      ? opts.fetchers.instagramSummary(instagram).then((result) =>
        result.ok
          ? outcome("instagram", "synced", null, {
            instagram_found: true,
            instagram_followers_count: result.value.followers,
          })
          : outcome("instagram", "error", result.error, { instagram_found: false })
      )
      : Promise.resolve(outcome("instagram", "no_link", null, { instagram_found: false })),
    facebook
      ? opts.fetchers.facebookSummary(facebook).then((result) =>
        result.ok
          ? outcome("facebook", "synced", null, {
            facebook_found: true,
            facebook_followers: result.value.followers,
          })
          : outcome("facebook", "error", result.error, { facebook_found: false })
      )
      : Promise.resolve(outcome("facebook", "no_link", null, { facebook_found: false })),
    googleId
      ? opts.fetchers.googleReviews(googleId).then((result) =>
        result.ok
          ? outcome("google_reviews", "synced", null, {
            google_reviews: replaceGoogleReviews(result.value),
          })
          : outcome("google_reviews", "error", result.error)
      )
      : Promise.resolve(outcome("google_reviews", "no_link", null)),
  ]);

  const sources = [google, instagramResult, facebookResult, reviews];
  return { lastSyncedAt: now, sources, patch: syncPatch(sources, now) };
}
