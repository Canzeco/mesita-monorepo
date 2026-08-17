// Shared implementation for the eleven-a1..a4 caller families — the FOUR
// Reservationist agents' mid-call server tools (plain webhook tools on the
// ElevenLabs agents; MCP deliberately unused). One agent = one caller prefix:
//
//   eleven-a1-*  c2b outbound — the Booker calls the venue for the guest
//   eleven-a2-*  b2c outbound — the Confirmer calls the human guest
//   eleven-a3-*  c inbound   — a consumer calls Mesita (support / cancel)
//   eleven-a4-*  b inbound   — a business calls Mesita (support / changes)
//
// Endpoints stay THIN — one capability per EF, auth + data shaping here.
// Auth (two locks, same as eleven-agent-get-reservation): gateway verify_jwt
// via the anon-key bearer, then `x-agent-secret` matched timing-safe against
// app_settings.agents_config.toolSecret (rotatable with SQL).
//
// Inbound scope rule: a3/a4 tools NEVER trust the LLM's claims — identity is
// re-derived server-side from the caller's phone number (the agent passes
// {{system__caller_id}}), and every mutation re-checks that the ticket
// belongs to that verified caller.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { EFEnv } from "./auth.ts";
import { json } from "./http.ts";
import { invokeInternalCaller } from "./internal.ts";
import { phoneDigits } from "./phone.ts";
import { timingSafeEqual } from "./timing-safe-equal.ts";

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Returns an error Response to send, or null when the secret checks out. */
export async function requireAgentSecret(
  req: Request,
  admin: SupabaseClient,
): Promise<Response | null> {
  const sent = (req.headers.get("x-agent-secret") ?? "").trim();
  const { data: settings } = await admin
    .from("app_settings")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  const expected =
    ((settings?.agents_config as Record<string, unknown> | null)?.toolSecret as
      | string
      | undefined)?.trim() ?? "";
  if (!expected || !sent || !timingSafeEqual(sent, expected)) {
    return json({ ok: false, error: "agent tool secret rejected" }, 401);
  }
  return null;
}

// ── Phone matching (inbound identity) ────────────────────────────────────────

/** Last 10 digits — MX numbers compare equal across +52 / +521 / bare forms. */
export function phoneTail(v: unknown): string {
  const digits = typeof v === "string" ? phoneDigits(v) : "";
  return digits.slice(-10);
}

export function sameLine(a: unknown, b: unknown): boolean {
  const ta = phoneTail(a);
  const tb = phoneTail(b);
  return ta.length === 10 && ta === tb;
}

// ── Speakable formatting ─────────────────────────────────────────────────────

