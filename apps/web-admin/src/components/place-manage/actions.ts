"use server";

import type { CrenupBlock } from "@/app/(app)/manage-multiple/actions";
import type { MenuNutrition } from "@/lib/nutrition";
import type { ReviewFoundFlags } from "@/lib/review-found";
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

// The full place row, loaded for a super-admin via admin-web-get-overview.
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
    familyStored: ResolvedFamily | null;
  }>
> {
  const r = await efInvoke<{
    place: AdminPlace;
    familyStored?: unknown;
  }>("admin-web-update-place", patch);
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

export type ReviewsReloadSource = "sync" | "google" | "google_reviews" | "instagram" | "facebook";

type ReviewsReloadPayload = {
  source: ReviewsReloadSource;
  google_stars_overall: number | null;
  google_review_count: number | null;
  instagram_followers_count: number | null;
  facebook_followers: number | null;
  google_reviews?: unknown;
  lastSyncedAt?: string | null;
  source_sync?: unknown;
  sources?: { source: string; status: string; error: string | null }[];
} & Partial<ReviewFoundFlags>;

export async function reloadPlaceReviews(
  placeId: string,
  source: ReviewsReloadSource,
): Promise<Result<ReviewsReloadPayload>> {
  const r = await efInvoke<ReviewsReloadPayload>("admin-web-reload-place-reviews", { placeId, source });
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  return {
    ok: true,
    data: {
      source: r.data.source,
      google_stars_overall: r.data.google_stars_overall,
      google_review_count: r.data.google_review_count,
      instagram_followers_count: r.data.instagram_followers_count,
      facebook_followers: r.data.facebook_followers,
      ...explicitFound(r.data),
      ...(r.data.google_reviews !== undefined ? { google_reviews: r.data.google_reviews ?? [] } : {}),
      lastSyncedAt: r.data.lastSyncedAt ?? null,
      source_sync: r.data.source_sync,
      sources: r.data.sources,
    },
  };
}

/** A sync response omits found flags. Only a real boolean may override them. */
function explicitFound(data: {
  google_found?: unknown;
  instagram_found?: unknown;
  facebook_found?: unknown;
}): Partial<ReviewFoundFlags> {
  return {
    ...(typeof data.google_found === "boolean" ? { google_found: data.google_found } : {}),
    ...(typeof data.instagram_found === "boolean" ? { instagram_found: data.instagram_found } : {}),
    ...(typeof data.facebook_found === "boolean" ? { facebook_found: data.facebook_found } : {}),
  };
}

/** List or unlist the place on Mesita — the ONLY write path to
 *  places.state, which is what the consumer RLS policy
 *  places_select_public_visible gates every guest read on. Unlisting removes
 *  the place from browse, search, and any shared link at once.
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

// ── Premier (MESITA-2995; Premier MESITA-2925, Boost MESITA-2789) ───────

/** One pledge in a place's Premier line, as Single Place › Premier lists
 *  it: the payer first, then the backups in the order a renewal walks
 *  them, then pledges not in line (declined card, unfinished Checkout).
 *  Amounts are US cents per billing interval. */
export type AdminPledge = {
  id: string;
  payer: string | null;
  tier: 1 | 2;
  interval: "month" | "year";
  amount_cents: number;
  status: "open" | "ready" | "failed" | "ended";
  role: "payer" | "backup" | "waiting";
  position: number | null;
  pending_tier: number | null;
  livemode: boolean;
  queued_at: string;
};

/** One paid stretch of the place's Premier (or a grant, `payer` null). */
export type AdminPeriod = {
  id: string;
  payer: string | null;
  granted_by: string | null;
  tier: 1 | 2;
  interval: "month" | "year";
  starts_at: string;
  ends_at: string;
  price_cents: number;
  credit_cents: number;
  extra_days: number;
  charged_cents: number;
  status: "charging" | "paid" | "declined" | "replaced" | "ended";
};

export type AdminPlaceBoost = {
  tier: 0 | 1 | 2;
  factor: number;
  period: { id: string; tier: number; ends_at: string; granted: boolean; granted_by: string | null } | null;
  line: AdminPledge[];
  periods: AdminPeriod[];
  /** Charges still unknown after two hours. */
  stuck: number;
};

/** The place's Premier: period, line and recent periods
 *  (admin-web-get-place-premier). */
export async function getPlaceBoost(placeId: string): Promise<Result<AdminPlaceBoost>> {
  const r = await efInvoke<AdminPlaceBoost>("admin-web-get-place-premier", { placeId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

/** The operator's Premier writes (admin-web-grant-place-premier): grant a
 *  period nobody pays for, end a running grant, or take a pledge out of
 *  the line. None refunds. */
export async function changePlaceBoost(
  placeId: string,
  change:
    | { action: "grant"; tier: 1 | 2; months: number }
    | { action: "end" }
    | { action: "remove_pledge"; backingId: string },
): Promise<Result<true>> {
  const r = await efInvoke<{ ok: true }>("admin-web-grant-place-premier", { placeId, ...change });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

export type AdminPlaceReport = {
  id: string;
  place_id: string;
  place_name: string;
  consumer_id: string;
  first_name: string | null;
  member_number: string | null;
  reason: string;
  note: string | null;
  created_at: string;
};

/** The place's guest reports, newest first (admin-web-list-place-reports,
 *  MESITA-2686). Read-only. Every place's at once is Activity › Feedback
 *  (app/(app)/feedback/actions.ts). */
export async function listPlaceReports(
  placeId: string,
): Promise<Result<{ reports: AdminPlaceReport[]; capped: boolean }>> {
  const r = await efInvoke<{ reports?: AdminPlaceReport[]; capped?: boolean }>(
    "admin-web-list-place-reports",
    { placeId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { reports: r.data.reports ?? [], capped: r.data.capped === true } };
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

// ── Per-place Enricher inspector (admin-only) ────────────────────────────
// The place's enrichment state, for the Admin tab. Super-admin gated EF.

export type PlaceEnrichmentState = {
  content_state: string | null;
  last_enriched_at: string | null;
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
