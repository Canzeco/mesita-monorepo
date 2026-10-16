// One awaited verifier for Google, Instagram, and Facebook (MESITA-2189).
//
// Sync calls these functions and waits. Profile save does not. Nothing is
// fired in the background, and no Edge Function calls another. A technical
// failure is not found: the flag stays boolean, and the reason is logged
// here, never stored on the place.

import {
  APIFY_ACTORS,
  apifyActorError,
  instagramHandleFromUrl,
  runApifyActor,
} from "./apify.ts";
import { isDeadIgStub } from "./enrich-instagram-match.ts";
import {
  GOOGLE_PLACES_DETAILS_BASE,
  readGooglePlacesKey,
} from "./google-places.ts";
import { numOf } from "./parse-utils.ts";
import {
  socialAccountReplaced,
  socialSourcesToEmpty,
  type SocialUrlPair,
} from "./reviews-state.ts";

export const REVIEW_VERIFY_TIMEOUT_MS = 20_000;

export const REVIEW_FOUND_FLAG_KEYS = [
  "google_found",
  "instagram_found",
  "facebook_found",
] as const;

export type ReviewFoundFlagKey = (typeof REVIEW_FOUND_FLAG_KEYS)[number];

const REVIEWS_OWNED_BODY_KEYS = [
  "google_stars_overall",
  "google_review_count",
  "instagram_followers_count",
  "facebook_followers",
  ...REVIEW_FOUND_FLAG_KEYS,
  "reviews_state",
] as const;

export type ReviewMetrics = {
  google_stars_overall: number | null;
  google_review_count: number | null;
  instagram_followers_count: number | null;
  facebook_followers: number | null;
};

export type ReviewVerify = {
  found: boolean;
  metrics: ReviewMetrics;
  /** Live Instagram profile. The identity judge reads this instead of scraping again. */
  profile?: Record<string, unknown> | null;
  /** Log only. Never written to the place. */
  reason?: string;
};

export type GatheredReview = {
  url?: string | null;
  found: boolean;
  metrics: ReviewMetrics;
};

type ReviewSourceName = "google" | "instagram" | "facebook";

const FLAG: Record<ReviewSourceName, ReviewFoundFlagKey> = {
  google: "google_found",
  instagram: "instagram_found",
  facebook: "facebook_found",
};

const LINK: Record<"instagram" | "facebook", string> = {
  instagram: "instagram_url",
  facebook: "facebook_url",
};

const NUMBER_KEYS: Record<ReviewSourceName, (keyof ReviewMetrics)[]> = {
  google: ["google_stars_overall", "google_review_count"],
  instagram: ["instagram_followers_count"],
  facebook: ["facebook_followers"],
};

export function emptyReviewMetrics(): ReviewMetrics {
  return {
    google_stars_overall: null,
    google_review_count: null,
    instagram_followers_count: null,
    facebook_followers: null,
  };
}

function notFound(reason: string): ReviewVerify {
  return { found: false, metrics: emptyReviewMetrics(), profile: null, reason };
}

function logMiss(source: string, reason: string) {
  console.error(`[review-sources] ${source}: ${reason}`);
}

/** A profile save must not carry tile numbers or found flags. The verifier writes them. */
export function reviewsOwnedBodyKey(body: object): string | null {
  for (const key of REVIEWS_OWNED_BODY_KEYS) {
    if (key in body) return key;
  }
  return null;
}

export function googleMetricsFromDetails(
  body: { rating?: unknown; userRatingCount?: unknown } | null,
): ReviewMetrics {
  const stars =
    typeof body?.rating === "number" && body.rating >= 0 && body.rating <= 5
      ? body.rating
      : null;
  const count = typeof body?.userRatingCount === "number" &&
      Number.isInteger(body.userRatingCount) && body.userRatingCount >= 0
    ? body.userRatingCount
    : null;
  return {
    ...emptyReviewMetrics(),
    google_stars_overall: stars,
    google_review_count: count,
  };
}

export function gatheredReview(
  url: string | null,
  result: ReviewVerify,
): GatheredReview {
  return {
    url,
    found: result.found,
    metrics: result.found ? result.metrics : emptyReviewMetrics(),
  };
}

/** Found stores the new numbers. Not found, or a cleared link, stores false and nulls them.
 *  The link argument is the latest one, including one that did not resolve. */
