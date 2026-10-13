// Supabase Edge Function — admin-web-reload-place-reviews (MESITA-2183)
//
// One source, one click. Writes that source's tile columns and reviews_state.
// Does not touch place_research, enriched_at, photos, or google_reviews.
//
//   instagram  saved instagram_url → follower count, no posts
//   facebook   saved facebook_url  → follower count
//   google     google_place_id     → Places rating + userRatingCount
//
// A failed read keeps the previous number and marks the source failed.
// No link is 400 and writes nothing.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { writePlace } from "../_shared/place-doc.ts";
import { gatherFacebook } from "../_shared/enrich-facebook.ts";
import { scrapeInstagramFollowers } from "../_shared/social-followers.ts";
import { GOOGLE_PLACES_DETAILS_BASE, readGooglePlacesKey } from "../_shared/google-places.ts";
import {
  failedReviewSource,
  normalizeReviewsState,
  readyReviewSource,
  withReviewSource,
  type ReviewSourceName,
  type ReviewSourceState,
} from "../_shared/reviews-state.ts";

const SOURCES = new Set<ReviewSourceName>(["google", "instagram", "facebook"]);

type Body = { placeId?: string; projectId?: string; source?: string };

type PlaceRow = {
  id: string;
  google_place_id: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  instagram_followers_count: number | null;
  facebook_followers: number | null;
  reviews_state: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can reload reviews.");
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "Missing placeId" }, 400);
  const source = (bodyRes.body.source ?? "").toString().trim() as ReviewSourceName;
  if (!SOURCES.has(source)) {
    return json({ ok: false, error: "source must be google, instagram, or facebook" }, 400);
  }

  const { data, error } = await admin
    .from("place_profiles")
    .select(
      "id, google_place_id, instagram_url, facebook_url, google_stars_overall, google_review_count, instagram_followers_count, facebook_followers, reviews_state",
    )
    .eq("id", placeId)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, error: "Place not found" }, 404);
  const place = data as PlaceRow;

  const linkError = unlinked(source, place);
  if (linkError) return json({ ok: false, code: "unlinked", error: linkError }, 400);

  const fetched = await fetchSource(source, place);
  const previous = normalizeReviewsState(place.reviews_state);
  const now = new Date().toISOString();
  const nextSource: ReviewSourceState = fetched.ok
    ? readyReviewSource(now)
    : failedReviewSource(previous[source], fetched.error);
  const reviewsState = withReviewSource(previous, source, nextSource);

  const patch: Record<string, unknown> = { reviews_state: reviewsState };
  if (fetched.ok) Object.assign(patch, fetched.columns);

  const written = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch,
  });
  if (!written.ok) return json({ ok: false, error: written.error }, 500);

  return json({
    ok: true,
    source,
    failed: !fetched.ok,
    error: fetched.ok ? null : fetched.error,
    google_stars_overall: "google_stars_overall" in patch
      ? patch.google_stars_overall
      : place.google_stars_overall,
    google_review_count: "google_review_count" in patch
      ? patch.google_review_count
      : place.google_review_count,
    instagram_followers_count: "instagram_followers_count" in patch
      ? patch.instagram_followers_count
      : place.instagram_followers_count,
    facebook_followers: "facebook_followers" in patch
      ? patch.facebook_followers
      : place.facebook_followers,
    reviews_state: reviewsState,
  });
});

function unlinked(source: ReviewSourceName, place: PlaceRow): string | null {
  if (source === "instagram" && !place.instagram_url?.trim()) {
    return "Add an Instagram link on Profile";
  }
  if (source === "facebook" && !place.facebook_url?.trim()) {
    return "Add a Facebook link on Profile";
  }
  if (source === "google" && !place.google_place_id?.trim()) {
    return "This place has no Google place id";
  }
  return null;
}

type FetchResult =
  | { ok: true; columns: Record<string, number> }
  | { ok: false; error: string };

async function fetchSource(source: ReviewSourceName, place: PlaceRow): Promise<FetchResult> {
  if (source === "instagram") {
    const key = Deno.env.get("APIFY_KEY")?.trim();
    if (!key) return { ok: false, error: "No Apify key configured." };
    const count = await scrapeInstagramFollowers(key, place.instagram_url);
    if (count == null) return { ok: false, error: "Couldn't reload. Try again." };
    return { ok: true, columns: { instagram_followers_count: count } };
  }
  if (source === "facebook") {
    const key = Deno.env.get("APIFY_KEY")?.trim();
    if (!key) return { ok: false, error: "No Apify key configured." };
    const fb = await gatherFacebook({ apifyKey: key, facebookUrl: place.facebook_url! });
    if (fb.diag.ok !== true || fb.fbFollowers == null) {
      return { ok: false, error: "Couldn't reload. Try again." };
    }
    return { ok: true, columns: { facebook_followers: fb.fbFollowers } };
  }
  const key = readGooglePlacesKey();
  if (!key.ok) return { ok: false, error: "Google Places is not configured." };
  return fetchGoogleScore(place.google_place_id!, key.key);
}

async function fetchGoogleScore(placeId: string, apiKey: string): Promise<FetchResult> {
  let response: Response;
  try {
    response = await fetch(
      `${GOOGLE_PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}?languageCode=es-MX&regionCode=MX`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "rating,userRatingCount",
        },
      },
    );
  } catch {
    return { ok: false, error: "Couldn't reload. Try again." };
  }
  if (!response.ok) return { ok: false, error: "Couldn't reload. Try again." };
  const body = await response.json().catch(() => null) as {
    rating?: unknown;
    userRatingCount?: unknown;
  } | null;
  const stars = typeof body?.rating === "number" && body.rating >= 0 && body.rating <= 5
    ? body.rating
    : null;
  const count = typeof body?.userRatingCount === "number" &&
      Number.isInteger(body.userRatingCount) && body.userRatingCount >= 0
    ? body.userRatingCount
    : null;
  if (stars == null && count == null) return { ok: false, error: "Google returned no rating." };
  const columns: Record<string, number> = {};
  if (stars != null) columns.google_stars_overall = stars;
  if (count != null) columns.google_review_count = count;
  return { ok: true, columns };
}
