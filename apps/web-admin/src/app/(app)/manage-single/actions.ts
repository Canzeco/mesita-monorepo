"use server";

import { efInvoke } from "@/lib/supabase-ef";
import { createPlaceFromGooglePlaceId as createPlaceFromGooglePlaceIdImpl } from "@/lib/create-place-from-google-place";
import type { PlanKey } from "@/lib/business/plans";

// ════════════════════════════════════════════════════════════════════════
// Single-place console — a super-admin drives ANY place through the existing
// business-* edge functions. The operator's JWT email is in super_admins, so
// _shared/auth.ts (checkMembership / requireMembership / requireOwner) grants
// access regardless of project_members. Two things need admin-specific EFs:
// the place search below, and setting `plan` (business-web-update-project
// rejects it — it's the paid door's field, so admin gets its own).
// ════════════════════════════════════════════════════════════════════════

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Place search + load ──────────────────────────────────────────────────

/**
 * Why the enrichment queue stopped, straight off `pulseBlockedAt` in
 * `_shared/pulse-pieces.ts`. `failed` = the function ran and could not do its
 * job; `missing` = it has no event yet. Both admin EFs ship it beside the
 * number, because the number alone cannot tell those two apart at 0.
 */
export type PulseBlock = {
  key: string;
  index: number;
  status: "failed" | "missing";
};

export type PlaceHit = {
  id: string;
  slug: string | null;
  /** Generated display label: coalesce(mesita_name, google_name). */
  name: string;
  /** Google's own label. The catalog table shows THIS, not `name`. */
  google_name: string | null;
  category: string | null;
  category_label: string | null;
  /** Super Categories: Intaker-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  status: string | null;
  address: string | null;
  photo: string | null;
  zone: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  content_status: string | null;
  listing_type: string | null;
  // ── The nine status facts the catalog table renders, in order:
  //    Created · Active · Listed · Requested · Enriched · Enriching ·
  //    Verified · Partnered · Promoted.
  //    Bools except Requested (0…n) and Promoted (0|1|2). All derived
  //    (or projected) in admin-web-search-places, except Enriching which
  //    is content_status generating/queued (MESITA-453 whole-pipeline).
  /** Google Place ID spine — used to match a Mesita Search paste. */
  google_place_id: string | null;
  /** google_place_id present — the identity spine every run starts from. */
  seeded: boolean;
  /** A guest can reach it: projects.status, per the consumer RLS policy. */
  listed: boolean;
  /** Derived has-demand for filters. Catalog Status shows request_count. */
  requested: boolean;
  /** Guest request count — the Requested Status fact, 0…n. */
  request_count: number;
  /** Intaker pipeline mid-flight (content_status generating/queued). */
  enriching: boolean;
  /** Operating (MESITA-1239): Google's businessStatus, verbatim. NULL = Google
   *  is silent, which is a third state and not OPERATIONAL. A FLAG, never a
   *  visibility gate — Listed above is the gate. */
  business_status: string | null;
  /** When Operating was last observed. Without it a stale claim reads current. */
  business_status_at: string | null;
  /** PULSE: how far the ten-piece queue got, 0-10. 0 means it never started
   *  — or the place predates piece reporting and has no events. */
  enrich_pulse: number;
  /** The ladder's length, so nothing hardcodes 9. */
  enrich_pulse_total: number;
  /** The rung names in queue order, from the server. Never hand-copy this
   *  list — a reorder would put the wrong name beside every row. */
  enrich_pulse_labels: string[];
  /** Why the queue stopped where it did — null once it has finished. */
  enrich_pulse_blocked: PulseBlock | null;
  /** An APPROVED project_verifications row — ownership proof, not a badge. */
  verified: boolean;
  /** plan !== "free" — the place pays Mesita. */
  partner: boolean;
  /** Live: paid ∧ strategy above Zero ∧ promo lane open. */
  promoting: boolean;
  /** How hard. Engine 0-3; operator display is 0|1|2 (Dominant → 2). */
  promoting_level: 0 | 1 | 2 | 3;
};

// The search EF only guarantees id/name — every other field may be absent,
// hence the defensive `?? null` normalization below.
type RawPlaceHit = Pick<PlaceHit, "id" | "name"> & Partial<Omit<PlaceHit, "id" | "name">>;

