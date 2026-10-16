// Supabase Edge Function — admin-web-reload-place-reviews (MESITA-2189)
//
// One source, one click. Calls the shared verifier and writes that
// source's found flag and numbers. Does not touch place_research,
// enriched_at, photos, or google_reviews. Keeps no fetch of its own.
//
//   instagram       saved instagram_url → follower count
//   facebook        saved facebook_url  → follower count
//   google          google_place_id     → Places rating + userRatingCount
//   google_reviews  google_place_id     → the individual review list
//
// Stars and the list are separate clicks. The star click does not write
// google_reviews. The list click does not write the star average or the count.
//
// A technical failure is not found: the flag is false and the numbers
// are nulled. The reason stays in the verifier's log. No link is 400
// and writes nothing. A failed list scrape writes nothing.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { writePlace } from "../_shared/place-doc.ts";
import { gatherGoogleMaps } from "../_shared/enrich-google.ts";
import {
  googleReviewListFromScrape,
  type GoogleReviewSnippet,
} from "../_shared/enrich-google-review-snippets.ts";
import {
  reviewSourcePatch,
  verifyFacebook,
  verifyGoogle,
  verifyInstagram,
  type ReviewVerify,
} from "../_shared/review-sources.ts";
import { mergeReviewFoundFlags, reviewFoundFromRow } from "../_shared/review-found.ts";
import { runPlaceSync } from "../_shared/place-sync-run.ts";

const SOURCES = new Set(["google", "google_reviews", "instagram", "facebook", "sync"]);

type Body = { placeId?: string; projectId?: string; source?: string };
type SourceName = "google" | "google_reviews" | "instagram" | "facebook" | "sync";

type PlaceRow = {
  id: string;
  google_place_id: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  instagram_followers_count: number | null;
  facebook_followers: number | null;
  google_found: boolean;
  instagram_found: boolean;
  facebook_found: boolean;
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
  const source = (bodyRes.body.source ?? "").toString().trim() as SourceName;
  if (!SOURCES.has(source)) {
    return json({ ok: false, error: "source must be sync, google, google_reviews, instagram, or facebook" }, 400);
  }

  const { data, error } = await admin
    .from("place_profiles")
    .select(
      "id, google_place_id, instagram_url, facebook_url, google_stars_overall, google_review_count, instagram_followers_count, facebook_followers, google_found, instagram_found, facebook_found",
    )
    .eq("id", placeId)
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, error: "Place not found" }, 404);
  const place = data as PlaceRow;

  if (source === "sync") {
    const synced = await runPlaceSync({
      googlePlaceId: place.google_place_id,
      instagramUrl: place.instagram_url,
      facebookUrl: place.facebook_url,
    });
    const written = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch: synced.patch,
    });
    if (!written.ok) return json({ ok: false, error: written.error }, 500);
    return json({
      ok: true,
      source: "sync",
      lastSyncedAt: synced.lastSyncedAt,
      sources: synced.sources.map((row) => ({
        source: row.source,
        status: row.status,
        error: row.error,
      })),
      google_stars_overall: numberOr(synced.patch.google_stars_overall, place.google_stars_overall),
      google_review_count: numberOr(synced.patch.google_review_count, place.google_review_count),
      instagram_followers_count: numberOr(synced.patch.instagram_followers_count, place.instagram_followers_count),
      facebook_followers: numberOr(synced.patch.facebook_followers, place.facebook_followers),
      google_reviews: synced.patch.google_reviews ?? undefined,
      source_sync: synced.patch.source_sync,
    });
  }

  const linkError = unlinked(source, place);
  if (linkError) return json({ ok: false, code: "unlinked", error: linkError }, 400);

  if (source === "google_reviews") {
    const listed = await reloadGoogleReviewList(place.google_place_id);
    if (!listed.ok) return json({ ok: false, error: listed.error }, listed.status);
    const written = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch: { google_reviews: listed.list },
    });
    if (!written.ok) return json({ ok: false, error: written.error }, 500);
    return json({
      ok: true,
      source,
      ...numbers(place),
      google_reviews: listed.list ?? [],
    });
  }

  const result = await verifySource(source, place);
  const patch = reviewSourcePatch({ source, result });
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
    google_stars_overall: numberOr(patch.google_stars_overall, place.google_stars_overall),
    google_review_count: numberOr(patch.google_review_count, place.google_review_count),
    instagram_followers_count: numberOr(patch.instagram_followers_count, place.instagram_followers_count),
    facebook_followers: numberOr(patch.facebook_followers, place.facebook_followers),
    ...mergeReviewFoundFlags(reviewFoundFromRow(place), patch),
  });
});

function numberOr(next: unknown, prev: number | null): number | null {
  if (next === null) return null;
  return typeof next === "number" ? next : prev;
}

function unlinked(source: SourceName, place: PlaceRow): string | null {
  if (source === "instagram" && !place.instagram_url?.trim()) {
    return "Add an Instagram link on Profile";
  }
  if (source === "facebook" && !place.facebook_url?.trim()) {
    return "Add a Facebook link on Profile";
  }
  if ((source === "google" || source === "google_reviews") && !place.google_place_id?.trim()) {
    return "This place has no Google place id";
  }
  return null;
}

function verifySource(source: Exclude<SourceName, "google_reviews">, place: PlaceRow): Promise<ReviewVerify> {
  if (source === "instagram") return verifyInstagram(place.instagram_url);
  if (source === "facebook") return verifyFacebook(place.facebook_url);
  return verifyGoogle(place.google_place_id);
}

function numbers(place: PlaceRow) {
  return {
    google_stars_overall: place.google_stars_overall,
    google_review_count: place.google_review_count,
    instagram_followers_count: place.instagram_followers_count,
    facebook_followers: place.facebook_followers,
    ...reviewFoundFromRow(place),
  };
}

async function reloadGoogleReviewList(
  googlePlaceId: string | null,
): Promise<
  | { ok: true; list: GoogleReviewSnippet[] | null }
  | { ok: false; error: string; status: number }
> {
  const key = Deno.env.get("APIFY_KEY")?.trim() ?? "";
  if (!key) return { ok: false, error: "Apify is not configured", status: 500 };
  const gathered = await gatherGoogleMaps({
    apifyKey: key,
    placeId: googlePlaceId ?? "",
    gatherGoogleImages: 0,
  });
  const error = typeof gathered.diag.error === "string" ? gathered.diag.error : null;
  const listed = googleReviewListFromScrape(gathered.reviews, error);
  if (!listed.ok) return { ok: false, error: "Google reviews could not be loaded", status: 502 };
  return { ok: true, list: listed.list };
}
