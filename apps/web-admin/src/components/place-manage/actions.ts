"use server";

import type { CrenupBlock } from "@/app/(app)/manage-multiple/actions";
import type { MenuNutrition } from "@/lib/nutrition";
import { efInvoke } from "@/lib/supabase-ef";

// ════════════════════════════════════════════════════════════════════════
// Single Place's server actions. Every call is an `admin-web-*` Edge
// Function, super-admin gated server-side: the EF name is the ACL, and this
// console's only reader is a super-admin.
//
// The place row and the profile save bar used to ride the business console's
// own doors (get-overview, update-place, get-atlas-fields), because Single
// Place rendered that console's place surface (MESITA-2086). The business
// console is deleted in the MVP First Stage cut, so those two EFs were
// renamed to admin-web-* and the atlas read moved to its existing admin twin
// (MESITA-2090).
// ════════════════════════════════════════════════════════════════════════

// `code` is the EF's machine-readable failure (efInvoke already keeps it off
// `body.code`). It is optional because most call sites only ever show a
// sentence — but a call site that must BRANCH on a specific refusal needs
// something other than the prose to branch on, and re-matching the prose is
// how a copy edit in Deno silently breaks a screen in Next.
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string | null };

// ── Place load ───────────────────────────────────────────────────────────

// One menu / catalog entry under products.menu (and legacy menus).
export type AdminMenuItem = {
  name?: string | null;
  url?: string | null;
  items?: unknown[] | null;
  nutrition?: MenuNutrition | null;
};

// The full place row, loaded for a super-admin via admin-web-get-overview.
// Typed loosely — the editor only touches the known fields below.
export type AdminPlace = {
  id: string;
  slug: string | null;
  /**
   * Resolved display label. GENERATED in Postgres as
   * coalesce(mesita_name, google_name) — read-only, never send it in a patch.
   */
  name: string;
  /** Operator override. Null/empty ⇒ the place follows google_name. Editable. */
  mesita_name?: string | null;
  /**
   * Cached Google Places displayName. Not an identity spine (google_place_id
   * is) — it changes whenever the Google listing does. Enricher-only write.
   */
  google_name?: string | null;
  category: string | null;
  category_label: string | null;
  /** Families: Enricher-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  state: string | null;
  currency: string | null;
  price_level: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  city: string | null;
  timezone: string | null;
  description: string | null;
  phone: string | null;
  hours: Record<string, { open: string; close: string }[]> | null;
  photos: string[] | null;
  tags: string[] | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  whatsapp_url: string | null;
  google_maps_url: string | null;
  opentable_url: string | null;
  resy_url: string | null;
  uber_eats_url: string | null;
  menu_pdf_url: string | null;
  menu_pdf_name: string | null;
  // Generic products payload — MENUS ONLY. Order + reservation routing left
  // this blob for typed columns in MESITA-1208: they are separate decisions
  // and must not share one read-modify-written cell with the menu.
  products?: { menu?: AdminMenuItem[] | null } | null;
  // How the reservation rail reaches the place: phone · whatsapp · instagram ·
  // web · none. The Reservationist only DIALS phone.
  reservation_channel?: string | null;
  reservation_target?: string | null;
  // Legacy parallel array; prefer products.menu when present.
  menus?: AdminMenuItem[] | null;
  // Reviews tab (read-only; carried on the overview place payload).
  google_stars_overall: number | null;
  google_review_count: number | null;
  google_reviews: unknown;
  instagram_followers_count: number | null;
  facebook_followers: number | null;
  /** The source resolved. False is not found, including a technical miss. */
  google_found?: boolean;
  instagram_found?: boolean;
  facebook_found?: boolean;
  created_at: string | null;
  updated_at: string | null;
  // Stamped by the Enricher's final write — THE Enriched fact (MESITA-2154;
  // Create never stamps it). Also lets the Meta box attribute updated_at to
  // the AI (≈ same instant) vs a human edit (later).
  enriched_at: string | null;
  // On-Update embeddings (MESITA-720) — human blurb + vector; super-admin
  // overview only. Tags are never part of the source text.
  embedding?: string | number[] | null;
  embedding_source_hash?: string | null;
  embedding_source_text?: string | null;
  name_embedding?: string | number[] | null;
  name_embedding_hash?: string | null;
  // ── State, super-admin overview only (MESITA-1186) ───────────────────────
  // Computed by admin-web-get-overview off _shared/place-state.ts — the
  // same helpers admin-web-search-places uses for the Single Place table, so
  // the box and the table can never disagree. Absent (undefined) means the
  // payload predates them; the box renders "?" rather than a false "no".
  /** google_place_id present — the identity spine every enrichment run needs. */
  seeded?: boolean;
  /** places.state = active — a guest can reach the place at all. */
  listed?: boolean;
  /** Derived has-demand for filters. State chip is request_count. */
  requested?: boolean;
  /** THE Enriched fact (MESITA-2154): an Enrich run completed —
   *  `enriched_at` set. Never the Crenup high-water, never content_state. */
  enriched?: boolean;
  /** Guest request count — the Requested State fact, 0…n. */
  request_count?: number;
  /** Operating: Google's businessStatus, verbatim (MESITA-1239). */
  business_state?: string | null;
  business_state_at?: string | null;
  /** CRENUP: how far the EIGHT-step ENRICH queue got, 0-8 (0 = seeded).
   *  Absent on a payload that
   *  predates it; the box renders "?" rather than a false 0. */
  enrich_crenup?: number;
  /** The ladder's length, from the server. */
  enrich_crenup_total?: number;
  /** Function names indexed BY FUNCTION NUMBER — labels[0] = the Created floor. */
  enrich_crenup_labels?: string[];
  /** Why the queue stopped where it did. Absent on an older payload. */
  enrich_crenup_blocked?: CrenupBlock | null;
  /** Per Enrich subfunction (1–8). Overview payload only. */
  enrich_functions?: Record<string, {
    state: "pending" | "completed" | "failed";
    at: string | null;
    detail: string | null;
  }> | null;
  /** Enricher lifecycle on the place row. Overview already carries this. */
  content_state?: string | null;
  /** Google's own id. Admin payload only — never in PLACE_PUBLIC_COLUMNS. */
  google_place_id?: string | null;
  [k: string]: unknown;
};
/** The place PLUS whether this caller is a super-admin. admin-web-get-overview
 *  is super-admin only, so a 200 always carries `isSuperAdmin: true`. */
