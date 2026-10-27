// Admin Update (MESITA-2737): refresh Google factuals. The one gallery
// (`photos`, MESITA-2794) takes Google's current hero only while it holds at
// most one photo: one photo means Create wrote it and Enrich never ran, so it
// is still Google's. A longer gallery is Enrich's and Update never touches it.
// Never writes Mesita editorial fields.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchGoogleBasics, type GoogleBasics } from "./enrich-google-basics.ts";
import { mirrorPlacePhotos } from "./store-place-images.ts";
import { writePlace } from "./place-doc.ts";
import { googleTypesPrimaryFirst } from "./google-table-b.ts";

const BUSINESS_STATES = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

/** Keys the Update path must never send to writePlace. */
export const GOOGLE_UPDATE_FORBIDDEN_COLUMNS = [
  "photos",
  "mesita_name",
  "name",
  "description",
  "enriched_at",
  "embedding",
  "embedding_source_text",
  "name_embedding",
  // Update writes google_source_types; the taxonomy trigger derives the
  // Google categories and the shown category from it (MESITA-2836), and the
  // profiles view the families (MESITA-2834). None of the four is patched.
  "google_types",
  "category",
  "category_label",
  "family_keys",
] as const;

export function assertGoogleUpdatePatchSafe(patch: Record<string, unknown>): void {
  for (const key of GOOGLE_UPDATE_FORBIDDEN_COLUMNS) {
    if (key in patch) {
      throw new Error(`google update patch must not include ${key}`);
    }
  }
}

/** Update may rewrite the gallery only while it holds at most one photo. */
export function galleryTakesGoogleHero(photos: unknown): boolean {
  if (!Array.isArray(photos)) return true;
  return photos.filter((url) => typeof url === "string" && url.trim() !== "").length <= 1;
}

/**
 * Build the place_profiles patch from a Google basics fetch (before pins).
 * The gallery is never in it: `galleryTakesGoogleHero` decides that separately.
 * Google's own types land in google_source_types, primary first; the trigger
 * turns them into the Google categories (MESITA-2836) and the view into the
 * families (MESITA-2834), so a refetch refreshes all three through one column.
 */
export function googleBasicsToUpdatePatch(input: {
  basics: GoogleBasics;
  businessStatus: string | null;
  googlePrimaryType: string | null;
  googleTypes: string[];
  now: string;
}): Record<string, unknown> {
  const googleTypes = googleTypesPrimaryFirst(input.googlePrimaryType, input.googleTypes);
  const patch: Record<string, unknown> = {
    google_name: input.basics.google_name,
    price_level: input.basics.price_level,
    lat: input.basics.lat,
    lng: input.basics.lng,
    address: input.basics.address,
    zone: input.basics.zone,
    city: input.basics.city,
    timezone: input.basics.timezone,
    closes_at: input.basics.closes_at,
    hours: input.basics.hours,
    phone: input.basics.phone,
    pitch: input.basics.pitch,
    story: input.basics.story,
    website_url: input.basics.website_url,
    instagram_url: input.basics.instagram_url,
    facebook_url: input.basics.facebook_url,
    x_url: input.basics.x_url,
    threads_url: input.basics.threads_url,
    reddit_url: input.basics.reddit_url,
    whatsapp_url: input.basics.whatsapp_url,
    opentable_url: input.basics.opentable_url,
    resy_url: input.basics.resy_url,
    uber_eats_url: input.basics.uber_eats_url,
    didi_food_url: input.basics.didi_food_url,
    google_maps_url: input.basics.google_maps_url,
    google_stars_overall: input.basics.google_stars_overall,
    google_review_count: input.basics.google_review_count,
    google_reviews: input.basics.google_reviews,
    google_tags: input.basics.google_tags,
    google_source_types: googleTypes,
  };
  const status = (input.businessStatus ?? "").trim().toUpperCase();
  if (BUSINESS_STATES.has(status)) {
    patch.business_state = status;
    patch.business_state_at = input.now;
  }
  assertGoogleUpdatePatchSafe(patch);
  return patch;
}

function googleKey(env: { get(name: string): string | undefined }): string {
  return (env.get("GMP_KEY") ?? env.get("SUPA_GMP_KEY") ?? "").trim();
}

export type GooglePlaceUpdateResult =
  | { ok: false; status: number; error: string; code?: string }
  | {
    ok: true;
    updatedAt: string;
    heroRefreshed: boolean;
    pinned: string[];
    businessStatus: string | null;
  };

export async function runGooglePlaceUpdate(
  admin: SupabaseClient,
  placeId: string,
  opts: {
    supabaseUrl: string;
    env?: { get(name: string): string | undefined };
    now?: string;
  },
): Promise<GooglePlaceUpdateResult> {
  const now = opts.now ?? new Date().toISOString();

  const { data: profile, error: profileErr } = await admin
    .from("place_profiles")
    .select("google_place_id, enrichment_sources, photos, source_sync")
    .eq("id", placeId)
    .maybeSingle();
  if (profileErr) return { ok: false, status: 500, error: profileErr.message };
  if (!profile) return { ok: false, status: 404, error: "Place not found" };

  const googlePlaceId = typeof profile.google_place_id === "string"
    ? profile.google_place_id.trim()
    : "";
  if (!googlePlaceId) {
    return { ok: false, status: 400, code: "no_google_id", error: "This place has no Google place id" };
  }

  const { data: placeRow, error: placeErr } = await admin
    .from("places")
    .select("content_state")
    .eq("id", placeId)
    .maybeSingle();
  if (placeErr) return { ok: false, status: 500, error: placeErr.message };
  if (placeRow?.content_state === "generating") {
    return {
      ok: false,
      status: 409,
      code: "enriching",
      error: "Cannot update Google data while enrichment is in flight.",
    };
  }

  const key = googleKey(opts.env ?? Deno.env);
  if (!key) {
    return { ok: false, status: 503, code: "no_key", error: "Google Places is not configured." };
  }

  const google = await fetchGoogleBasics(googlePlaceId, key);
  if (!google.ok) {
    return { ok: false, status: google.status, code: google.code, error: google.error };
  }

  // Mirror Google's hero only when the gallery will take it.
  const hero = galleryTakesGoogleHero(profile.photos) ? google.basics.photos.slice(0, 1) : [];
  const mirrored = hero.length > 0
    ? await mirrorPlacePhotos(admin, opts.supabaseUrl, hero)
    : [];

  // d3a: Google Update is not blocked by enrichment correction pins.
  const patch = googleBasicsToUpdatePatch({
    basics: google.basics,
    businessStatus: google.businessStatus,
    googlePrimaryType: google.primaryType,
    googleTypes: google.googleTypes,
    now,
  });
  const pinned: string[] = [];
  if (mirrored.length > 0) patch.photos = [mirrored[0].publicUrl];

  const priorSync = profile.source_sync && typeof profile.source_sync === "object"
    ? profile.source_sync as Record<string, unknown>
    : {};
  patch.source_sync = {
    ...priorSync,
    lastGoogleUpdateAt: now,
    lastGoogleUpdateVia: "admin-web-update-place-google",
  };

  const written = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch,
  });
  if (!written.ok) return { ok: false, status: 500, error: written.error };

  return {
    ok: true,
    updatedAt: now,
    heroRefreshed: mirrored.length > 0,
    pinned,
    businessStatus: google.businessStatus,
  };
}