async function fetchPlaces(query: string, limit = 50): Promise<Result<PlaceHit[]>> {
  const r = await efInvoke<{ places: RawPlaceHit[] }>("admin-web-search-places", {
    query,
    limit,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: (r.data.places ?? []).map(normalizePlaceHit) };
}

function normalizePlaceHit(raw: RawPlaceHit): PlaceHit {
  const contentStatus = raw.content_status ?? null;
  const listingType = raw.listing_type ?? null;
  return {
    id: raw.id,
    slug: raw.slug ?? null,
    name: raw.name,
    google_name: raw.google_name ?? null,
    category: raw.category ?? null,
    category_label: raw.category_label ?? null,
    status: raw.status ?? null,
    address: raw.address ?? null,
    photo: raw.photo ?? null,
    zone: raw.zone ?? null,
    google_stars_overall:
      typeof raw.google_stars_overall === "number" ? raw.google_stars_overall : null,
    google_review_count:
      typeof raw.google_review_count === "number" ? raw.google_review_count : null,
    content_status: contentStatus,
    listing_type: listingType,
    enriching: contentStatus === "generating" || contentStatus === "queued",
    // No listing_type fallbacks here any more: it fuses paying and promoting
    // into one stale enum, so guessing from it would put a wrong flag on
    // screen rather than an honest "not yet" (MESITA-1152 / MESITA-1166).
    google_place_id: raw.google_place_id ?? null,
    seeded: raw.seeded ?? false,
    listed: raw.listed ?? false,
    request_count:
      typeof raw.request_count === "number" && Number.isFinite(raw.request_count)
        ? raw.request_count
        : 0,
    requested:
      typeof raw.requested === "boolean"
        ? raw.requested
        : contentStatus !== "ready" &&
          typeof raw.request_count === "number" &&
          raw.request_count > 0,
    business_status:
      typeof raw.business_status === "string" ? raw.business_status : null,
    business_status_at:
      typeof raw.business_status_at === "string" ? raw.business_status_at : null,
    enrich_pulse: raw.enrich_pulse ?? 0,
    // No `?? 9` here any more: the total and the labels come from the same
    // server list, so a client fallback could only ever disagree with it. The
    // label fallback subtracts one — the labels are indexed by function number
    // with the Created floor label at 0, so eleven of them describe a 0-10 scale.
    enrich_pulse_total: raw.enrich_pulse_total ??
      (raw.enrich_pulse_labels ? raw.enrich_pulse_labels.length - 1 : 0),
    enrich_pulse_labels: raw.enrich_pulse_labels ?? [],
    // No invented fallback: absent means the payload predates the field, and
    // defaulting to "missing" would claim a fact we did not read.
    enrich_pulse_blocked: raw.enrich_pulse_blocked ?? null,
    verified: raw.verified ?? false,
    partner: raw.partner ?? false,
    promoting: raw.promoting ?? false,
    promoting_level: raw.promoting_level ?? 0,
  };
}

export async function listPlaces(): Promise<Result<PlaceHit[]>> {
  return fetchPlaces("");
}

export async function searchPlacesCatalog(query: string): Promise<Result<PlaceHit[]>> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, data: [] };
  return fetchPlaces(q);
}