export async function getPlaceAndRole(
  placeId: string,
): Promise<Result<{ place: AdminPlace; isSuperAdmin: boolean; profile: ProfileRead }>> {
  const r = await efInvoke<{
    active: { place: AdminPlace } | null;
    isSuperAdmin?: boolean;
    profile?: unknown;
  }>("admin-web-get-overview", { placeId });
  if (!r.ok) return { ok: false, error: r.error };
  const place = r.data.active?.place ?? null;
  if (!place || place.id !== placeId) {
    return { ok: false, error: "Place not found or not loadable." };
  }
  const profile = readProfile(r.data.profile);
  if (!profile) {
    return { ok: false, error: "Profile read did not resolve family and category." };
  }
  return {
    ok: true,
    data: { place, isSuperAdmin: r.data.isSuperAdmin === true, profile },
  };
}

// ── Place: write place fields ────────────────────────────────────────────

export async function updatePlace(
  patch: Record<string, unknown> & { id: string },
): Promise<
  Result<{
    place: AdminPlace;
    family: ResolvedFamily | null;
    familyStored: ResolvedFamily | null;
  }>
> {
  const r = await efInvoke<{
    place: AdminPlace;
    family?: unknown;
    familyStored?: unknown;
  }>("admin-web-update-place", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      place: r.data.place,
      family: readResolvedFamily(r.data.family),
      familyStored: readResolvedFamily(r.data.familyStored),
    },
  };
}

export type ReviewsReloadSource = "google" | "google_reviews" | "instagram" | "facebook";

export async function reloadPlaceReviews(
  placeId: string,
  source: ReviewsReloadSource,
): Promise<
  Result<{
    source: ReviewsReloadSource;
    google_stars_overall: number | null;
    google_review_count: number | null;
    instagram_followers_count: number | null;
    facebook_followers: number | null;
    google_found: boolean;
    instagram_found: boolean;
    facebook_found: boolean;
    google_reviews?: unknown;
  }>
> {
  const r = await efInvoke<{
    source: ReviewsReloadSource;
    google_stars_overall: number | null;
    google_review_count: number | null;
    instagram_followers_count: number | null;
    facebook_followers: number | null;
    google_found: boolean;
    instagram_found: boolean;
    facebook_found: boolean;
    google_reviews?: unknown;
  }>("admin-web-reload-place-reviews", { placeId, source });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  return {
    ok: true,
    data: {
      source: r.data.source,
      google_stars_overall: r.data.google_stars_overall,
      google_review_count: r.data.google_review_count,
      instagram_followers_count: r.data.instagram_followers_count,
      facebook_followers: r.data.facebook_followers,
      google_found: r.data.google_found === true,
      instagram_found: r.data.instagram_found === true,
      facebook_found: r.data.facebook_found === true,
      ...(r.data.source === "google_reviews" ? { google_reviews: r.data.google_reviews ?? [] } : {}),
    },
  };
}

/** List or unlist the place on Mesita — the ONLY write path to
 *  places.state, which is what the consumer RLS policy
 *  places_select_public_visible gates every guest read on. Unlisting removes
 *  the place from browse, search, the swipe deck and any shared link at once.
 *  Its own admin door (admin-web-set-place-listed). */
export async function setPlaceListed(
  placeId: string,
  listed: boolean,
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{ place: AdminPlace; listed?: boolean }>(
    "admin-web-set-place-listed",
    {
      placeId,
      listed,
    },
  );
  if (!r.ok) return { ok: false, error: r.error };
  // The EF returns `listed` beside `place`. Stamp it onto the row so
  // PlaceEditShell's merge cannot keep the overview's stale `listed: true`
  // after Unlist wrote `paused`.
  return {
    ok: true,
    data: { ...r.data.place, listed: r.data.listed ?? listed },
  };
}

