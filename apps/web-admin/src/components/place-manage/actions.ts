"use server";

import { efInvoke } from "@/lib/supabase-ef";
import type { PlanKey } from "@/lib/business/plans";

// ════════════════════════════════════════════════════════════════════════
// Single-place console. These actions serve BOTH readers of the place
// screen: a super-admin (whose JWT email is in super_admins, so
// _shared/auth.ts grants access to any place regardless of place_members)
// and the operator who actually holds it.
//
// This file used to say only two things needed admin-specific EFs — the
// place search and `plan`. That was wrong by six, and nobody could see it,
// because a super-admin passes every guard: the one account that had ever
// opened this console was in `super_admins`, so calls that 403 for a real
// operator returned 200 for the only person testing (MESITA-1736).
//
// The rule, from this package's CLAUDE.md: everything the console does goes
// through `business-web-*`; `admin-web-*` belongs to the Admin tab, which
// `places/[id]/admin/page.tsx` refuses to a non-super-admin.
// `lib/business-console-doors.test.ts` fails on a new operator-reachable
// admin door, and fails again when a listed one is left after it is fixed.
// ════════════════════════════════════════════════════════════════════════

// `code` is the EF's machine-readable failure (efInvoke already keeps it off
// `body.code`). It is optional because most call sites only ever show a
// sentence — but a call site that must BRANCH on a specific refusal needs
// something other than the prose to branch on, and re-matching the prose is
// how a copy edit in Deno silently breaks a screen in Next.
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string | null };

// ── Place search + load ──────────────────────────────────────────────────

/**
 * Why the enrichment queue stopped, straight off `crenupBlockedAt` in
 * `_shared/crenup-ladder.ts`. `failed` = the function ran and could not do its
 * job; `missing` = it has no event yet. Both admin EFs ship it beside the
 * number, because the number alone cannot tell those two apart at 0.
 */
export type CrenupBlock = {
  key: string;
  index: number;
  state: "failed" | "missing";
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
  /** Families: Enricher-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  state: string | null;
  address: string | null;
  photo: string | null;
  zone: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  content_state: string | null;
  listing_type: string | null;
  // ── The state facts (labels: Created · Active · Listed · Requested ·
  //    Enriching · Enriched · Partnered · Visit Rewards ·
  //    Mesita Pay · Mesita Credits) plus the quick-view commercial block
  //    (promotion · pickup · delivery). Bools except Requested (0…n),
  //    Visit Rewards (0|1|2) and promotion (0–7). All derived (or
  //    projected) in admin-web-search-places, except Enriching which is
  //    content_state generating/queued (MESITA-453 whole-pipeline). The
  //    acceptance bits are stored operator toggles on places.
  /** Google Place ID spine — used to match a Mesita Search paste. */
  google_place_id: string | null;
  /** google_place_id present — the identity spine every run starts from. */
  seeded: boolean;
  /** A guest can reach it: places.state, per the consumer RLS policy. */
  listed: boolean;
  /** Derived has-demand for filters. Catalog State shows request_count. */
  requested: boolean;
  /** Guest request count — the Requested State fact, 0…n. */
  request_count: number;
  /** Enricher pipeline mid-flight (content_state generating/queued). */
  enriching: boolean;
  /** Operating (MESITA-1239): Google's businessStatus, verbatim. NULL = Google
   *  is silent, which is a third state and not OPERATIONAL. A FLAG, never a
   *  visibility gate — Listed above is the gate. */
  business_state: string | null;
  /** When Operating was last observed. Without it a stale claim reads current. */
  business_state_at: string | null;
  /** CRENUP: how far the eight-step queue got, 0-8. 0 means it never started
   *  — or the place predates piece reporting and has no events. */
  enrich_crenup: number;
  /** The ladder's length, so nothing hardcodes 9. */
  enrich_crenup_total: number;
  /** The rung names in queue order, from the server. Never hand-copy this
   *  list — a reorder would put the wrong name beside every row. */
  enrich_crenup_labels: string[];
  /** Why the queue stopped where it did — null once it has finished. */
  enrich_crenup_blocked: CrenupBlock | null;
  /** plan !== "free" — the place pays Mesita. */
  partner: boolean;
  /** Live: paid ∧ strategy above Zero ∧ promo lane open. */
  promoting: boolean;
  /** How hard. Engine 0-3; operator display is 0|1|2 (Dominant → 2). */
  promoting_level: 0 | 1 | 2 | 3;
  /** places.mesita_pay_enabled — the operator's "accepts Mesita Pay" toggle
   *  (Partner tab). The gateway engine still gates the rail itself. */
  mesita_pay: boolean;
  /** places.credits_enabled — the operator's "accepts Credits" toggle. */
  credits: boolean;
  /** places.pickup_orders_enabled — offers pickup orders (intent bit). */
  pickup: boolean;
  /** places.delivery_orders_enabled — offers delivery orders (intent bit). */
  delivery: boolean;
  /** The Promotion score, 0–7 — offering completeness, shaped server-side
   *  (promotion-score.ts twins) so the catalog and the Promos bar agree. */
  promotion: number;
};

