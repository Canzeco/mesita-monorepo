"use server";

import { efInvoke } from "@/lib/supabase-ef";
import { createUnitFromPlaceId as createUnitFromPlaceIdImpl } from "@/lib/create-unit-from-place";

// ════════════════════════════════════════════════════════════════════════
// Single-unit console — a super-admin drives ANY place through the existing
// business-* edge functions. The operator's JWT email is in super_admins, so
// _shared/auth.ts (checkMembership / requireMembership / requireOwner) grants
// access regardless of project_members. No bespoke data EFs needed — only the
// place search below is admin-specific.
// ════════════════════════════════════════════════════════════════════════

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

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
};

/** @deprecated use UnitHit */
export type PlaceHit = UnitHit;

async function fetchUnits(query: string, limit = 50): Promise<Result<UnitHit[]>> {
  const r = await efInvoke<{ places: UnitHit[] }>("admin-web-search-places", {
    query,
    limit,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.places };
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
export async function searchPlaces(query: string): Promise<Result<UnitHit[]>> {
  return searchUnits(query);
}

// The full place row, loaded for a super-admin via business-get-overview
// (which returns the single requested place when the caller is super-admin).
// Typed loosely — the editor only touches the known fields below.
export type AdminPlace = {
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

// ── Per-photo Enricher metadata (admin-only) ─────────────────────────────
// Internal enricher output for the Place gallery ⓘ inspector, keyed by the
// image's public_url (matches AdminPlace.photos[]). Super-admin gated EF.

export type PlaceMediaMeta = {
  source: string | null;
  status: string | null;
  analysis_text: string | null;
  caption: string | null;
  likes_count: number | null;
  source_url: string | null;
};

export async function getPlaceMedia(
  projectId: string,
): Promise<Result<Record<string, PlaceMediaMeta>>> {
  const r = await efInvoke<{ media: Record<string, PlaceMediaMeta> }>(
    "admin-web-get-place-media",
    { projectId },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data.media ?? {} };
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

export async function listTeam(projectId: string): Promise<Result<TeamSnapshot>> {
  const r = await efInvoke<TeamSnapshot>("business-web-list-team", { placeId: projectId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
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
  kind: "editor" | "waiter" | "editorInvite" | "waiterInvite",
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-web-remove-member", { id, kind });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ── Scan / tickets ───────────────────────────────────────────────────────

export type AdminTicket = {
  id: string;
  kind: string;
  status: string;
  story_status?: string | null;
  consumer: { code?: string | null; full_name?: string | null; class_key?: string | null } | null;
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
  projectId: string,
  limit = 100,
): Promise<Result<AdminTicket[]>> {
  const r = await efInvoke<{ tickets: AdminTicket[] } | AdminTicket[]>(
    "business-web-list-tickets",
    { placeId: projectId, limit },
  );
  if (!r.ok) return { ok: false, error: r.error };
  const tickets = Array.isArray(r.data)
    ? r.data
    : ((r.data as { tickets?: AdminTicket[] }).tickets ?? []);
  return { ok: true, data: tickets };
}

export async function markTicketPaid(ticketId: string): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-web-mark-ticket-paid", { ticketId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export async function cancelTicket(
  ticketId: string,
  reason?: string,
): Promise<Result<unknown>> {
  const r = await efInvoke<unknown>("business-web-cancel-ticket", { ticketId, reason });
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

export type FindPlaceResult =
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
