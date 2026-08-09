"use server";

import { efInvoke } from "@/lib/supabase-ef";
import { createUnitFromPlaceId as createUnitFromPlaceIdImpl } from "@/lib/create-unit-from-place";
import type { PlanKey } from "@/lib/business/plans";

// ════════════════════════════════════════════════════════════════════════
// Single-unit console — a super-admin drives ANY place through the existing
// business-* edge functions. The operator's JWT email is in super_admins, so
// _shared/auth.ts (checkMembership / requireMembership / requireOwner) grants
// access regardless of project_members. Two things need admin-specific EFs:
// the place search below, and setting `plan` (business-web-update-project
// rejects it — it's the paid door's field, so admin gets its own).
// ════════════════════════════════════════════════════════════════════════

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Place search + load ──────────────────────────────────────────────────

export type UnitHit = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  category_label: string | null;
  status: string | null;
  address: string | null;
  photo: string | null;
  zone: string | null;
  google_stars_overall: number | null;
  google_review_count: number | null;
  content_status: string | null;
  listing_type: string | null;
  /** content_status === "ready" */
  enriched: boolean;
  /** listing_type === "partner" */
  verified: boolean;
};

// The search EF only guarantees id/name — every other field may be absent,
// hence the defensive `?? null` normalization below.
type RawUnitHit = Pick<UnitHit, "id" | "name"> & Partial<Omit<UnitHit, "id" | "name">>;

async function fetchUnits(query: string, limit = 50): Promise<Result<UnitHit[]>> {
  const r = await efInvoke<{ places: RawUnitHit[] }>("admin-web-search-places", {
    query,
    limit,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: (r.data.places ?? []).map(normalizeUnitHit) };
}

function normalizeUnitHit(raw: RawUnitHit): UnitHit {
  const contentStatus = raw.content_status ?? null;
  const listingType = raw.listing_type ?? null;
  return {
    id: raw.id,
    slug: raw.slug ?? null,
    name: raw.name,
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
    enriched: raw.enriched ?? contentStatus === "ready",
    verified: raw.verified ?? listingType === "partner",
  };
}

export async function listUnits(): Promise<Result<UnitHit[]>> {
  return fetchUnits("");
}

export async function searchUnits(query: string): Promise<Result<UnitHit[]>> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, data: [] };
  return fetchUnits(q);
}

// One menu / catalog entry under products.menu (and legacy menus).
export type AdminMenuItem = {
  name?: string | null;
  url?: string | null;
  items?: unknown[] | null;
};

/** How the Reservationist reaches this place. Voice-only (MESITA-842): phone
 *  is the sole serving channel. Shape matches the Enricher's
 *  products.reservations = { channel, value }. */
export type ReservationChannel = "phone";
export type ReservationTarget = {
  channel: ReservationChannel;
  value?: string | null;
  fallbacks?: { channel: ReservationChannel; value?: string | null }[];
};

// The full place row, loaded for a super-admin via business-get-overview
// (which returns the single requested place when the caller is super-admin).
// Typed loosely — the editor only touches the known fields below.
export type AdminPlace = {
  id: string;
  slug: string | null;
  /** Mesita display name (editable). Empty/null ⇒ fall back to google_name. */
  name: string;
  /** Google Places displayName — Enricher spine; not admin-editable (MESITA-917). */
  google_name?: string | null;
  category: string | null;
  category_label: string | null;
  status: string | null;
  currency: string | null;
  // Catalog tier: "web" (listed) vs "partner" (verified partner). Separate from
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
  // Legacy (MESITA-377) — no longer edited; cleared when saving the selector.
  reservation_endpoint: string | null;
  reservation_contacts: unknown;
  uber_eats_url: string | null;
  menu_pdf_url: string | null;
  menu_pdf_name: string | null;
  // Generic products payload. Menus live under products.menu; reservation
  // contact target under products.reservations ({ channel, value }).
  products?: {
    menu?: AdminMenuItem[] | null;
    reservations?: ReservationTarget | null;
  } | null;
  // Legacy parallel array; prefer products.menu when present.
  menus?: AdminMenuItem[] | null;
  plan: string | null;
  fiscal_type: string | null;
  // Lineup MP subscore — operator priority [0,1], default 0.1 (super-admin set).
  manual_priority: number | null;
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
  // Stamped by the Enricher's final write — lets the Meta box attribute
  // updated_at to the AI (≈ same instant) vs a human edit (later).
  enriched_at: string | null;
  // On-Update embeddings (MESITA-720) — human blurb + vector; super-admin
  // overview only. Tags are never part of the source text.
  embedding?: string | number[] | null;
  embedding_source_hash?: string | null;
  embedding_source_text?: string | null;
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
// the old 409 `no_strategy` guard is retired; a 0% Verified Partner is
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
// public.place_tags). Manage Single Unit calls this EF via its own server
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
};