/** Mesita catalog lookup by Google Place IDs — read-only, no create/enrich. */
export async function searchPlacesByGoogleIds(
  googlePlaceIds: string[],
): Promise<Result<PlaceHit[]>> {
  const ids = googlePlaceIds.map((id) => id.trim()).filter((id) => id.length >= 18);
  if (ids.length === 0) return { ok: true, data: [] };
  const r = await efInvoke<{ places: RawPlaceHit[] }>("admin-web-search-places", {
    googlePlaceIds: ids.slice(0, 250),
    limit: Math.min(ids.length, 250),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: (r.data.places ?? []).map(normalizePlaceHit) };
}

// One menu / catalog entry under products.menu (and legacy menus).
export type AdminMenuItem = {
  name?: string | null;
  url?: string | null;
  items?: unknown[] | null;
};

// The full place row, loaded for a super-admin via business-get-overview
// (which returns the single requested place when the caller is super-admin).
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
   * is) — it changes whenever the Google listing does. Intaker-only write.
   */
  google_name?: string | null;
  category: string | null;
  category_label: string | null;
  /** Super Categories: Intaker-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  status: string | null;
  currency: string | null;
  // Catalog tier: "web" (listed) vs "partner" (Mesita partner). Separate from
  // ownership (project_members.role = owner) — see place-ownership.ts.
  listing_type: string | null;
  price_level: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  city: string | null;
  timezone: string | null;
  description: string | null;
  /** Spanish About translation (MESITA-926). */
  phone: string | null;
  email: string | null;
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
  // How each rail reaches the place: phone · whatsapp · instagram · web · none.
  // The Reservationist only DIALS phone. order_* is STAGED until the order rail
  // ships (MESITA-1155).
  reservation_channel?: string | null;
  reservation_target?: string | null;
  order_channel?: string | null;
  order_target?: string | null;
  // Legacy parallel array; prefer products.menu when present.
  menus?: AdminMenuItem[] | null;
  plan: string | null;
  fiscal_type: string | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
  // Reviews tab (read-only; carried on the overview place payload).
  google_stars_overall: number | null;
  google_review_count: number | null;
  google_reviews: unknown;
  mesita_stars_overall: number | null;
  mesita_stars_food: number | null;
  mesita_stars_service: number | null;
  mesita_stars_ambience: number | null;
  mesita_stars_value: number | null;
  mesita_review_count: number | null;
  mesita_visitors: unknown;
  instagram_followers_count: number | null;
  facebook_followers: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Stamped by the Intaker's final write — lets the Meta box attribute
  // updated_at to the AI (≈ same instant) vs a human edit (later).
  enriched_at: string | null;
  // On-Update embeddings (MESITA-720) — human blurb + vector; super-admin
  // overview only. Tags are never part of the source text.
  embedding?: string | number[] | null;
  embedding_source_hash?: string | null;
  embedding_source_text?: string | null;
  name_embedding?: string | number[] | null;
  name_embedding_hash?: string | null;
  // ── Status, super-admin overview only (MESITA-1186) ──────────────────────
  // Computed by business-web-get-overview off _shared/place-status.ts — the
  // same helpers admin-web-search-places uses for the Single Place table, so
  // the box and the table can never disagree. Absent (undefined) means the
  // payload predates them; the box renders "?" rather than a false "no".
  /** google_place_id present — the identity spine every enrichment run needs. */
  seeded?: boolean;
  /** projects.status ∈ (active, lead) — a guest can reach the place at all. */
  listed?: boolean;
  /** Derived has-demand for filters. Status chip is request_count. */
  requested?: boolean;
  /** Guest request count — the Requested Status fact, 0…n. */
  request_count?: number;
  /** Operating: Google's businessStatus, verbatim (MESITA-1239). */
  business_status?: string | null;
  business_status_at?: string | null;
  /** PULSE: how far the TEN-function ENRICH queue got, 0-10 (0 = created).
   *  Absent on a payload that
   *  predates it; the box renders "?" rather than a false 0. */
  enrich_pulse?: number;
  /** The ladder's length, from the server. */
  enrich_pulse_total?: number;
  /** Function names indexed BY FUNCTION NUMBER — labels[0] = the Created floor. */
  enrich_pulse_labels?: string[];
  /** Why the queue stopped where it did. Absent on an older payload. */
  enrich_pulse_blocked?: PulseBlock | null;
  /** Per Enrich subfunction (1–10). Overview payload only. */
  enrich_functions?: Record<string, {
    status: "pending" | "completed" | "failed";
    at: string | null;
    detail: string | null;
  }> | null;
  /** Intaker lifecycle on the project row. Overview already carries this. */
  content_status?: string | null;
  /** Google's own id. Admin payload only — never in PLACE_PUBLIC_COLUMNS. */
  google_place_id?: string | null;
  [k: string]: unknown;
};

export async function getPlace(projectId: string): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{ active: { place: AdminPlace } | null }>(
    "business-web-get-overview",
    { placeId: projectId, ticketsLimit: 0 },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const place = r.data.active?.place ?? null;
  if (!place) return { ok: false, error: "Place not found or not loadable." };
  return { ok: true, data: place };
}

// ── Place / Promos: write place fields ───────────────────────────────────

export async function updatePlace(
  patch: Record<string, unknown> & { id: string },
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{ place: AdminPlace }>("business-web-update-project", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.place };
}

