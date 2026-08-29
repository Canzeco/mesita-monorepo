// Shared persist half of the create pipeline (formerly the
// enricher-agent-save-place-data EF — folded in-process per the caller
// doctrine: internal callers survive only as shared code; the HTTP hop no
// longer earned its cost once create-place.ts became the single call site).
//
// Takes the `place` JSON produced by fetchGoogleBasics and writes it as the
// real rows:
//   • places   — the profile (Google identity, geo, channels, signals, photos)
//   • projects — the owned Mesita entity (shared PK with the place), landing
//     status='active', listing_type from Verification Config
//     (verification_config.createPlacesAsVerified → 'partner', else 'web'),
//     and a caller-supplied content_status (the async create path passes
//     'generating').
//
// Idempotent on google_place_id (place_already_exists). Slug is made unique
// against the live catalog. Inserts are sequenced places→projects (shared id);
// a projects failure compensates by deleting the just-written place so we
// never leave an orphan profile. Media is NOT handled here.
//
// Ownership (project_members) is intentionally NOT created here — ownership
// only lands when admin-web-decide-verification approves a claim. Listing
// type 'partner' here is the consumer Mesita Partner badge only — it does
// not grant plan, ownership, or a promo strategy.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type PlacePatch, type ProjectRow, writePlace } from "./place-doc.ts";
import { ensureUniqueSlug, slugify } from "./place-slug.ts";
import { normalizeVerificationConfig } from "./verification-config.ts";

// The places-shaped profile from fetchGoogleBasics. Required spine:
// google_place_id + google_name (the same fields fetchGoogleBasics guarantees).
// `name` is accepted only as a legacy alias for the Google label — it is a
// GENERATED column on places, so no caller can meaningfully supply it.
export type PlacePayload = Record<string, unknown> & {
  google_place_id?: string;
  google_name?: string;
  /** @deprecated legacy alias for `google_name`. */
  name?: string;
};

export type SavedPlace = {
  project_id: string;
  place_id: string;
  slug: string;
  name: string;
  status: string;
};

export type SavePlaceOutcome =
  | { ok: true; saved: SavedPlace }
  | { ok: false; status: number; body: Record<string, unknown> };

const CONTENT_STATUSES = new Set(["queued", "generating", "ready", "failed"]);