type PlaceTagCatalog = {
  tags: PlaceTagOption[];
  facets: PlaceTagFacet[];
  categories: PlaceCategoryOption[];
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
      tagsPerPlaceMax: fieldLimits.tagsPerPlaceMax,
      fieldLimits,
    },
  };
}

// ── Per-place Enricher inspector (admin-only) ────────────────────────────
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
};

type PlaceEnrichment = {
  media: Record<string, PlaceMediaMeta>;
  status: PlaceEnrichmentStatus | null;
};

export async function getPlaceEnrichment(
  projectId: string,
): Promise<Result<PlaceEnrichment>> {
  const r = await efInvoke<{
    media: Record<string, PlaceMediaMeta>;
    status: PlaceEnrichmentStatus | null;
  }>("admin-web-get-place-enrichment", { projectId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { media: r.data.media ?? {}, status: r.data.status ?? null } };
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
  const r = await efInvoke<TeamSnapshot>("business-web-list-team", { placeId: projectId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

/** Immutable email of who completed ownership verification (not team owners). */
type PlaceVerificationGlance = {
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
  const link = `${businessOrigin.replace(/\/$/, "")}/unit/${encodeURIComponent(place.id)}/home`;
  return { ok: true, found: true, place, link };
}

// ── Google Places autocomplete (create flow) ─────────────────────────────

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
};

export async function suggestPlaces(
  input: string,
  sessionToken: string,
): Promise<Result<PlacePrediction[]>> {
  const q = (input ?? "").trim();
  if (q.length < 2) return { ok: true, data: [] };
  if (!sessionToken.trim()) return { ok: false, error: "Missing session token" };

  const r = await efInvoke<{ predictions: PlacePrediction[] }>("admin-web-suggest-places", {
    input: q,
    sessionToken,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.predictions ?? [] };
}

// The create-unit pipeline is shared with the bulk creator — see the single
// canonical implementation in @/lib/create-unit-from-place.
export async function createUnitFromPlaceId(placeId: string) {
  return createUnitFromPlaceIdImpl(placeId);
}

// ── Check settings (MESITA-823 · MESITA-898) ─────────────────────────────
// The optional shared 6-digit staff PIN gating check-page WRITE actions, and
// the per-place "require bill amount" switch gating the close. Read: both
// ride on the active place from business-web-get-overview (owner /
// super-admin only — the columns are deliberately absent from projects_view).
// Write: one owner-gated EF, partial updates — each card sends only its key.

export async function setCheckPin(
  placeId: string,
  pin: string | null,
): Promise<Result<string | null>> {
  const r = await efInvoke<{ pin: string | null }>("business-web-set-check-pin", {
    placeId,
    pin,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.pin };
}

export async function setCheckRequireBill(
  placeId: string,
  requireBill: boolean,
): Promise<Result<boolean>> {
  const r = await efInvoke<{ requireBill: boolean }>(
    "business-web-set-check-pin",
    { placeId, requireBill },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.requireBill };
}