// The search EF only guarantees id/name — every other field may be absent,
// hence the defensive `?? null` normalization below.
type RawPlaceHit = Pick<PlaceHit, "id" | "name"> & Partial<Omit<PlaceHit, "id" | "name">>;
function normalizePlaceHit(raw: RawPlaceHit): PlaceHit {
  const contentState = raw.content_state ?? null;
  const listingType = raw.listing_type ?? null;
  return {
    id: raw.id,
    slug: raw.slug ?? null,
    name: raw.name,
    google_name: raw.google_name ?? null,
    category: raw.category ?? null,
    category_label: raw.category_label ?? null,
    state: raw.state ?? null,
    address: raw.address ?? null,
    photo: raw.photo ?? null,
    zone: raw.zone ?? null,
    google_stars_overall:
      typeof raw.google_stars_overall === "number" ? raw.google_stars_overall : null,
    google_review_count:
      typeof raw.google_review_count === "number" ? raw.google_review_count : null,
    content_state: contentState,
    listing_type: listingType,
    enriching: contentState === "generating" || contentState === "queued",
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
        : contentState !== "ready" &&
          typeof raw.request_count === "number" &&
          raw.request_count > 0,
    business_state:
      typeof raw.business_state === "string" ? raw.business_state : null,
    business_state_at:
      typeof raw.business_state_at === "string" ? raw.business_state_at : null,
    enrich_crenup: raw.enrich_crenup ?? 0,
    // No `?? 9` here any more: the total and the labels come from the same
    // server list, so a client fallback could only ever disagree with it. The
    // label fallback subtracts one — the labels are indexed by function number
    // with the Created floor label at 0, so eleven of them describe a 0-10 scale.
    enrich_crenup_total: raw.enrich_crenup_total ??
      (raw.enrich_crenup_labels ? raw.enrich_crenup_labels.length - 1 : 0),
    enrich_crenup_labels: raw.enrich_crenup_labels ?? [],
    // No invented fallback: absent means the payload predates the field, and
    // defaulting to "missing" would claim a fact we did not read.
    enrich_crenup_blocked: raw.enrich_crenup_blocked ?? null,
    partner: raw.partner ?? false,
    promoting: raw.promoting ?? false,
    promoting_level: raw.promoting_level ?? 0,
    mesita_pay: raw.mesita_pay ?? false,
    credits: raw.credits ?? false,
    pickup: raw.pickup ?? false,
    delivery: raw.delivery ?? false,
    promotion:
      typeof raw.promotion === "number" && Number.isFinite(raw.promotion)
        ? raw.promotion
        : 0,
  };
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

/**
 * Every place on Mesita — no paste, no query. Mesita Search's All places
 * button. The EF walks the whole catalog server-side and ships `total`
 * beside the rows, so a run that hits its ceiling can say so instead of
 * reading as a short catalog.
 */
export async function listAllPlaces(): Promise<
  Result<{ places: PlaceHit[]; total: number }>
> {
  const r = await efInvoke<{ places: RawPlaceHit[]; total?: number | null }>(
    "admin-web-search-places",
    { all: true },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const places = (r.data.places ?? []).map(normalizePlaceHit);
  return {
    ok: true,
    data: {
      places,
      total: typeof r.data.total === "number" ? r.data.total : places.length,
    },
  };
}

// One menu / catalog entry under products.menu (and legacy menus).
export type AdminMenuItem = {
  name?: string | null;
  url?: string | null;
  items?: unknown[] | null;
  nutrition?: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null;
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
   * is) — it changes whenever the Google listing does. Enricher-only write.
   */
  google_name?: string | null;
  category: string | null;
  category_label: string | null;
  /** Families: Enricher-inferred (stored); membership derives live. */
  family_keys?: string[] | null;
  state: string | null;
  currency: string | null;
  // Catalog tier: "web" (listed) vs "partner" (Mesita partner). Separate from
  // ownership (place_members.role = owner) — see place-ownership.ts.
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
  /** Ghost-partner hold (MESITA-1311): a confirmed guest report closes the
   *  reward lane until restore. Null/absent = no hold. */
  reward_lane_pending_review_at?: string | null;
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
  // Stamped by the Enricher's final write — lets the Meta box attribute
  // updated_at to the AI (≈ same instant) vs a human edit (later).
  enriched_at: string | null;
  // On-Update embeddings (MESITA-720) — human blurb + vector; super-admin
  // overview only. Tags are never part of the source text.
  embedding?: string | number[] | null;
  embedding_source_hash?: string | null;
  embedding_source_text?: string | null;
  name_embedding?: string | number[] | null;
  name_embedding_hash?: string | null;
  // ── State, super-admin overview only (MESITA-1186) ───────────────────────
  // Computed by business-web-get-overview off _shared/place-state.ts — the
  // same helpers admin-web-search-places uses for the Single Place table, so
  // the box and the table can never disagree. Absent (undefined) means the
  // payload predates them; the box renders "?" rather than a false "no".
  /** google_place_id present — the identity spine every enrichment run needs. */
  seeded?: boolean;
  /** places.state ∈ (active, lead) — a guest can reach the place at all. */
  listed?: boolean;
  /** Derived has-demand for filters. State chip is request_count. */
  requested?: boolean;
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
  /** Per Enrich subfunction (1–10). Overview payload only. */
  enrich_functions?: Record<string, {
    state: "pending" | "completed" | "failed";
    at: string | null;
    detail: string | null;
  }> | null;
  /** Enricher lifecycle on the place row. Overview already carries this. */
  content_state?: string | null;
  /** Google's own id. Admin payload only — never in PLACE_PUBLIC_COLUMNS. */
  google_place_id?: string | null;
  /** places.mesita_pay_enabled — acceptance intent bit, read via the places
   *  side-read (never through profiles). Absent = older payload → "?". */
  mesita_pay_enabled?: boolean;
  /** places.credits_enabled — same contract as mesita_pay_enabled. */
  credits_enabled?: boolean;
  /** places.pickup_orders_enabled — order-rail intent bit, same contract. */
  pickup_orders_enabled?: boolean;
  /** places.delivery_orders_enabled — order-rail intent bit, same contract. */
  delivery_orders_enabled?: boolean;
  [k: string]: unknown;
};
/** The place PLUS whether this caller is a super-admin. get-overview already
 *  ships the flag (index.ts:332); the Admin tab is gated on it, so a
 *  restaurant never sees the operator internals (autoplan D1, 2026-09-06). */
export async function getPlaceAndRole(
  placeId: string,
): Promise<Result<{ place: AdminPlace; isSuperAdmin: boolean }>> {
  const r = await efInvoke<{
    active: { place: AdminPlace } | null;
    isSuperAdmin?: boolean;
  }>("business-web-get-overview", { placeId, ticketsLimit: 0 });
  if (!r.ok) return { ok: false, error: r.error };
  const place = r.data.active?.place ?? null;
  if (!place || place.id !== placeId) {
    return { ok: false, error: "Place not found or not loadable." };
  }
  return {
    ok: true,
    data: { place, isSuperAdmin: r.data.isSuperAdmin === true },
  };
}

// ── Place / Promos: write place fields ───────────────────────────────────

export async function updatePlace(
  patch: Record<string, unknown> & { id: string },
): Promise<Result<AdminPlace>> {
  const r = await efInvoke<{ place: AdminPlace }>("business-web-update-place", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.place };
}

// Plan is billing, not profile: business-web-update-place rejects any body
// carrying a `plan` key. The operator's door is `business-web-set-partnership`
// (MESITA-1740): join writes plan=pro internally, drop writes free, and
// a client-chosen `plan` is refused. `rates` ride along on purpose
// (MESITA-818/912) — the partnership and the strategy that justifies it are
// one atomic write.
export async function setPlacePlan(
  placeId: string,
  plan: PlanKey,
  rates?: Record<string, number | null>,
): Promise<Result<AdminPlace>> {
  const action = plan === "free" ? "drop" : "join";
  const r = await efInvoke<{ place: AdminPlace }>(
    "business-web-set-partnership",
    {
      placeId,
      action,
      ...(rates ?? {}),
    },
  );
  // `code` RIDES ALONG, like the two Connect actions above it. The join door
  // 409s `place_not_partnered` when the place has no live Mesita Membership
  // behind it (MESITA-1889), and `rejoinFailure` branches on exactly that code
  // to say so instead of "try again". Dropping it here type-checked — the
  // failure arm's `code` is optional — and made that branch permanently
  // unreachable: `r.code` was `undefined` at every call site, so the one
  // refusal a second press cannot fix printed the retry sentence anyway.
  if (!r.ok) return { ok: false, error: r.error, code: r.code };
  return { ok: true, data: r.data.place };
}
/** List or unlist the place on Mesita — the ONLY write path to
 *  places.state, which is what the consumer RLS policy
 *  places_select_public_visible gates every guest read on. Unlisting removes
 *  the place from browse, search, the swipe deck and any shared link at once.
 *  business-web-update-place does not accept `state`, so this is its own
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
      // Stamp state so mergePlace's withListedFromState sees paused after
      // Active off, even if an older place payload omitted it.
      state: r.data.state ?? r.data.place.state,
    },
  };
}
export type MesitaPlaceReview = {
  id: string;
  food: number;
  service: number;
  ambience: number;
  value: number | null;
  overall: number | null;
  comments: string | null;
  createdAt: string;
  ticketId: string;
  guestName: string;
  /** check.mesita.ai link — editor/owner only; viewers get null from the EF. */
  visitUrl: string | null;
};

