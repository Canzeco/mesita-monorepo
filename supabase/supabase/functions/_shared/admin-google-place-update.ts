// Admin Update (MESITA-2737): refresh Google factuals. Update never touches
// the gallery (MESITA-3931, Pato: "make update button to never update Google
// place image"): photos are Enrich's on a place with no owner, the owner's on
// an owned one. It fetches no Google photo and mirrors nothing.
// Never writes Mesita editorial fields.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchGoogleBasics, type GoogleBasics } from "./enrich-google-basics.ts";
import { writePlace } from "./place-doc.ts";
import { googleTypesPrimaryFirst } from "./google-table-b.ts";
import { googlePlacesKeyOrNull } from "./google-places.ts";
import { activeFieldPins, readFieldPins, stripPinnedColumns } from "./enrich-corrections.ts";

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

/**
 * Build the place_profiles patch from a Google basics fetch (before pins).
 * The gallery is never in it: Update writes no photos (MESITA-3931).
 * Nor is Google's five-review list: the review list is Enrich's and Update
 * Reviews' (Apify, 100 newest), and Google's five would replace it (MESITA-3844).
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
    whatsapp_url: input.basics.whatsapp_url,
    opentable_url: input.basics.opentable_url,
    uber_eats_url: input.basics.uber_eats_url,
    tripadvisor_url: input.basics.tripadvisor_url,
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

/**
 * Update's write rule (MESITA-3844), the same rule Enrich keeps in its own
 * backend: an empty value (null, blank, an empty list) never blanks a filled
 * column — a Google listing with no Instagram must not wipe the one Enrich
 * found — and a field a person pinned (enrich-corrections.ts, 90 days) is kept.
 */
export function keepFilledAndPinned(
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

/**
 * A Fast Update snapshot. Only a review count that is actually written
 * (present, finite, zero allowed). A missing count, a failed fetch, or a
 * pinned count never reaches this: those values are not in the patch.
 * Stars are stored when the patch has them.
 */
export function reviewSnapshotFromPatch(
  patch: Record<string, unknown>,
  googlePlaceId: string,
  observedAt: string,
): { googlePlaceId: string; observedAt: string; reviewCount: number; stars: number | null } | null {
  if (!("google_review_count" in patch)) return null;
  const count = patch.google_review_count;
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return null;
  const id = googlePlaceId.trim();
  if (!id || !observedAt) return null;
  const stars = patch.google_stars_overall;
  return {
    googlePlaceId: id,
    observedAt,
    reviewCount: Math.round(count),
    stars: typeof stars === "number" && Number.isFinite(stars) ? stars : null,
  };
}

/** True when this fetch is at least as new as the place's last Fast Update.
 *  An older request that finishes later must not overwrite the newer row. */
export function fastUpdateShouldWrite(
  storedAt: string | null | undefined,
  observedAt: string,
): boolean {
  if (!storedAt) return true;
  const stored = Date.parse(storedAt);
  const next = Date.parse(observedAt);
  if (!Number.isFinite(stored) || !Number.isFinite(next)) return true;
  return stored <= next;
}

function lastGoogleUpdateAt(sourceSync: unknown): string | null {
  if (!sourceSync || typeof sourceSync !== "object") return null;
  const at = (sourceSync as Record<string, unknown>).lastGoogleUpdateAt;
  return typeof at === "string" && at.trim() ? at : null;
}

export type GooglePlaceUpdateResult =
  | { ok: false; status: number; error: string; code?: string }
  | {
    ok: true;
    updatedAt: string;
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
    .select("google_place_id, enrichment_sources, source_sync")
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

  // No photos: Update never touches the gallery (MESITA-3931).
  const google = await fetchGoogleBasics(googlePlaceId, key, { maxPhotos: 0 });
  if (!google.ok) {
    return { ok: false, status: google.status, code: google.code, error: google.error };
  }

  const { patch, pinned } = keepFilledAndPinned(
    googleBasicsToUpdatePatch({
      basics: google.basics,
      businessStatus: google.businessStatus,
      googlePrimaryType: google.primaryType,
      googleTypes: google.googleTypes,
      now,
    }),
    profile.enrichment_sources,
    new Date(now),
  );

  const priorSync = profile.source_sync && typeof profile.source_sync === "object"
    ? profile.source_sync as Record<string, unknown>
    : {};
  patch.source_sync = {
    ...priorSync,
    lastGoogleUpdateAt: now,
    lastGoogleUpdateVia: "admin-web-update-place-google",
  };

  const snapshot = reviewSnapshotFromPatch(patch, googlePlaceId, now);
  // Re-read the stamp so a newer Fast Update that landed during the Google
  // call keeps the place row. The older fetch still records its snapshot.
  // The table name stays a variable: this is a read, and writePlace remains
  // the only place-profile write in this file.
  const profiles = "place_profiles";
  const { data: fresh, error: freshErr } = await admin
    .from(profiles)
    .select("source_sync")
    .eq("id", placeId)
    .maybeSingle();
  if (freshErr) return { ok: false, status: 500, error: freshErr.message };
  const writeRow = fastUpdateShouldWrite(lastGoogleUpdateAt(fresh?.source_sync), now);
  if (writeRow) {
    const written = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch,
    });
    if (!written.ok) return { ok: false, status: 500, error: written.error };
  }

  if (snapshot) {
    const { error: snapErr } = await admin.from("google_review_observations").upsert({
      place_id: placeId,
      google_place_id: snapshot.googlePlaceId,
      observed_at: snapshot.observedAt,
      review_count: snapshot.reviewCount,
      stars: snapshot.stars,
    }, { onConflict: "place_id,observed_at", ignoreDuplicates: true });
    if (snapErr) return { ok: false, status: 500, error: snapErr.message };
  }

  return {
    ok: true,
    updatedAt: now,
    pinned,
    businessStatus: google.businessStatus,
  };
}
