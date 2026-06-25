"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ════════════════════════════════════════════════════════════════════════
// Single-unit console — a super-admin drives ANY venue through the existing
// business-* edge functions. The operator's JWT email is in super_admins, so
// _shared/auth.ts (checkMembership / requireMembership / requireOwner) grants
// access regardless of venue_members. No bespoke data EFs needed — only the
// venue search below is admin-specific.
// ════════════════════════════════════════════════════════════════════════

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Venue search + load ──────────────────────────────────────────────────

export type UnitHit = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  category_label: string | null;
  status: string | null;
  address: string | null;
  photo: string | null;
};

/** @deprecated use UnitHit */
export type VenueHit = UnitHit;

async function fetchUnits(query: string, limit = 50): Promise<Result<UnitHit[]>> {
  const r = await efInvoke<{ venues: UnitHit[] }>("admin-search-places", {
    query,
    limit,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.venues };
}

export async function listUnits(): Promise<Result<UnitHit[]>> {
  return fetchUnits("");
}

export async function searchUnits(query: string): Promise<Result<UnitHit[]>> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { ok: true, data: [] };
  return fetchUnits(q);
}

/** @deprecated use searchUnits */
export async function searchVenues(query: string): Promise<Result<UnitHit[]>> {
  return searchUnits(query);
}

// The full venue row, loaded for a super-admin via business-get-overview
// (which returns the single requested venue when the caller is super-admin).
// Typed loosely — the editor only touches the known fields below.
export type AdminVenue = {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  category_label: string | null;
  status: string | null;
  currency: string | null;
  address: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  hours: Record<string, { open: string; close: string }[]> | null;
  photos: string[] | null;
  tags: string[] | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  whatsapp_url: string | null;
  google_maps_url: string | null;
  opentable_url: string | null;
  uber_eats_url: string | null;
  tripadvisor_url: string | null;
  menu_pdf_url: string | null;
  menu_pdf_name: string | null;
  plan: string | null;
  fiscal_type: string | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
  updated_at: string | null;
  [k: string]: unknown;
};