export async function savePlaceData(
  admin: SupabaseClient,
  place: PlacePayload,
  contentStatus = "ready",
): Promise<SavePlaceOutcome> {
  const fail = (status: number, body: Record<string, unknown>): SavePlaceOutcome => ({
    ok: false,
    status,
    body: { ok: false, ...body },
  });

  const googlePlaceId = (place.google_place_id ?? "").toString().trim();
  // `places.name` is GENERATED (coalesce(mesita_name, google_name)), so callers
  // send the Google observation, not the display label — fetchGoogleBasics
  // deliberately omits `name` (MESITA-1011). Guarding on `name` here rejected
  // every create for 11 days; guard the key that is actually supplied, keeping
  // the legacy `name` alias working for any caller still sending it.
  const googleName = (place.google_name ?? place.name ?? "").toString().trim();
  if (!googlePlaceId) return fail(400, { error: "place.google_place_id is required" });
  if (!googleName) return fail(400, { error: "place.google_name is required" });
  // Slug + response label use the Mesita name (same string as google on create).
  const name = googleName;
  // decision: Pato (MESITA-468) — Maps URL is part of the native spine; create
  // must never persist a place without it (fetchGoogleBasics always supplies one).
  const mapsUrl = (place.google_maps_url ?? "").toString().trim();
  if (!mapsUrl) return fail(400, { error: "place.google_maps_url is required" });
  const status = CONTENT_STATUSES.has(contentStatus) ? contentStatus : "ready";

  // ── Idempotency: already onboarded? (read the joined view) ──
  const { data: existing } = await admin
    .from("profiles")
    .select("id, slug, name, status, listing_type")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (existing) {
    return fail(409, {
      code: "place_already_exists",
      error: "This place is already on Mesita. If you manage it, contact support to claim ownership.",
      existing,
    });
  }

  // ── Unique slug against the live catalog ──
  const slug = await ensureUniqueSlug(admin, slugify(name));

  // ── Verification Config: create as Mesita Partner? ──
  // decision: Pato (live, 2026-08-05) — admin Verification Config toggle
  // createPlacesAsVerified (verification_config jsonb, MESITA-1248 fold of
  // the old create_places_as_verified column). When on, new places land as
  // listing_type='partner' (consumer "Mesita Partner" badge) even without
  // phone OTP ownership proof. Default off → 'web' / "Not Verified". Does
  // not grant plan, ownership, or promo strategy (those stay on their own
  // paths).
  const { data: settingsRow } = await admin
    .from("app_config")
    .select("verification_config")
    .eq("id", 1)
    .maybeSingle();
  const listingType =
    normalizeVerificationConfig(
      (settingsRow as { verification_config?: unknown } | null)?.verification_config,
    ).createPlacesAsVerified
      ? "partner"
      : "web";

  // ── 1) places (profile). Strip caller-supplied id/timestamps so the DB owns
  // them; the category-label trigger fills category_label from category. ──
  // Names: `name` is GENERATED (coalesce(mesita_name, google_name)) — never
  // insert it. Create seeds BOTH: google_name is the cached Google observation
  // (Intaker refresh target) and mesita_name is the guest-facing Mesita label
  // (operator-editable; profile chrome never reads google_name directly).
  const {
    id: _dropId,
    created_at: _dropCreated,
    updated_at: _dropUpdated,
    name: _dropName,
    mesita_name: _dropMesitaName,
    ...placeRest
  } = place;
  const placeInsert = {
    ...placeRest,
    google_name: googleName,
    mesita_name: googleName,
  } as PlacePatch;
  const placeRes = await writePlace(admin, {
    table: "places",
    mode: "insert",
    patch: placeInsert,
    select: "id",
  });
  if (!placeRes.ok || !placeRes.row) {
    // Race guard: a concurrent create won the unique index — report as dup.
    if (placeRes.ok === false && placeRes.code === "23505" && /google_place_id/.test(placeRes.error)) {
      const after = await admin
        .from("profiles")
        .select("id, slug, name, status, listing_type")
        .eq("google_place_id", googlePlaceId)
        .maybeSingle();
      return fail(409, {
        code: "place_already_exists",
        error: "This place is already on Mesita. If you manage it, contact support to claim ownership.",
        existing: after.data ?? null,
      });
    }
    return fail(400, {
      error: `place_insert: ${placeRes.ok ? "no row" : placeRes.error}`,
      code: placeRes.ok ? null : placeRes.code ?? null,
    });
  }
  const placeRow = placeRes.row as { id: string };

  // ── 2) projects (entity, shared PK). content_status is caller-supplied. ──
  const projectRes = await writePlace(admin, {
    table: "projects",
    mode: "insert",
    id: placeRow.id,
    patch: {
      slug,
      status: "active",
      listing_type: listingType,
      content_status: status as ProjectRow["content_status"],
    },
    select: "id, slug, status",
  });
  if (!projectRes.ok || !projectRes.row) {
    // Compensate: drop the orphan place so a failed create leaves nothing.
    await writePlace(admin, { table: "places", mode: "delete", id: placeRow.id });
    if (
      projectRes.ok === false && projectRes.code === "23505" && /\bslug\b/.test(projectRes.error)
    ) {
      return fail(409, {
        code: "slug_already_taken",
        error: "A place with this URL slug already exists. Try again.",
      });
    }
    return fail(400, {
      error: `project_insert: ${projectRes.ok ? "no row" : projectRes.error}`,
      code: projectRes.ok ? null : projectRes.code ?? null,
    });
  }
  const projectRow = projectRes.row as { id: string; slug: string; status: string };

  return {
    ok: true,
    saved: {
      project_id: projectRow.id,
      place_id: placeRow.id,
      slug: projectRow.slug,
      name,
      status: projectRow.status,
    },
  };
}