/** Operator Active (State box). Writes business_state. Active off also
 *  unlists — guests disappear in the same apply. Active on does not list. */
export async function setPlaceActive(
  placeId: string,
  active: boolean,
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{
    place: AdminPlace;
    active?: boolean;
    listed?: boolean;
    business_state?: string | null;
    state?: string | null;
  }>("admin-web-set-place-active", { placeId, active });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      ...r.data.place,
      listed: r.data.listed ?? r.data.place.listed,
      business_state: r.data.business_state ?? r.data.place.business_state,
      // Stamp state so listedFromState sees paused after Active off, even if
      // an older place payload omitted it.
      state: r.data.state ?? r.data.place.state,
    },
  };
}

// ── Profile vocabulary ───────────────────────────────────────────────────
// Arrives on admin-web-get-overview, the one profile read. Family and
// Category are already resolved there. The editor does not fetch them.

export type PlaceTagOption = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  sort_order: number;
};

export type PlaceTagFacet = {
  slug: string;
  emoji: string;
  label_es: string;
  label_en: string;
};

export type PlaceFieldLimits = {
  placeNameMax: number;
  descriptionMax: number;
  tagsPerPlaceMax: number;
  photosMax: number;
};

export type ResolvedFamily = {
  text: string;
  inferred: boolean;
};

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
  /** 1–2 place family parents (multi-parent law). */
  family_keys?: string[];
  /** Membership already joined by the profile read. */
  family_display: string;
};

/** Everything the profile editor needs besides the place row. One read. */
export type ProfileRead = {
  /** Family for the row as stored. */
  family: ResolvedFamily;
  /** Family while the draft category is undefined: stored family_keys. */
  familyStored: ResolvedFamily;
  categories: PlaceCategoryOption[];
  tags: PlaceTagOption[];
  facets: PlaceTagFacet[];
  fieldLimits: PlaceFieldLimits;
};

const DEFAULT_PLACE_FIELD_LIMITS: PlaceFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 1000,
  tagsPerPlaceMax: 20,
  photosMax: 10,
};

function readPlaceFieldLimits(
  fieldLimits?: Record<string, { max: number }>,
): PlaceFieldLimits {
  return {
    placeNameMax: fieldLimits?.placeName?.max ?? DEFAULT_PLACE_FIELD_LIMITS.placeNameMax,
    descriptionMax:
      fieldLimits?.description?.max ?? DEFAULT_PLACE_FIELD_LIMITS.descriptionMax,
    tagsPerPlaceMax:
      fieldLimits?.tagsPerPlace?.max ?? DEFAULT_PLACE_FIELD_LIMITS.tagsPerPlaceMax,
    photosMax: fieldLimits?.photos?.max ?? DEFAULT_PLACE_FIELD_LIMITS.photosMax,
  };
}

function readResolvedFamily(value: unknown): ResolvedFamily | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { text?: unknown; inferred?: unknown };
  if (typeof row.text !== "string" || row.text.length === 0) return null;
  return { text: row.text, inferred: row.inferred === true };
}

function readProfile(value: unknown): ProfileRead | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    family?: unknown;
    familyStored?: unknown;
    categories?: unknown;
    tags?: unknown;
    facets?: unknown;
    fieldLimits?: Record<string, { max: number }>;
  };
  const family = readResolvedFamily(row.family);
  const familyStored = readResolvedFamily(row.familyStored);
  if (!family || !familyStored) return null;
  if (!Array.isArray(row.categories) || row.categories.length === 0) return null;
  if (!Array.isArray(row.tags) || !Array.isArray(row.facets)) return null;
  const categories: PlaceCategoryOption[] = [];
  for (const item of row.categories) {
    if (!item || typeof item !== "object") return null;
    const c = item as PlaceCategoryOption;
    if (
      typeof c.slug !== "string" ||
      typeof c.label !== "string" ||
      typeof c.section !== "string" ||
      typeof c.family_display !== "string"
    ) {
      return null;
    }
    categories.push(c);
  }
  return {
    family,
    familyStored,
    categories,
    tags: row.tags as PlaceTagOption[],
    facets: row.facets as PlaceTagFacet[],
    fieldLimits: readPlaceFieldLimits(row.fieldLimits),
  };
}

// ── Per-place Enricher inspector (admin-only) ────────────────────────────
// The place's enrichment state, for the Admin tab. Super-admin gated EF.

export type PlaceEnrichmentState = {
  content_state: string | null;
  stage: string | null;
  stage_state: string | null;
  error: string | null;
  last_enriched_at: string | null;
  updated_at: string | null;
  /** The SERP Summary from the last run — the Scout's soft editorial read.
   *  Soft context only: never a source of facts, ratings or prices. */
  serp_summary: string | null;
};

type PlaceEnrichment = {
  state: PlaceEnrichmentState | null;
};

export async function getPlaceEnrichment(
  placeId: string,
): Promise<Result<PlaceEnrichment>> {
  const r = await efInvoke<PlaceEnrichment>(
    "admin-web-get-place-enrichment",
    // Wire key stays `projectId` — this EF's MESITA-26 alias base.
    { projectId: placeId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: { state: r.data.state ?? null },
  };
}