// Plan is billing, not profile: business-web-update-project rejects any body
// carrying a `plan` key. The admin grants it through its own door instead —
// no Stripe, no money (admin-web-set-plan).
//
// `rates` rides along on purpose (MESITA-818/912). A membership and the
// strategy that justifies it are one decision, and sending them together
// makes it ONE atomic write. Join may land on Zero (paid plan + null rates) —
// the old 409 `no_strategy` guard is retired; a 0% Mesita Partner is
// prevented by the shared listing_type derivation in the EF instead.
export async function setPlacePlan(
  placeId: string,
  plan: PlanKey,
  rates?: Record<string, number | null>,
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{ place: AdminPlace }>("admin-web-set-plan", {
    placeId,
    plan,
    ...(rates ?? {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.place };
}

/** List or unlist the place on Mesita — the ONLY write path to
 *  projects.status, which is what the consumer RLS policy
 *  projects_select_public_visible gates every guest read on. Unlisting removes
 *  the place from browse, search, the swipe deck and any shared link at once.
 *  business-web-update-project does not accept `status`, so this is its own
 *  admin door (admin-web-set-place-listed). */
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

/** Operator Active (Status box). Writes business_status. Active off also
 *  unlists — guests disappear in the same apply. Active on does not list. */
export async function setPlaceActive(
  placeId: string,
  active: boolean,
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{
    place: AdminPlace;
    active?: boolean;
    listed?: boolean;
    business_status?: string | null;
    status?: string | null;
  }>("admin-web-set-place-active", { placeId, active });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      ...r.data.place,
      listed: r.data.listed ?? r.data.place.listed,
      business_status: r.data.business_status ?? r.data.place.business_status,
      // Stamp status so mergePlace's withListedFromStatus sees paused after
      // Active off, even if an older place payload omitted it.
      status: r.data.status ?? r.data.place.status,
    },
  };
}

/** Admin attestation of ownership proof. Verified is one-time; yes only. */
export async function setPlaceVerified(
  placeId: string,
): Promise<Result<{ verified: true; alreadyVerified: boolean }>> {
  const r = await efInvoke<{ verified?: boolean; alreadyVerified?: boolean }>(
    "admin-web-set-place-verified",
    { placeId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      verified: true,
      alreadyVerified: r.data.alreadyVerified === true,
    },
  };
}

/** Rates-only strategy switch — no plan write (MESITA-912).
 *  Plan-less body on admin-web-set-plan (one-caller ACL; never business-web). */
export async function setPlaceStrategy(
  placeId: string,
  rates: Record<string, number | null>,
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{ place: AdminPlace }>("admin-web-set-plan", {
    placeId,
    ...rates,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.place };
}

// ── Performance: per-place activity (read-only) ──────────────────────────
// Real aggregates + a short reservation list + the two inbound AI phone
// lines. Deliberately read-only: a booking is changed by CALLING a3/a4, never
// by editing a row (Pato) — there is no write counterpart to this action.

export type PlaceStats = {
  saves: number;
  tickets: number;
  visits: number;
  /** Visits marked done (status=revealed). EF also echoes as `paid` for compat. */
  closed: number;
  reservations: number;
  influencedCents: number;
  discountCents: number;
  /** Closed visits that carry a recorded amount (total ?? subtotal). */
  billedCount: number;
  /** Of billedCount, how many amounts the guest typed (v3b provenance). */
  consumerReportedCount: number;
  avgTicketCents: number | null;
  /** visits ÷ saves, and closed ÷ visits — the funnel's two conversions. */
  visitRate: number | null;
  closeRate: number | null;
};

type PlaceReservation = {
  id: string;
  reservedAt: string | null;
  partySize: number | null;
  status: string | null;
  isTest: boolean;
  guest: string;
};

export type PlaceActivity = {
  stats: PlaceStats;
  reservations: PlaceReservation[];
  reservationTotal: number;
  /** The only way to change a booking — a3 answers guests, a4 answers places. */
  lines: { guest: string; place: string };
  generatedAt: string;
};

export async function getPlaceActivity(
  projectId: string,
  opts?: { limit?: number },
): Promise<Result<PlaceActivity>> {
  // EF returns `closed` (canonical) and may still echo `paid` as a compat alias.
  type EfStats = PlaceStats & { paid?: number };
  const r = await efInvoke<Omit<PlaceActivity, "stats"> & { stats: EfStats }>(
    "admin-web-get-place-activity",
    { placeId: projectId, limit: opts?.limit },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const s = r.data.stats;
  const closed = typeof s.closed === "number" ? s.closed : (s.paid ?? 0);
  return {
    ok: true,
    data: {
      ...r.data,
      stats: {
        saves: s.saves,
        tickets: s.tickets,
        visits: s.visits,
        closed,
        reservations: s.reservations,
        influencedCents: s.influencedCents,
        discountCents: s.discountCents,
        billedCount: typeof s.billedCount === "number" ? s.billedCount : 0,
        consumerReportedCount:
          typeof s.consumerReportedCount === "number"
            ? s.consumerReportedCount
            : 0,
        avgTicketCents: s.avgTicketCents,
        visitRate: s.visitRate,
        closeRate: s.closeRate,
      },
    },
  };
}

// ── Atlas tag catalog (for Place tags picker) ────────────────────────────
// Same backend source Atlas Config reads (`admin-web-get-atlas-fields` →
// public.place_tags). Manage Single Place calls this EF via its own server
// action — it does NOT import from /atlas-config or talk to that page.

export type PlaceTagOption = {
  slug: string;
  label_es: string;
  label_en: string;
  facet: string;
  section: string;
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

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
  /** 1–2 Atlas Super Category parents (multi-parent law). */
  super_category_slugs?: string[];
};

export type PlaceSuperCategoryOption = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

type PlaceTagCatalog = {
  tags: PlaceTagOption[];
  facets: PlaceTagFacet[];
  categories: PlaceCategoryOption[];
  superCategories: PlaceSuperCategoryOption[];
  tagsPerPlaceMax: number;
  fieldLimits: PlaceFieldLimits;
};

const DEFAULT_PLACE_FIELD_LIMITS: PlaceFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 2000,
  tagsPerPlaceMax: 20,
  photosMax: 10,
};

function readPlaceFieldLimits(
  fieldLimits?: Record<string, { max: number; note: string }>,
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

export async function listPlaceTagCatalog(): Promise<Result<PlaceTagCatalog>> {
  const r = await efInvoke<{
    tags: PlaceTagOption[];
    facets: PlaceTagFacet[];
    categories: PlaceCategoryOption[];
    superCategories?: PlaceSuperCategoryOption[];
    fieldLimits?: Record<string, { max: number; note: string }>;
  }>("admin-web-get-atlas-fields", {});
  if (!r.ok) return { ok: false, error: r.error };
  const fieldLimits = readPlaceFieldLimits(r.data.fieldLimits);
  return {
    ok: true,
    data: {
      tags: r.data.tags ?? [],
      facets: r.data.facets ?? [],
      categories: r.data.categories ?? [],
      superCategories: r.data.superCategories ?? [],
      tagsPerPlaceMax: fieldLimits.tagsPerPlaceMax,
      fieldLimits,
    },
  };
}

// ── Per-place Intaker inspector (admin-only) ────────────────────────────
// Internal enricher output for the Place editor: per-photo metadata for the
// ⓘ inspector (keyed by public_url, matches AdminPlace.photos[]) + the place's
// enrichment status. Super-admin gated EF.

export type PlaceMediaMeta = {
  source: string | null;
  status: string | null;
  analysis_text: string | null;
  caption: string | null;
  likes_count: number | null;
  source_url: string | null;
  // Raw per-source signals captured at gather time (pre-analysis): Instagram
  // carries comments_count / timestamp / is_video / shortcode; website carries
  // alt / page / width / height. Shape varies by source, hence unknown values.
  source_metadata: Record<string, unknown> | null;
};

export type PlaceEnrichmentStatus = {
  content_status: string | null;
  stage: string | null;
  stage_status: string | null;
  error: string | null;
  last_enriched_at: string | null;
  updated_at: string | null;
  /** The SERP Summary from the last run — Agent X's soft editorial read.
   *  Soft context only: never a source of facts, ratings or prices. */
  serp_summary: string | null;
};

/** Per-place enrichment schedule — WHEN it re-runs (MESITA-1148).
 *  everyDays null = manual only; the cron never picks the place up. */
export type PlaceEnrichmentSchedule = {
  everyDays: number | null;
  mode: ReenrichMode;
  nextAt: string | null;
  lastEnrichedAt: string | null;
};

type PlaceEnrichment = {
  media: Record<string, PlaceMediaMeta>;
  status: PlaceEnrichmentStatus | null;
  schedule: PlaceEnrichmentSchedule | null;
};

export async function getPlaceEnrichment(
  projectId: string,
): Promise<Result<PlaceEnrichment>> {
  const r = await efInvoke<{
    media: Record<string, PlaceMediaMeta>;
    status: PlaceEnrichmentStatus | null;
    schedule: PlaceEnrichmentSchedule | null;
  }>("admin-web-get-place-enrichment", { projectId });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      media: r.data.media ?? {},
      status: r.data.status ?? null,
      schedule: r.data.schedule ?? null,
    },
  };
}

// Set WHEN a place re-enriches. The EF writes places.enrich_* and derives the
// next due date; the queue_due_place_enrichments cron is what honours it.
export async function setPlaceEnrichmentSchedule(
  placeId: string,
  schedule: { everyDays: number | null; mode: ReenrichMode },
): Promise<Result<PlaceEnrichmentSchedule>> {
  const r = await efInvoke<{ schedule: PlaceEnrichmentSchedule }>(
    "admin-web-set-place-enrichment",
    { placeId, everyDays: schedule.everyDays, mode: schedule.mode },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.schedule };
}

// Which slice of the Intaker pipeline a manual re-enrich re-runs:
//   full     → research + analysis + contents (fresh gather; refreshes phone)
//   analysis → analysis + contents, reusing stored gathered (no re-gather)
//   contents → contents only, reusing stored gathered + analysis (cheapest)
// The lighter modes need a prior full run; the EF rejects (422) otherwise.
export type ReenrichMode = "full" | "analysis" | "contents";

// Manually re-run the Intaker pipeline for one place. Re-seeds place_research
// to the stage implied by `mode`; the cron poller takes it from there. Runs
// ASYNC — poll getPlaceEnrichment to watch progress.
export async function enrichPlace(
  projectId: string,
  mode: ReenrichMode = "full",
): Promise<Result<true>> {
  const r = await efInvoke<{ enrichmentTriggered: boolean }>(
    "admin-web-enrich-place",
    { projectId, mode },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

// ── Team ─────────────────────────────────────────────────────────────────

export type TeamSnapshot = {
  myRole: string | null;
  members: {
    memberId: string;
    userId: string;
    role: string;
    fullName: string | null;
    email: string | null;
    createdAt: string;
  }[];
  pendingBusinessInvites: {
    id: string;
    email: string;
    role: string;
    token: string;
    createdAt: string;
    expiresAt: string;
  }[];
};

export async function listTeam(projectId: string): Promise<Result<TeamSnapshot>> {
  const r = await efInvoke<TeamSnapshot>("business-web-list-members", { placeId: projectId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

/** Immutable email of who completed ownership verification (not team owners). */
export type PlaceVerificationGlance = {
  verifiedByEmail: string | null;
  decidedAt: string | null;
  method: string | null;
  decidedVia: string | null;
};

export async function getPlaceVerification(
  projectId: string,
): Promise<Result<PlaceVerificationGlance>> {
  const r = await efInvoke<PlaceVerificationGlance>(
    "admin-web-get-place-verification",
    { projectId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      verifiedByEmail: r.data.verifiedByEmail ?? null,
      decidedAt: r.data.decidedAt ?? null,
      method: r.data.method ?? null,
      decidedVia: r.data.decidedVia ?? null,
    },
  };
}

/** One row from admin-web-list-verifications in per-place mode. */
export type PlaceVerificationRequest = {
  id: string;
  method: string;
  requester_email: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  decided_at: string | null;
  decided_via: "auto" | "admin" | null;
  created_at: string;
  payload: Record<string, unknown>;
};

export async function listPlaceVerifications(
  projectId: string,
): Promise<Result<PlaceVerificationRequest[]>> {
  const r = await efInvoke<{ verifications: PlaceVerificationRequest[] }>(
    "admin-web-list-verifications",
    { projectId, limit: 50 },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.verifications ?? [] };
}

export async function decidePlaceVerification(
  verificationId: string,
  decision: "approved" | "rejected",
  rejectReason: string,
): Promise<Result<true>> {
  const r = await efInvoke<unknown>("admin-web-decide-verification", {
    verificationId,
    decision,
    rejectReason: decision === "rejected" ? rejectReason : undefined,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}

export async function inviteEditor(
  projectId: string,
  email: string,
  role: string,
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-web-invite-member", {
    placeId: projectId,
    email,
    role,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function updateMemberRole(
  memberId: string,
  role: string,
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-web-update-member-role", { memberId, role });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function removeMember(
  id: string,
  kind: "editor" | "editorInvite",
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-web-remove-member", { id, kind });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// Default business web origin used when the env var isn't set on Vercel —
// production lives at business.mesita.ai today. Override per environment by
// setting BUSINESS_WEB_URL.
const BUSINESS_WEB_URL_FALLBACK = "https://business.mesita.ai";

type FoundPlace = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type EFResponse = { place: FoundPlace | null };

type FindPlaceResult =
  | {
      ok: true;
      found: true;
      place: FoundPlace;
      link: string;
    }
  | { ok: true; found: false; placeId: string }
  | { ok: false; error: string };

export async function findPlaceByPlaceId(
  rawPlaceId: string,
): Promise<FindPlaceResult> {
  const placeId = (rawPlaceId ?? "").trim();
  if (!placeId) {
    return { ok: false, error: "Paste a Google Place ID first." };
  }

  const result = await efInvoke<EFResponse>("admin-web-find-place", { placeId });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const place = result.data.place;
  if (!place) {
    return { ok: true, found: false, placeId };
  }

  // Clean URL — the operator opens this in a fresh tab, the business web's
  // middleware sees no session and bounces through / (the auth surface)
  // if needed. Once signed in (as themselves, via Google), the
  // business-get-overview EF reads their JWT, finds their email in
  // super_admins, and grants place access regardless of project_members.
  const businessOrigin =
    (process.env.BUSINESS_WEB_URL ?? "").trim() || BUSINESS_WEB_URL_FALLBACK;
  const link = `${businessOrigin.replace(/\/$/, "")}/place/${encodeURIComponent(place.id)}/home`;
  return { ok: true, found: true, place, link };
}

// ── Name Deep Search (same engine as consumer Search) ────────────────────

export type PlacePredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PlacePredictionStatus;
  partner?: boolean;
  mesitaId?: string;
};

export async function suggestPlaces(
  input: string,
  sessionToken: string,
  regionCode?: string,
): Promise<Result<PlacePrediction[]>> {
  const q = (input ?? "").trim();
  if (q.length < 2) return { ok: true, data: [] };
  if (!sessionToken.trim()) return { ok: false, error: "Missing session token" };

  const code = (regionCode ?? "").trim().toUpperCase();
  const r = await efInvoke<{ predictions: PlacePrediction[] }>("admin-web-suggest-places", {
    input: q,
    sessionToken,
    mode: "deep",
    ...(code.length === 2 ? { country: code, regionCode: code } : {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.predictions ?? [] };
}

// The create-place pipeline is shared with the bulk creator — see the single
// canonical implementation in @/lib/create-place-from-google-place.
export async function createPlaceFromGooglePlaceId(placeId: string) {
  return createPlaceFromGooglePlaceIdImpl(placeId);
}

// ── Check settings (MESITA-823 · MESITA-898) ─────────────────────────────
// The optional shared 6-digit staff PIN gating check-page WRITE actions, and
// the per-place "require bill amount" switch gating the close. Read: both
// ride on the active place from business-web-get-overview (owner /
// super-admin only — the columns are deliberately absent from the profiles
// view).
// Write: one owner-gated EF, partial updates — each card sends only its key.

/** The one place-owned check-page gate (MESITA-823). The bill is always
 *  required (MESITA-1095) — this door no longer writes a switch. */
export type CheckGates = { pin: string | null };

export async function setCheckGates(
  placeId: string,
  gates: CheckGates,
): Promise<Result<CheckGates>> {
  const r = await efInvoke<{ pin: string | null }>(
    "business-web-set-check-pin",
    { placeId, pin: gates.pin },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { pin: r.data.pin } };
}
