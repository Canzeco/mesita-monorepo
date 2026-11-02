"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ════════════════════════════════════════════════════════════════════════
// The profile editor's two server actions (MESITA-3103). The editor moved
// here from web-admin's Single Place; it reads and saves through the
// Business app's own doors: business-web-get-place and business-web-update-
// place. Both ask the server who the caller is to the place (a live owner
// row, or a super-admin) before anything else: the EF name is the ACL, and
// the place gate is place-access.
// ════════════════════════════════════════════════════════════════════════

/** Why Enrich stopped where it did (staff-only payload). */
type CrenupBlock = { at: number; reason?: string | null } | null;
/** A menu item's nutrition, as Enrich stores it. */
type MenuNutrition = Record<string, unknown>;

export type PlaceRole = "owner" | "superadmin";

type Result<T> =
  | { ok: true; data: T }
  | {
    ok: false;
    error: string;
    code?: string | null;
  };

// ── Place load ───────────────────────────────────────────────────────────

// One menu / catalog entry under products.menu (and legacy menus).
export type AdminMenuItem = {
  name?: string | null;
  url?: string | null;
  items?: unknown[] | null;
  nutrition?: MenuNutrition | null;
};

// The full place row, from business-web-get-place (the same read as admin).
// Typed loosely — the editor only touches the known fields below.
export type AdminPlace = {
  id: string;
  slug: string | null;
  /**
   * The one Mesita name (MESITA-2828): stored, editable. Blank on save ⇒ the
   * place follows google_name again.
   */
  name: string;
  /**
   * Google's own label. Not an identity spine (google_place_id is) — it
   * changes whenever the Google listing does. Google-only write; Search's
   * alias of the Mesita name, never shown to a guest.
   */
  google_name?: string | null;
  category: string | null;
  category_label: string | null;
  /** Google categories: Google's own types, primary first (MESITA-2836); Basics shows the first. */
  google_types?: unknown;
  /** Mesita Families: 1–5 inferred by the Description step's model (MESITA-2891),
   *  or set by hand on Basics (MESITA-2893); Undefined when none. */
  family_keys?: string[] | null;
  state: string | null;
  currency: string | null;
  price_level: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  google_address: unknown;
  source_sync: unknown;
  city: string | null;
  timezone: string | null;
  description: string | null;
  phone: string | null;
  hours: Record<string, { open: string; close: string }[]> | null;
  photos: string[] | null;
  reservations_enabled?: boolean;
  prepay_enabled?: boolean;
  payments_enabled?: boolean;
  /** Vision text keyed by the gallery URL. Absent until a Full run describes it. */
  photo_analysis?: Record<string, string> | null;
  tags: string[] | null;
  /** Google atmosphere slugs. The Profile tags box. */
  google_tags?: string[] | null;
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
  embedding_source_text?: string | null;
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
  /** Premier (MESITA-2995; MESITA-2925, was Boost — MESITA-2789): the paid tier,
   *  `places.boost_tier`, 0 none · 1 2X · 2 5X. Derived from the
   *  paid period covering now; never set here. Profile States shows it (MESITA-2795). */
  boost_tier?: number;
  /** Guest request count — still on the row for enrich threshold; not in admin UI. */
  request_count?: number;
  /** Basics fields the operator owns (MESITA-2829, MESITA-2893): name ·
   *  description · tags · family_keys. Enrich skips them until the row's
   *  Reset clears the mark. */
  operator_fields?: string[];
  /** Unique members who viewed / saved (admin-web-get-overview). */
  profile_stats?: { viewed?: number; saved?: number };
  /** Votes required before Enrich starts. Settings `enrichRequestThreshold`. */
  request_threshold?: number;
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
/** The place, the caller's role on it, and the profile vocabulary. */
export async function getPlaceAndRole(
  placeId: string,
): Promise<Result<{
  place: AdminPlace;
  isSuperAdmin: boolean;
  role: PlaceRole;
  profile: ProfileRead;
  manager: { method: string; expires_at: string } | null;
}>> {
  const r = await efInvoke<{
    place: AdminPlace | null;
    role?: PlaceRole;
    profile?: unknown;
    manager?: { method: string; expires_at: string } | null;
  }>("business-web-get-place", { place_id: placeId });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  const place = r.data.place ?? null;
  if (!place || place.id !== placeId) {
    return { ok: false, error: "Place not found or not loadable." };
  }
  const profile = readProfile(r.data.profile);
  if (!profile) {
    return { ok: false, error: "Profile read did not resolve family and category." };
  }
  return {
    ok: true,
    data: {
      place,
      isSuperAdmin: r.data.role === "superadmin",
      role: r.data.role === "superadmin" ? "superadmin" : "owner",
      profile,
      manager: r.data.manager ?? null,
    },
  };
}

// ── Place: write place fields ────────────────────────────────────────────

export async function updatePlace(
  patch: Record<string, unknown> & { id: string },
): Promise<
  Result<{
    place: AdminPlace;
    familyStored: ResolvedFamily | null;
  }>
> {
  const r = await efInvoke<{
    place: AdminPlace;
    familyStored?: unknown;
  }>("business-web-update-place", patch);
  if (!r.ok) {
    return {
      ok: false,
      error: r.error,
      code: r.code,
    };
  }
  return {
    ok: true,
    data: {
      place: r.data.place,
      familyStored: readResolvedFamily(r.data.familyStored),
    },
  };
}

// ── Profile vocabulary ───────────────────────────────────────────────────
// Arrives on business-web-get-place, the one profile read. Family and
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
  /** Mesita families per place (MESITA-2893); the trigger refuses a sixth. */
  familiesPerPlaceMax: number;
  photosMax: number;
};

