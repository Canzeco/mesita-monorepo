// Admin Update (MESITA-2737): refresh Google factuals + google_photos only.
// Never writes mesita_photos, legacy photos, or Mesita editorial fields.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchGoogleBasics, type GoogleBasics } from "./enrich-google-basics.ts";
import { mirrorPlacePhotos } from "./store-place-images.ts";
import { writePlace } from "./place-doc.ts";

const BUSINESS_STATES = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

/** Keys the Update path must never send to writePlace. */
export const GOOGLE_UPDATE_FORBIDDEN_COLUMNS = [
  "photos",
  "mesita_photos",
  "mesita_name",
  "name",
  "description",
  "enriched_at",
  "embedding",
  "embedding_source_text",
  "name_embedding",
] as const;

export function assertGoogleUpdatePatchSafe(patch: Record<string, unknown>): void {
  for (const key of GOOGLE_UPDATE_FORBIDDEN_COLUMNS) {
    if (key in patch) {
      throw new Error(`google update patch must not include ${key}`);
    }
  }
}

/** Build the place_profiles patch from a Google basics fetch (before pins). */
export function googleBasicsToUpdatePatch(input: {
  basics: GoogleBasics;
  businessStatus: string | null;
  googlePhotos: string[];
  googlePrimaryType: string | null;
  googleTypes: string[];
  now: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    google_name: input.basics.google_name,
    category: input.basics.category,
    category_label: input.basics.category_label,
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
    google_photos: input.googlePhotos,
    google_primary_type: input.googlePrimaryType,
    google_types: input.googleTypes,
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
    googlePhotoCount: number;
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
    .select("google_place_id, enrichment_sources, mesita_photos, source_sync")
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

  const mirrored = await mirrorPlacePhotos(admin, opts.supabaseUrl, google.basics.photos);
  const googlePhotos = mirrored.map((row) => row.publicUrl);

  // d3a: Google Update is not blocked by enrichment correction pins.
  const patch = googleBasicsToUpdatePatch({
    basics: google.basics,
    businessStatus: google.businessStatus,
    googlePhotos,
    googlePrimaryType: google.primaryType,
    googleTypes: google.googleTypes,
    now,
  });
  const pinned: string[] = [];

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
    googlePhotoCount: googlePhotos.length,
    pinned,
    businessStatus: google.businessStatus,
  };
}
