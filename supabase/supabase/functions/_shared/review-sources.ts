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
import { googleFetch } from "./google-fetch.ts";
import { numOf } from "./parse-utils.ts";
import { errorMessage } from "./errors.ts";

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
    response = await googleFetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${
        encodeURIComponent(googlePlaceId)
      }?languageCode=es-MX&regionCode=MX`,
      {
        apiKey: key.key,
        fieldMask: "rating,userRatingCount",
        timeoutMs: REVIEW_VERIFY_TIMEOUT_MS,
      },
    );
  } catch (e) {
    const reason = errorMessage(e);
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
