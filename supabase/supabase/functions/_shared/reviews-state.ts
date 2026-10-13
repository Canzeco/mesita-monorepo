// Reviews state (MESITA-2183). Independent of enriched_at and of the
// Enricher ladder. One record per source. `loading` is a browser fact and
// is never stored.
//
// The four tile columns (google_stars_overall, google_review_count,
// instagram_followers_count, facebook_followers) are written only by the
// reviews reload, plus a save that clears a count when its URL changes.
// Create and the Enricher omit them.

export const REVIEWS_TILE_COLUMNS = [
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "facebook_followers",
] as const;

export type ReviewsTileColumn = (typeof REVIEWS_TILE_COLUMNS)[number];

export const REVIEW_SOURCES = ["google", "instagram", "facebook"] as const;
export type ReviewSourceName = (typeof REVIEW_SOURCES)[number];
export type ReviewSourceStatus = "empty" | "ready" | "failed";

export type ReviewSourceState = {
  status: ReviewSourceStatus;
  fetched_at: string | null;
  error: string | null;
};

export type ReviewsState = Record<ReviewSourceName, ReviewSourceState>;

const STATUSES = new Set<ReviewSourceStatus>(["empty", "ready", "failed"]);

export function emptyReviewSource(): ReviewSourceState {
  return { status: "empty", fetched_at: null, error: null };
}

export function emptyReviewsState(): ReviewsState {
  return {
    google: emptyReviewSource(),
    instagram: emptyReviewSource(),
    facebook: emptyReviewSource(),
  };
}

export function readyReviewSource(fetchedAt: string): ReviewSourceState {
  return { status: "ready", fetched_at: fetchedAt, error: null };
}

/** A failed read keeps the previous success time. The number columns are
 *  left untouched by the caller. */
export function failedReviewSource(
  previous: ReviewSourceState | undefined,
  error: string,
): ReviewSourceState {
  return {
    status: "failed",
    fetched_at: previous?.status === "ready" ? previous.fetched_at : (previous?.fetched_at ?? null),
    error,
  };
}

function sourceOrEmpty(raw: unknown): ReviewSourceState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const status = row.status;
  if (typeof status !== "string" || !STATUSES.has(status as ReviewSourceStatus)) return null;
  const fetched = row.fetched_at;
  const error = row.error;
  if (fetched != null && typeof fetched !== "string") return null;
  if (error != null && typeof error !== "string") return null;
  return {
    status: status as ReviewSourceStatus,
    fetched_at: typeof fetched === "string" ? fetched : null,
    error: typeof error === "string" ? error : null,
  };
}

/** Lenient read. A missing or messy blob becomes empty sources, never a throw. */
export function normalizeReviewsState(raw: unknown): ReviewsState {
  const base = emptyReviewsState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const row = raw as Record<string, unknown>;
  for (const name of REVIEW_SOURCES) {
    const parsed = sourceOrEmpty(row[name]);
    if (parsed) base[name] = parsed;
  }
  return base;
}

/** Strict write check for place-doc. Null is refused: the column is NOT NULL. */
export function parseReviewsState(v: unknown): { ok: boolean; error?: string } {
  if (v == null || typeof v !== "object" || Array.isArray(v)) {
    return { ok: false, error: "must be an object with google, instagram, and facebook" };
  }
  const row = v as Record<string, unknown>;
  for (const name of REVIEW_SOURCES) {
    if (sourceOrEmpty(row[name]) == null) {
      return { ok: false, error: `${name} must be { status, fetched_at, error }` };
    }
  }
  return { ok: true };
}

export function withReviewSource(
  state: ReviewsState,
  name: ReviewSourceName,
  source: ReviewSourceState,
): ReviewsState {
  return { ...state, [name]: source };
}

/** Drop the four tile columns so Create and Contents cannot publish them. */
export function omitReviewsTileColumns<T extends Record<string, unknown>>(place: T): T {
  const next = { ...place };
  for (const key of REVIEWS_TILE_COLUMNS) delete next[key];
  return next;
}

export type SocialUrlPair = {
  instagram_url: string | null;
  facebook_url: string | null;
};

/** Contents replays URLs it did not choose. Only a different non-empty
 *  account empties the count. A missing URL, a null, or a cosmetic spelling
 *  of the same link does not. */
export function socialAccountReplaced(prev: string | null, next: unknown): boolean {
  if (typeof next !== "string" || !next.trim() || !prev?.trim()) return false;
  return canonicalSocialUrl(prev) !== canonicalSocialUrl(next);
}

function canonicalSocialUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${parsed.protocol}//${host}${path}`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

/** Which social sources a profile save must empty. Undefined in `next`
 *  means that URL was not in the patch. */
export function socialSourcesToEmpty(
  prev: SocialUrlPair,
  next: { instagram_url?: string | null; facebook_url?: string | null },
): { instagram: boolean; facebook: boolean } {
  return {
    instagram: next.instagram_url !== undefined && next.instagram_url !== prev.instagram_url,
    facebook: next.facebook_url !== undefined && next.facebook_url !== prev.facebook_url,
  };
}