export async function getPlaceReviews(
  placeId: string,
  opts?: { limit?: number; offset?: number },
): Promise<
  Result<{ reviews: MesitaPlaceReview[]; total: number }>
> {
  const r = await efInvoke<{
    reviews?: MesitaPlaceReview[];
    total?: number;
  }>("business-web-list-reviews", {
    placeId,
    limit: opts?.limit,
    offset: opts?.offset,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      reviews: r.data.reviews ?? [],
      total: r.data.total ?? 0,
    },
  };
}

// ── Atlas tag catalog (for Place tags picker) ────────────────────────────
// Same catalog Atlas Config reads, through the operator door
// (`business-web-get-atlas-fields` → public.place_tags).

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
  /** 1–2 place family parents (multi-parent law). */
  family_keys?: string[];
};

export type PlaceFamilyOption = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

type PlaceTagCatalog = {
  tags: PlaceTagOption[];
  facets: PlaceTagFacet[];
  categories: PlaceCategoryOption[];
  families: PlaceFamilyOption[];
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
    families?: PlaceFamilyOption[];
    fieldLimits?: Record<string, { max: number; note: string }>;
  }>("business-web-get-atlas-fields", {});
  if (!r.ok) return { ok: false, error: r.error };
  const fieldLimits = readPlaceFieldLimits(r.data.fieldLimits);
  return {
    ok: true,
    data: {
      tags: r.data.tags ?? [],
      facets: r.data.facets ?? [],
      categories: r.data.categories ?? [],
      families: r.data.families ?? [],
      tagsPerPlaceMax: fieldLimits.tagsPerPlaceMax,
      fieldLimits,
    },
  };
}

