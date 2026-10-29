// Shared implementation for the eleven-a1..a4 caller families — the FOUR
// Reservationist agents' mid-call server tools (plain webhook tools on the
// ElevenLabs agents; MCP deliberately unused). One agent = one caller prefix:
//
//   eleven-a1-*  c2b outbound — the Booker calls the place for the guest
//   eleven-a2-*  b2c outbound — the Confirmer calls the human guest
//   eleven-a3-*  c inbound   — a consumer calls Mesita (support / cancel)
//   eleven-a4-*  b inbound   — a business calls Mesita (support / changes)
//
// Endpoints stay THIN — one capability per EF, auth + data shaping here.
// Auth (two locks, same as eleven-agent-get-reservation): gateway verify_jwt
// via the anon-key bearer, then `x-agent-secret` matched timing-safe against
// app_config.agents_config.toolSecret (rotatable with SQL).
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
import { esDate, esTime } from "./es-speak.ts";
import { writeReservation } from "./reservation-doc.ts";
import { fromPlaceIdRow } from "./place-id.ts";
import { REMINDER_CLEAR } from "./reservation-reminder.ts";
import { timingSafeEqual } from "./timing-safe-equal.ts";
import { guestName } from "./reservation-guest-name.ts";

// The guest display name lives in a leaf (the engine needs it without this
// module); re-exported for the a1..a4 tools.
export { guestName };

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Returns an error Response to send, or null when the secret checks out. */
export async function requireAgentSecret(
  req: Request,
  admin: SupabaseClient,
): Promise<Response | null> {
  const sent = (req.headers.get("x-agent-secret") ?? "").trim();
  const { data: settings } = await admin
    .from("app_config")
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

/**
 * Stale-run guard (eng-review 2026-08-04): run_id rides every outbound call
 * as a bound dynamic variable. A mismatch means this CALL belongs to an
 * orphaned run (the guest rescheduled/cancelled mid-call) — ignore the
 * write, tell the agent to wrap up gracefully. Returns the reply to send, or
 * null when the call is current.
 */
export function staleRunReply(
  body: { run_id?: unknown },
  ticket: { run_id: string | null },
): Response | null {
  const callRunId = typeof body.run_id === "string" ? body.run_id.trim() : "";
  if (callRunId && ticket.run_id && callRunId !== ticket.run_id) {
    return json({
      ok: true,
      stale_run: true,
      ignored: true,
      say: "Esa reservación acaba de cambiar desde la app; Mesita le confirma los nuevos datos por ahí.",
    });
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

export type CallerPlace = {
  id: string;
  name: string | null;
  phone: string | null;
  reservation_target: string | null;
};

/**
 * The place whose line is calling (places.phone or the reservation_target
 * endpoint), matched on the last 10 digits. `tail` is the caller's
 * phoneTail; null when no place owns that line.
 */
export async function placeByCallerLine(
  admin: SupabaseClient,
  tail: string,
): Promise<CallerPlace | null> {
  const { data: candidates } = await admin
    .from("place_profiles")
    .select("id, name, phone, reservation_target")
    .or(`phone.ilike.%${tail}%,reservation_target.ilike.%${tail}%`)
    .limit(10);
  const matches = ((candidates ?? []) as CallerPlace[]).filter((p) =>
    sameLine(p.phone, tail) || sameLine(p.reservation_target, tail)
  );
  return matches[0] ?? null;
}

// ── Speakable formatting ─────────────────────────────────────────────────────

// Spoken es-MX formatting moved to ./es-speak.ts (a leaf — two EFs needed the
// wording without this module's Supabase client and ticket shapes). Still
// exported here: `speakable` below is built from them, and the a1..a4 tools
// import them from the module they already use.
export { esDate, esTime };

/** Place-local "YYYY-MM-DD" + "HH:mm" → Date (Mexico City, fixed UTC-6). */
export function parsePlaceLocal(date: unknown, time: unknown): Date | null {
  if (typeof date !== "string" || typeof time !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  if (!/^\d{2}:\d{2}$/.test(time.trim())) return null;
  const d = new Date(`${date.trim()}T${time.trim()}:00-06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  const guest = nameKey(guestName(row.consumer, "(sin nombre)"));
  const words = nameKey(query).split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => guest.includes(w));
}

// ── Ticket reads ─────────────────────────────────────────────────────────────

const TICKET_SELECT =
  "id, run_id, reference_code, reserved_at, party_size, state, notes, is_test, place_id, consumer_id, reported_verdict, alternatives, consumer_confirmed_at, negotiation_rounds, consumer:consumers(full_name, first_name, last_name, phone)";

export type TicketRow = {
  run_id: string | null;
  id: string;
  reference_code: string | null;
  reserved_at: string;
  party_size: number;
  state: string;
  notes: string | null;
  is_test: boolean;
  place_id: string;
  project_id: string;
  consumer_id: string;
  reported_verdict: string | null;
  alternatives: unknown;
  consumer_confirmed_at: string | null;
  negotiation_rounds: number;
  consumer: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
};

function asTicket(row: Record<string, unknown> | null): TicketRow | null {
  return (fromPlaceIdRow(row) as TicketRow | null) ?? null;
}

function asTickets(rows: unknown): TicketRow[] {
  return ((rows ?? []) as unknown[]).map((row) =>
    fromPlaceIdRow(row as Record<string, unknown>) as TicketRow
  );
}

/**
 * Place id → name. `fallback` stands in for a place with no name: the a3
 * tools say "(sin nombre)", eleven-agent-get-reservation sends "".
 */
export async function placeNames(
  admin: SupabaseClient,
  ids: string[],
  fallback = "(sin nombre)",
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("place_profiles").select("id, name").in("id", ids);
  return new Map<string, string>(
    ((data ?? []) as { id: string; name: string | null }[]).map(
      (p) => [p.id, p.name ?? fallback],
    ),
  );
}

/** The ticket fields `speakable` reads — a TicketRow, or a narrower row. */
export type SpeakableTicket =
  & Pick<TicketRow, "reference_code" | "reserved_at" | "party_size" | "state" | "notes" | "is_test">
  & {
    consumer: {
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };

/** The shape every agent tool speaks — es-MX ready. */
export function speakable(r: SpeakableTicket, placeName: string) {
  return {
    reference_code: r.reference_code ?? null,
    guest_name: guestName(r.consumer, "(sin nombre)"),
    place_name: placeName,
    date_es: esDate(r.reserved_at),
    time_es: esTime(r.reserved_at),
    reserved_at: r.reserved_at,
    party_size: r.party_size,
    state: r.state,
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
    .from("reservation_tickets")
    .select(TICKET_SELECT)
    .eq("reference_code", digits)
    .maybeSingle();
  return asTicket((data ?? null) as Record<string, unknown> | null);
}

/** A verified consumer's newest tickets (is_test included — agent surface). */
export async function ticketsOfConsumers(
  admin: SupabaseClient,
  consumerIds: string[],
  limit = 5,
): Promise<TicketRow[]> {
  if (consumerIds.length === 0) return [];
  const { data } = await admin
    .from("reservation_tickets")
    .select(TICKET_SELECT)
    .in("consumer_id", consumerIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  // supabase-js types an embedded to-one relation as an ARRAY, so the direct
  // cast is "insufficiently overlapping" (TS2352). The runtime shape is a
  // single object; go through unknown rather than widen TicketRow to a lie.
  return asTickets(data);
}

/** A verified place's book, soonest first from six hours ago. */
export async function ticketsOfPlace(
  admin: SupabaseClient,
  projectId: string,
  limit = 8,
): Promise<TicketRow[]> {
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await admin
    .from("reservation_tickets")
    .select(TICKET_SELECT)
    .eq("place_id", projectId)
    .gte("reserved_at", since)
    .order("reserved_at", { ascending: true })
    .limit(limit);
  // supabase-js types an embedded to-one relation as an ARRAY, so the direct
  // cast is "insufficiently overlapping" (TS2352). The runtime shape is a
  // single object; go through unknown rather than widen TicketRow to a lie.
  return asTickets(data);
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Cancel + owe the notice. `notice` names the side that must HEAR about it
 * (Docs › Reservations §B legs 5/6): 'place_cancel' when the guest walks
 * away from a table the place is holding, 'guest_cancel' when the place calls
 * it off. null = nobody to tell (the ticket never got confirmed). The caller
 * then fires the engine with intent 'cancel_notice'; the retry cron is the
 * safety net for a notice left 'pending'.
 */
export async function cancelTicket(
  admin: SupabaseClient,
  id: string,
  by: "consumer" | "business" | "agent",
  reason: string,
  notice: "place_cancel" | "guest_cancel" | null = null,
): Promise<string | null> {
  const res = await writeReservation(admin, {
    mode: "update",
    id,
    patch: {
      state: "cancelled",
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
      ...REMINDER_CLEAR,
      run_id: crypto.randomUUID(),
      claimed_at: null,
      ...(notice
        ? { notice_kind: notice, notice_state: "pending", notice_attempts: 0, notice_next_at: null }
        : {}),
    },
  });
  return res.ok ? null : res.error;
}

/**
 * The guest walks away from their own ticket — the tail the three guest-side
 * cancel doors share (app, a2 Confirmer, a3 inbound). A CONFIRMED table means
 * the place is holding it and must hear (Docs › Reservations §B leg 5);
 * pending tickets owe nothing. Fires the notice hop when one is owed. Each
 * caller shapes its own response from the result.
 */
export async function cancelAsGuest(
  admin: SupabaseClient,
  env: EFEnv,
  callerName: string,
  ticket: { id: string; state: string },
  reason: string,
): Promise<{ ok: true; placeNotified: boolean } | { ok: false; error: string }> {
  const notice = ticket.state === "confirmed" ? "place_cancel" as const : null;
  const err = await cancelTicket(admin, ticket.id, "consumer", reason, notice);
  if (err) return { ok: false, error: err };

  // Fire-and-forget: the engine acks early; a lost invoke is caught by the
  // retry cron, which sweeps notice_state='pending'.
  if (notice) await fireCancelNotice(env, callerName, ticket.id);
  return { ok: true, placeNotified: notice !== null };
}

export function cleanNote(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Fire-and-forget cancel-notice hop to `supabase-edgefunc-place-reservation-call`.
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
    "supabase-edgefunc-place-reservation-call",
    { reservation_id: reservationId, intent: "cancel_notice" },
  );
}