/** One of the thirty-seven Mesita Families the Basics editor offers (MESITA-2893). */
export type PlaceFamilyOption = {
  slug: string;
  label: string;
  emoji: string;
  sortOrder: number;
};

export type ResolvedFamily = {
  text: string;
};

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
};

/** Everything the profile editor needs besides the place row. One read. */
export type ProfileRead = {
  /** Mesita Families: the stored 1–5, inferred by the Description step (MESITA-2891). */
  familyStored: ResolvedFamily;
  /** The thirty-seven the operator may pick from, in catalog (day-arc) order (MESITA-2893). */
  families: PlaceFamilyOption[];
  categories: PlaceCategoryOption[];
  tags: PlaceTagOption[];
  facets: PlaceTagFacet[];
  fieldLimits: PlaceFieldLimits;
};

const DEFAULT_PLACE_FIELD_LIMITS: PlaceFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 500,
  tagsPerPlaceMax: 20,
  familiesPerPlaceMax: 7,
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
    familiesPerPlaceMax:
      fieldLimits?.familiesPerPlace?.max ?? DEFAULT_PLACE_FIELD_LIMITS.familiesPerPlaceMax,
    photosMax: fieldLimits?.photos?.max ?? DEFAULT_PLACE_FIELD_LIMITS.photosMax,
  };
}

function readResolvedFamily(value: unknown): ResolvedFamily | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { text?: unknown };
  if (typeof row.text !== "string" || row.text.length === 0) return null;
  return { text: row.text };
}

function readProfile(value: unknown): ProfileRead | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    familyStored?: unknown;
    families?: unknown;
    categories?: unknown;
    tags?: unknown;
    facets?: unknown;
    fieldLimits?: Record<string, { max: number }>;
  };
  const familyStored = readResolvedFamily(row.familyStored);
  if (!familyStored) return null;
  if (!Array.isArray(row.categories) || row.categories.length === 0) return null;
  if (!Array.isArray(row.tags) || !Array.isArray(row.facets)) return null;
  const categories: PlaceCategoryOption[] = [];
  for (const item of row.categories) {
    if (!item || typeof item !== "object") return null;
    const c = item as PlaceCategoryOption;
    if (
      typeof c.slug !== "string" ||
      typeof c.label !== "string" ||
      typeof c.section !== "string"
    ) {
      return null;
    }
    categories.push(c);
  }
  // The family vocabulary (MESITA-2893): a payload without it still paints;
  // the editor then offers nothing to add.
  const families: PlaceFamilyOption[] = Array.isArray(row.families)
    ? row.families.filter(
      (f): f is PlaceFamilyOption =>
        !!f && typeof f === "object" &&
        typeof (f as PlaceFamilyOption).slug === "string" &&
        typeof (f as PlaceFamilyOption).label === "string",
    )
    : [];
  return {
    familyStored,
    families,
    categories,
    tags: row.tags as PlaceTagOption[],
    facets: row.facets as PlaceTagFacet[],
    fieldLimits: readPlaceFieldLimits(row.fieldLimits),
  };
}
