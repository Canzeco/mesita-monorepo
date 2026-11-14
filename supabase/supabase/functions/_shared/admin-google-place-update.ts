// Admin Update (MESITA-2737): refresh Google factuals — the Details step run
// by itself (MESITA-3844: Enrich's step 1 is this same body, through
// enricher-edgefunc-google-details). The one gallery
// (`photos`, MESITA-2794) takes Google's current hero only while it holds at
// most one photo: one photo means Create wrote it and Enrich never ran, so it
// is still Google's. A longer gallery is Enrich's and Update never touches it.
// Never writes Mesita editorial fields.

import { readOperatorFields } from "./operator-fields.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchGoogleBasics, type GoogleAddressPart, type GoogleBasics } from "./enrich-google-basics.ts";
import { activeFieldPins, readFieldPins, stripPinnedColumns } from "./enrich-corrections.ts";
import { capPresentation } from "./presentation-cap.ts";
import { mirrorPlacePhotos } from "./store-place-images.ts";
import { writePlace } from "./place-doc.ts";
import { googleTypesPrimaryFirst } from "./google-table-b.ts";
import { googlePlacesKeyOrNull } from "./google-places.ts";

const BUSINESS_STATES = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

/** Keys the Update path must never send to writePlace. */
export const GOOGLE_UPDATE_FORBIDDEN_COLUMNS = [
  "photos",
  // The Mesita name is the operator's / the name door's (MESITA-2828).
  "name",
  "description",
  "enriched_at",
  "embedding",
  "embedding_source_text",
  // Update writes google_source_types; the taxonomy trigger derives the
  // Google categories and the shown category from it (MESITA-2836), and the
  // profiles view the families (MESITA-2834). None of the four is patched.
  "google_types",
  "category",
  "category_label",
  "family_keys",
  // The Mesita Zone is the Description step's inference (MESITA-2937), not
  // Google's neighborhood: a Google refetch leaves it alone.
  "zone",
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
 * The Google Details step's patch — one body for Update and for Enrich's step 1
 * (MESITA-3844: Enrich's Render task fetches it through
 * enricher-edgefunc-google-details instead of mapping Google itself).
 * The gallery is never in it: `galleryTakesGoogleHero` decides that separately.
 * Google's own types land in google_source_types, primary first; the trigger
 * turns them into the Google categories (MESITA-2836) and the view into the
 * families (MESITA-2834), so a refetch refreshes all three through one column.
 * Google's five reviews are not in it either: the review list is the Reviews
 * step's (Apify, 100 newest), and Google's five would replace it.
 */
export function googleDetailsPatch(input: {
  basics: GoogleBasics;
  businessStatus: string | null;
  googlePrimaryType: string | null;
  googleTypes: string[];
  addressComponents?: GoogleAddressPart[];
  now: string;
}): Record<string, unknown> {
  const googleTypes = googleTypesPrimaryFirst(input.googlePrimaryType, input.googleTypes);
  const patch: Record<string, unknown> = {
    google_name: input.basics.google_name,
    google_found: true,
    price_level: input.basics.price_level,
    lat: input.basics.lat,
    lng: input.basics.lng,
    address: input.basics.address,
    google_address: {
      formattedAddress: input.basics.address,
      location: { latitude: input.basics.lat, longitude: input.basics.lng },
      addressComponents: input.addressComponents ?? [],
    },
    city: input.basics.city,
    timezone: input.basics.timezone,
    closes_at: input.basics.closes_at,
    hours: input.basics.hours,
    phone: input.basics.phone,
    pitch: cappedOrNull(input.basics.pitch),
    story: cappedOrNull(input.basics.story),
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

function cappedOrNull(text: string | null): string | null {
  const capped = capPresentation(text ?? "");
  return capped ? capped : null;
}

/**
 * The one write rule, Update's as much as Enrich's (MESITA-3844): an empty
 * value (null, blank, an empty list) never blanks a filled column, and a field
 * a person pinned (90 days, enrich-corrections.ts) is kept. Enrich applies the
 * same two halves in Render's commitPatch and enricher-edgefunc-write-place.
 */
export function googleWriteRule(
  patch: Record<string, unknown>,
  enrichmentSources: unknown,
  now = new Date(),
): { patch: Record<string, unknown>; pinned: string[] } {
  const filled: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    filled[key] = value;
  }
  const kept = stripPinnedColumns(filled, activeFieldPins(readFieldPins(enrichmentSources), now), now);
  return { patch: kept.update, pinned: kept.skipped };
}

export type GoogleDetailsStep =
  | { ok: false; status: number; error: string; code?: string }
  | {
    ok: true;
    patch: Record<string, unknown>;
    businessStatus: string | null;
    primaryType: string | null;
    /** Google's photo URLs, best-first, at most `maxPhotos`. */
    photoUrls: string[];
    /** Google's ISO country code ("MX"), for the Links step's search. */
    countryCode: string | null;
  };

/** Step 1, Details: one Place Details call mapped to the patch. Writes nothing. */
export async function runGoogleDetailsStep(
  googlePlaceId: string,
  key: string,
  opts: { maxPhotos: number; now?: string },
): Promise<GoogleDetailsStep> {
  const google = await fetchGoogleBasics(googlePlaceId, key, { maxPhotos: opts.maxPhotos });
  if (!google.ok) {
    return { ok: false, status: google.status, code: google.code, error: google.error };
  }
  const country = google.addressComponents.find((part) => part.types?.includes("country"));
  return {
    ok: true,
    patch: googleDetailsPatch({
      basics: google.basics,
      businessStatus: google.businessStatus,
      googlePrimaryType: google.primaryType,
      googleTypes: google.googleTypes,
      addressComponents: google.addressComponents,
      now: opts.now ?? new Date().toISOString(),
    }),
    businessStatus: google.businessStatus,
    primaryType: google.primaryType,
    photoUrls: google.basics.photos,
    countryCode: country?.shortText?.trim() || null,
  };
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

  const key = googlePlacesKeyOrNull(opts.env ?? Deno.env);
  if (!key) {
    return { ok: false, status: 503, code: "no_key", error: "Google Places is not configured." };
  }

  // Update needs one photo at most: Google's hero, for a gallery still Create's.
  const google = await runGoogleDetailsStep(googlePlaceId, key, { maxPhotos: 1, now });
  if (!google.ok) {
    return { ok: false, status: google.status, code: google.code, error: google.error };
  }

  // Mirror Google's hero only when the gallery will take it.
  // A gallery the place saved (MESITA-3513) is never replaced by Google's hero.
  const ownedGallery = readOperatorFields(profile.enrichment_sources).includes("photos");
  const hero = !ownedGallery && galleryTakesGoogleHero(profile.photos) ? google.photoUrls.slice(0, 1) : [];
  const mirrored = hero.length > 0
    ? await mirrorPlacePhotos(admin, opts.supabaseUrl, hero)
    : [];

  // The same write rule as Enrich (MESITA-3844): pins kept, empties dropped.
  const { patch, pinned } = googleWriteRule(google.patch, profile.enrichment_sources, new Date(now));
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