export async function getVenue(venueId: string): Promise<Result<AdminVenue>> {
  const r = await efInvoke<{ active: { venue: AdminVenue } | null }>(
    "business-get-overview",
    { activeUnitId: venueId, ticketsLimit: 0 },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const venue = r.data.active?.venue ?? null;
  if (!venue) return { ok: false, error: "Venue not found or not loadable." };
  return { ok: true, data: venue };
}

// ── Place / Promos: write venue fields ───────────────────────────────────

export async function updateVenue(
  patch: Record<string, unknown> & { id: string },
): Promise<Result<AdminVenue>> {
  const r = await efInvoke<{ venue: AdminVenue }>("business-update-unit", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.venue };
}

// ── Team ─────────────────────────────────────────────────────────────────

export type TeamSnapshot = {
  myRole: string | null;
  businesses: {
    memberId: string;
    userId: string;
    role: string;
    fullName: string | null;
    email: string | null;
    createdAt: string;
  }[];
  waiters: { userId: string; phone: string | null; createdAt: string }[];
  pendingBusinessInvites: {
    id: string;
    email: string;
    role: string;
    token: string;
    createdAt: string;
    expiresAt: string;
  }[];
  pendingWaiterInvites: {
    id: string;
    phone: string | null;
    channel: string;
    token: string;
    createdAt: string;
    expiresAt: string;
  }[];
};

export async function listTeam(venueId: string): Promise<Result<TeamSnapshot>> {
  const r = await efInvoke<TeamSnapshot>("business-list-team", { venueId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function inviteEditor(
  venueId: string,
  email: string,
  role: string,
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-invite-business", { venueId, email, role });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function updateMemberRole(
  memberId: string,
  role: string,
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-update-member-role", { memberId, role });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function removeMember(
  id: string,
  kind: "editor" | "waiter" | "editorInvite" | "waiterInvite",
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-remove-member", { id, kind });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ── Scan / tickets ───────────────────────────────────────────────────────

export type AdminTicket = {
  id: string;
  kind: string;
  status: string;
  story_status?: string | null;
  consumer: { code?: string | null; full_name?: string | null; tier_key?: string | null } | null;
  check_subtotal_cents: number | null;
  total_cents: number | null;
  discount_cents: number | null;
  discount_percent: number | null;
  currency: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
};

export async function listTickets(
  venueId: string,
  limit = 100,
): Promise<Result<AdminTicket[]>> {
  const r = await efInvoke<{ tickets: AdminTicket[] } | AdminTicket[]>(
    "business-list-tickets",
    { venueId, limit },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const tickets = Array.isArray(r.data)
    ? r.data
    : ((r.data as { tickets?: AdminTicket[] }).tickets ?? []);
  return { ok: true, data: tickets };
}

export async function markTicketPaid(ticketId: string): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-mark-ticket-paid", { ticketId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function cancelTicket(
  ticketId: string,
  reason?: string,
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-cancel-ticket", { ticketId, reason });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// Default business web origin used when the env var isn't set on Vercel —
// production lives at business.mesita.ai today. Override per environment by
// setting BUSINESS_WEB_URL.
const BUSINESS_WEB_URL_FALLBACK = "https://business.mesita.ai";

type FoundVenue = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type EFResponse = { venue: FoundVenue | null };

export type FindVenueResult =
  | {
      ok: true;
      found: true;
      venue: FoundVenue;
      link: string;
    }
  | { ok: true; found: false; placeId: string }
  | { ok: false; error: string };

export async function findVenueByPlaceId(
  rawPlaceId: string,
): Promise<FindVenueResult> {
  const placeId = (rawPlaceId ?? "").trim();
  if (!placeId) {
    return { ok: false, error: "Paste a Google Place ID first." };
  }

  const result = await efInvoke<EFResponse>("admin-find-place", { placeId });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const venue = result.data.venue;
  if (!venue) {
    return { ok: true, found: false, placeId };
  }

  // Clean URL — the operator opens this in a fresh tab, the business web's
  // middleware sees no session and bounces through / (the auth surface)
  // if needed. Once signed in (as themselves, via Google), the
  // business-get-overview EF reads their JWT, finds their email in
  // super_admins, and grants venue access regardless of venue_members.
  const businessOrigin =
    (process.env.BUSINESS_WEB_URL ?? "").trim() || BUSINESS_WEB_URL_FALLBACK;
  const link = `${businessOrigin.replace(/\/$/, "")}/unit/${encodeURIComponent(venue.id)}/home`;
  return { ok: true, found: true, venue, link };
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

  const r = await efInvoke<{ predictions: PlacePrediction[] }>("admin-suggest-places", {
    input: q,
    sessionToken,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.predictions ?? [] };
}

type CreateUnitOk = {
  ok: true;
  venueId: string;
  name: string;
  slug: string | null;
  photoCount: number;
  enriched: boolean;
};

type CreateUnitResponse = {
  venue?: { id?: string; name?: string; slug?: string | null };
  enrichment?: { photoCount?: number; profileEnriched?: boolean };
};

export async function createUnitFromPlaceId(
  placeId: string,
): Promise<CreateUnitOk | { ok: false; error: string }> {
  const id = (placeId ?? "").toString().trim();
  if (!id) return { ok: false, error: "Empty Place ID" };

  const r = await efInvoke<CreateUnitResponse>("business-create-unit", { placeId: id });
  if (!r.ok) return { ok: false, error: r.error };

  const v = r.data.venue;
  if (!v?.id) return { ok: false, error: "No unit returned" };
  return {
    ok: true,
    venueId: v.id,
    name: v.name ?? "(unnamed)",
    slug: v.slug ?? null,
    photoCount: r.data.enrichment?.photoCount ?? 0,
    enriched: r.data.enrichment?.profileEnriched ?? false,
  };
}