// ── Per-place Enricher inspector (admin-only) ────────────────────────────
// Internal enricher output for the Place editor: per-photo metadata for the
// ⓘ inspector (keyed by public_url, matches AdminPlace.photos[]) + the place's
// enrichment state. Super-admin gated EF.

export type PlaceMediaMeta = {
  source: string | null;
  state: string | null;
  analysis_text: string | null;
  caption: string | null;
  likes_count: number | null;
  source_url: string | null;
  // Raw per-source signals captured at gather time (pre-analysis): Instagram
  // carries comments_count / timestamp / is_video / shortcode; website carries
  // alt / page / width / height. Shape varies by source, hence unknown values.
  source_metadata: Record<string, unknown> | null;
};

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
export type PlaceEnrichmentSchedule = {
  everyDays: number | null;
  mode: ReenrichMode;
  nextAt: string | null;
  lastEnrichedAt: string | null;
};

type PlaceEnrichment = {
  media: Record<string, PlaceMediaMeta>;
  state: PlaceEnrichmentState | null;
  schedule: PlaceEnrichmentSchedule | null;
};

export async function getPlaceEnrichment(
  placeId: string,
): Promise<Result<PlaceEnrichment>> {
  const r = await efInvoke<{
    media: Record<string, PlaceMediaMeta>;
    state: PlaceEnrichmentState | null;
    schedule: PlaceEnrichmentSchedule | null;
  }>(
    "admin-web-get-place-enrichment",
    // Wire key stays `projectId` — this EF's MESITA-26 alias base.
    { projectId: placeId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    data: {
      media: r.data.media ?? {},
      state: r.data.state ?? null,
      schedule: r.data.schedule ?? null,
    },
  };
}
// Which slice of the Enricher pipeline a manual re-enrich re-runs:
//   full     → research + analysis + contents (fresh gather; refreshes phone)
//   analysis → analysis + contents, reusing stored gathered (no re-gather)
//   contents → contents only, reusing stored gathered + analysis (cheapest)
// The lighter modes need a prior full run; the EF rejects (422) otherwise.
export type ReenrichMode = "full" | "analysis" | "contents";

// Manually re-run the Enricher pipeline for one place. Re-seeds place_research
// to the stage implied by `mode`; the cron poller takes it from there. Runs
// ASYNC — poll getPlaceEnrichment to watch progress.
export async function enrichPlace(
  placeId: string,
  mode: ReenrichMode = "full",
): Promise<Result<true>> {
  // Wire key stays `projectId` — admin-web-enrich-place's MESITA-26 alias.
  const r = await efInvoke<{ enrichmentTriggered: boolean }>(
    "admin-web-enrich-place",
    { projectId: placeId, mode },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: true };
}