export function reviewSourcePatch(opts: {
  source: ReviewSourceName;
  link?: string | null;
  result?: ReviewVerify;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (opts.source !== "google" && opts.link !== undefined) {
    patch[LINK[opts.source]] = opts.link;
  }
  const found = opts.link === null ? false : opts.result?.found === true;
  patch[FLAG[opts.source]] = found;
  const metrics = opts.result?.metrics;
  for (const key of NUMBER_KEYS[opts.source]) {
    const value = found ? metrics?.[key] : null;
    patch[key] = value ?? null;
  }
  return patch;
}

export async function verifyInstagram(
  url: string | null,
  apifyKey?: string,
): Promise<ReviewVerify> {
  const handle = instagramHandleFromUrl(url);
  if (!handle) return notFound("no_handle");
  const key = apifyKey ?? Deno.env.get("APIFY_KEY")?.trim();
  if (!key) {
    logMiss("instagram", "no_apify_key");
    return notFound("no_apify_key");
  }
  const run = await runApifyActor<Record<string, unknown>>(
    APIFY_ACTORS.instagramProfile,
    { usernames: [handle] },
    key,
    REVIEW_VERIFY_TIMEOUT_MS,
  );
  if (run.error) {
    const reason = apifyActorError(run.error);
    logMiss("instagram", reason);
    return notFound(reason);
  }
  const profile = run.items?.[0];
  if (!profile || isDeadIgStub(profile)) return notFound("not_a_profile");
  return {
    found: true,
    metrics: {
      ...emptyReviewMetrics(),
      instagram_followers_count: numOf(profile.followersCount),
    },
    profile,
  };
}

export async function verifyFacebook(
  url: string | null,
  apifyKey?: string,
): Promise<ReviewVerify> {
  if (!url?.trim()) return notFound("no_url");
  const key = apifyKey ?? Deno.env.get("APIFY_KEY")?.trim();
  if (!key) {
    logMiss("facebook", "no_apify_key");
    return notFound("no_apify_key");
  }
  const run = await runApifyActor<Record<string, unknown>>(
    APIFY_ACTORS.facebookPages,
    { startUrls: [{ url }] },
    key,
    REVIEW_VERIFY_TIMEOUT_MS,
  );
  if (run.error) {
    const reason = apifyActorError(run.error);
    logMiss("facebook", reason);
    return notFound(reason);
  }
  const page = run.items?.[0];
  if (!page) return notFound("no_page");
  return {
    found: true,
    metrics: {
      ...emptyReviewMetrics(),
      facebook_followers: numOf(page.followers) ?? numOf(page.likes),
    },
  };
}

export async function verifyGoogle(
  googlePlaceId: string | null,
): Promise<ReviewVerify> {
  if (!googlePlaceId?.trim()) return notFound("no_place_id");
  const key = readGooglePlacesKey();
  if (!key.ok) {
    logMiss("google", "no_google_key");
    return notFound("no_google_key");
  }
  let response: Response;
  try {
    response = await fetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${
        encodeURIComponent(googlePlaceId)
      }?languageCode=es-MX&regionCode=MX`,
      {
        signal: AbortSignal.timeout(REVIEW_VERIFY_TIMEOUT_MS),
        headers: {
          "X-Goog-Api-Key": key.key,
          "X-Goog-FieldMask": "rating,userRatingCount",
        },
      },
    );
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    logMiss("google", reason);
    return notFound(reason);
  }
  if (!response.ok) {
    logMiss("google", `http_${response.status}`);
    return notFound(`http_${response.status}`);
  }
  const body = await response.json().catch(() => null) as {
    rating?: unknown;
    userRatingCount?: unknown;
  } | null;
  return { found: true, metrics: googleMetricsFromDetails(body) };
}

type SocialNext = {
  instagram_url?: string | null;
  facebook_url?: string | null;
};

export const SOCIAL_NOT_CONNECTED = "social_not_connected" as const;

export type SocialLinkField = "instagram_url" | "facebook_url";

/** A profile save writes the patch only when every changed account is
 *  connected. A miss carries the sentence the save bar shows. */
export type SocialLinksCheck =
  | { ok: true; patch: Record<string, unknown> }
  | {
    ok: false;
    code: typeof SOCIAL_NOT_CONNECTED;
    error: string;
    /** A timeout or a dark vendor can be tried again. A dead account cannot. */
    retryable: boolean;
    fields: SocialLinkField[];
  };

const ACCOUNT_MISS = new Set([
  "no_handle",
  "not_a_profile",
  "no_page",
  "no_url",
]);

const FIELD: Record<"instagram" | "facebook", SocialLinkField> = {
  instagram: "instagram_url",
  facebook: "facebook_url",
};

/** A definite miss is an account the scraper did not find. Anything else
 *  is the vendor, and the operator can try the same link again. */
export function socialConnectionRefusal(
  source: "instagram" | "facebook",
  reason: string | undefined,
): { text: string; retryable: boolean } {
  const name = source === "instagram" ? "Instagram" : "Facebook";
  if (reason != null && ACCOUNT_MISS.has(reason)) {
    const what = source === "instagram" ? "an account" : "a page";
    return {
      text:
        `${name} isn't connected. That link doesn't open ${what}, so nothing was saved.`,
      retryable: false,
    };
  }
  return {
    text: `${name} couldn't be checked, so nothing was saved. Try again.`,
    retryable: true,
  };
}

/** An unchanged URL is absent from the patch. A cleared link nulls the
 *  numbers without a fetch. A changed link waits for the verifier. A link
 *  the verifier does not find refuses the save: the caller writes nothing.
 *  Both changed links are fetched together. */
export async function verifyChangedSocialLinks(opts: {
  prev: SocialUrlPair;
  next: SocialNext;
  verifyInstagram?: (url: string) => Promise<ReviewVerify>;
  verifyFacebook?: (url: string) => Promise<ReviewVerify>;
}): Promise<SocialLinksCheck> {
  const plan = socialSourcesToEmpty(opts.prev, opts.next);
  const ig = opts.verifyInstagram ?? ((url: string) => verifyInstagram(url));
  const fb = opts.verifyFacebook ?? ((url: string) => verifyFacebook(url));
  const [instagram, facebook] = await Promise.all([
    socialPatch("instagram", plan.instagram, opts.next.instagram_url, ig),
    socialPatch("facebook", plan.facebook, opts.next.facebook_url, fb),
  ]);
  const misses = [instagram, facebook].flatMap((row) =>
    row?.miss ? [row.miss] : []
  );
  if (misses.length > 0) {
    return {
      ok: false,
      code: SOCIAL_NOT_CONNECTED,
      error: misses.map((miss) => miss.text).join(" "),
      retryable: misses.every((miss) => miss.retryable),
      fields: misses.map((miss) => miss.field),
    };
  }
  return {
    ok: true,
    patch: {
      ...(instagram?.patch ?? {}),
      ...(facebook?.patch ?? {}),
    },
  };
}

async function socialPatch(
  source: "instagram" | "facebook",
  changed: boolean,
  link: string | null | undefined,
  verify: (url: string) => Promise<ReviewVerify>,
): Promise<
  {
    patch?: Record<string, unknown>;
    miss?: { field: SocialLinkField; text: string; retryable: boolean };
  } | null
> {
  if (!changed) return null;
  if (link == null || link.trim() === "") {
    return { patch: reviewSourcePatch({ source, link: null }) };
  }
  const result = await verify(link);
  if (!result.found) {
    const refusal = socialConnectionRefusal(source, result.reason);
    return {
      miss: {
        field: FIELD[source],
        text: refusal.text,
        retryable: refusal.retryable,
      },
    };
  }
  // Connected is enough to save the URL. Followers and review data wait
  // for Sync. Clearing a link still drops the old count below.
  return { patch: { [LINK[source]]: link } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function metricsFrom(value: unknown): ReviewMetrics {
  const row = asRecord(value);
  const base = emptyReviewMetrics();
  if (!row) return base;
  for (const key of Object.keys(base) as (keyof ReviewMetrics)[]) {
    const n = row[key];
    base[key] = typeof n === "number" ? n : null;
  }
  return base;
}

/** Third's one profile write. A verifier result stored by First wins.
 *  An older gather that changed the account without one still clears the
 *  previous numbers, so a new link never keeps the old account's count. */
export function applyGatheredReviews(
  placeUpdate: Record<string, unknown>,
  reviews: unknown,
  live: { instagram_url: string | null; facebook_url: string | null } | null,
): void {
  const block = asRecord(reviews);
  const google = asRecord(block?.google);
  if (google) {
    Object.assign(
      placeUpdate,
      reviewSourcePatch({
        source: "google",
        result: {
          found: google.found === true,
          metrics: metricsFrom(google.metrics),
        },
      }),
    );
  }
  applySocial(
    "instagram",
    block?.instagram,
    placeUpdate,
    live?.instagram_url ?? null,
  );
  applySocial(
    "facebook",
    block?.facebook,
    placeUpdate,
    live?.facebook_url ?? null,
  );
}

function applySocial(
  source: "instagram" | "facebook",
  raw: unknown,
  placeUpdate: Record<string, unknown>,
  liveUrl: string | null,
): void {
  const row = asRecord(raw);
  if (row) {
    const url = typeof row.url === "string"
      ? row.url
      : row.url === null
      ? null
      : undefined;
    Object.assign(
      placeUpdate,
      reviewSourcePatch({
        source,
        link: url,
        result: {
          found: row.found === true,
          metrics: metricsFrom(row.metrics),
        },
      }),
    );
    return;
  }
  const next = placeUpdate[LINK[source]];
  if (!socialAccountReplaced(liveUrl, next) || typeof next !== "string") return;
  Object.assign(
    placeUpdate,
    reviewSourcePatch({
      source,
      link: next,
      result: { found: false, metrics: emptyReviewMetrics() },
    }),
  );
}