export function esDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
export function esTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Place-local "YYYY-MM-DD" + "HH:mm" → Date (Mexico City, fixed UTC-6). */
export function parsePlaceLocal(date: unknown, time: unknown): Date | null {
  if (typeof date !== "string" || typeof time !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  if (!/^\d{2}:\d{2}$/.test(time.trim())) return null;
  const d = new Date(`${date.trim()}T${time.trim()}:00-06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @deprecated Use parsePlaceLocal. */
export const parseVenueLocal = parsePlaceLocal;

/** ISO instant → place-local "YYYY-MM-DD" (CDMX) — defaulting for partial changes. */
export function placeLocalDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** ISO instant → place-local "HH:mm" (CDMX, 24h). */
export function placeLocalTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** @deprecated Use placeLocalDate — kept for one-release import compatibility. */
export const venueLocalDate = placeLocalDate;
/** @deprecated Use placeLocalTime — kept for one-release import compatibility. */
export const venueLocalTime = placeLocalTime;

// ── Guest-name matching (the PRIMARY lookup key — the code is secondary) ─────

/** Lowercase + accent-strip so "López" matches "lopez". */
function nameKey(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * True when every word of the spoken query appears in the ticket's guest name
 * — "ana lopez" matches "Ana María López", "lopez" alone matches too.
 */
export function ticketMatchesGuestName(row: TicketRow, query: string): boolean {
  const guest = nameKey(guestNameOf(row));
  const words = nameKey(query).split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => guest.includes(w));
}

// ── Ticket reads ─────────────────────────────────────────────────────────────

const TICKET_SELECT =
  "id, run_id, reference_code, reserved_at, party_size, status, notes, is_test, project_id, consumer_id, reported_verdict, alternatives, guest_confirmed_at, negotiation_rounds, consumer:consumers(full_name, first_name, last_name, phone)";

export type TicketRow = {
  run_id: string | null;
  id: string;
  reference_code: string | null;
  reserved_at: string;
  party_size: number;
  status: string;
  notes: string | null;
  is_test: boolean;
  project_id: string;
  consumer_id: string;
  reported_verdict: string | null;
  alternatives: unknown;
  guest_confirmed_at: string | null;
  negotiation_rounds: number;
  consumer: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
};

function guestNameOf(r: TicketRow): string {
  const c = r.consumer;
  return c?.full_name?.trim() ||
    [c?.first_name, c?.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") ||
    "(sin nombre)";
}

export async function placeNames(
  admin: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("places").select("id, name").in("id", ids);
  return new Map<string, string>(
    ((data ?? []) as { id: string; name: string | null }[]).map(
      (p) => [p.id, p.name ?? "(sin nombre)"],
    ),
  );
}

/** The shape every agent tool speaks — es-MX ready. */
export function speakable(r: TicketRow, placeName: string) {
  return {
    reference_code: r.reference_code ?? null,
    guest_name: guestNameOf(r),
    place_name: placeName,
    date_es: esDate(r.reserved_at),
    time_es: esTime(r.reserved_at),
    reserved_at: r.reserved_at,
    party_size: r.party_size,
    status: r.status,
    notes: r.notes ?? null,
    is_test: !!r.is_test,
  };
}

/** Exact lookup by the 8-digit reference code (digits extracted from input). */
export async function ticketByCode(
  admin: SupabaseClient,
  codeRaw: unknown,
): Promise<TicketRow | null> {
  const digits = typeof codeRaw === "string" ? phoneDigits(codeRaw) : "";
  if (!/^\d{8}$/.test(digits)) return null;
  const { data } = await admin
    .from("reservations")
    .select(TICKET_SELECT)
    .eq("reference_code", digits)
    .maybeSingle();
  return (data ?? null) as TicketRow | null;
}

/** A verified consumer's newest tickets (is_test included — agent surface). */
export async function ticketsOfConsumers(
  admin: SupabaseClient,
  consumerIds: string[],
  limit = 5,
): Promise<TicketRow[]> {
  if (consumerIds.length === 0) return [];
  const { data } = await admin
    .from("reservations")
    .select(TICKET_SELECT)
    .in("consumer_id", consumerIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  // supabase-js types an embedded to-one relation as an ARRAY, so the direct
  // cast is "insufficiently overlapping" (TS2352). The runtime shape is a
  // single object; go through unknown rather than widen TicketRow to a lie.
  return (data ?? []) as unknown as TicketRow[];
}

/** A verified place's book, soonest first from six hours ago. */
export async function ticketsOfPlace(
  admin: SupabaseClient,
  projectId: string,
  limit = 8,
): Promise<TicketRow[]> {
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await admin
    .from("reservations")
    .select(TICKET_SELECT)
    .eq("project_id", projectId)
    .gte("reserved_at", since)
    .order("reserved_at", { ascending: true })
    .limit(limit);
  // supabase-js types an embedded to-one relation as an ARRAY, so the direct
  // cast is "insufficiently overlapping" (TS2352). The runtime shape is a
  // single object; go through unknown rather than widen TicketRow to a lie.
  return (data ?? []) as unknown as TicketRow[];
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Cancel + owe the notice. `notice` names the side that must HEAR about it
 * (Docs › Reservations §B legs 5/6): 'venue_cancel' when the guest walks
 * away from a table the venue is holding, 'guest_cancel' when the venue calls
 * it off. null = nobody to tell (the ticket never got confirmed). The caller
 * then fires the engine with intent 'cancel_notice'; the retry cron is the
 * safety net for a notice left 'pending'.
 */
export async function cancelTicket(
  admin: SupabaseClient,
  id: string,
  by: "consumer" | "business" | "agent",
  reason: string,
  notice: "venue_cancel" | "guest_cancel" | null = null,
): Promise<string | null> {
  const { error } = await admin
    .from("reservations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: by,
      outcome_note: reason ? reason.slice(0, 300) : null,
      // A cancelled ticket must never wake again as a booking or a callback —
      // and rotating run_id ORPHANS any runner mid-flight: its guarded writes
      // die on the spot instead of racing this cancel (eng-review 2026-08-04).
      attempts_state: "cancelled",
      next_attempt_at: null,
      callback_state: "skipped",
      callback_next_attempt_at: null,
      run_id: crypto.randomUUID(),
      claimed_at: null,
      ...(notice
        ? { notice_kind: notice, notice_state: "pending", notice_attempts: 0, notice_next_at: null }
        : {}),
    })
    .eq("id", id);
  return error ? error.message : null;
}

export function cleanNote(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Fire-and-forget cancel-notice hop to `supabase-edgefunc-reservation-call`.
 * Callers that set notice_state='pending' via `cancelTicket` should invoke this
 * once; the reservation-retries cron is the safety net if the hop is lost.
 */
export async function fireCancelNotice(
  env: EFEnv,
  callerName: string,
  reservationId: string,
): Promise<void> {
  await invokeInternalCaller(
    env,
    callerName,
    "supabase-edgefunc-reservation-call",
    { reservation_id: reservationId, intent: "cancel_notice" },
  );
}
