// Supabase Edge Function — eleven-a2-confirm-reservation (vendor caller)
//
// Caller = eleven-a2: the b2c OUTBOUND Confirmer — the agent leg that calls
// the human guest. Records the guest's answer and DRIVES THE NEGOTIATION LOOP:
//
//   { reference_code, new_date?: "YYYY-MM-DD", new_time?: "HH:mm", note? }
//
// Plain acceptance → guest_confirmed_at stamps (both-sides-confirmed when the
// venue already said yes). A datetime — the guest picking one of the venue's
// alternatives OR proposing something entirely new ("mejor mañana a las 9") —
// moves reserved_at, returns the ticket to pending and RE-FIRES the Booker
// (supabase-edgefunc-reservation-call) so the venue gets the follow-up call:
// consumer ⇒ agent ⇒ business, double calls until both sides match. Partial
// input is fine — a missing date or time defaults from the current reservation.
// Capped at 2 negotiation rounds; past the cap the ticket parks in-app
// (parked: true) instead of dialing again.
// Auth: anon bearer + x-agent-secret (see _shared/agent-tools.ts).
//
// Deploy: supabase functions deploy eleven-a2-confirm-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { invokeArtificialCaller } from "../_shared/internal.ts";
import {
  cleanNote,
  esDate,
  esTime,
  parseVenueLocal,
  requireAgentSecret,
  ticketByCode,
  venueLocalDate,
  venueLocalTime,
} from "../_shared/agent-tools.ts";

const MAX_NEGOTIATION_ROUNDS = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

  const body = await readJsonOr<{
    reference_code?: unknown;
    new_date?: unknown;
    new_time?: unknown;
    note?: unknown;
  }>(req, {});

  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);
  if (ticket.status === "cancelled") {
    return json({ ok: false, error: "this reservation is cancelled" }, 409);
  }

  const wantsChange = body.new_date !== undefined || body.new_time !== undefined;
  const note = cleanNote(body.note);

  // ── No change: the guest accepts what the venue confirmed ──────────────────
  if (!wantsChange) {
    const patch: Record<string, unknown> = {
      guest_confirmed_at: new Date().toISOString(),
    };
    if (note) patch.outcome_note = note;
    const { error } = await admin.from("reservations").update(patch).eq("id", ticket.id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({
      ok: true,
      guest_confirmed: true,
      changed: false,
      both_confirmed: ticket.status === "confirmed",
      reference_code: ticket.reference_code,
      date_es: esDate(ticket.reserved_at),
      time_es: esTime(ticket.reserved_at),
    });
  }

  // ── Change: alternative picked or a new proposal → new venue call ──────────
  // Partial input defaults from the current reservation (venue-local CDMX), so
  // "solo cambia la hora" works without the agent re-stating the date.
  const date = typeof body.new_date === "string" && body.new_date.trim()
    ? body.new_date
    : venueLocalDate(ticket.reserved_at);
  const time = typeof body.new_time === "string" && body.new_time.trim()
    ? body.new_time
    : venueLocalTime(ticket.reserved_at);
  const next = parseVenueLocal(date, time);
  if (!next) {
    return json({
      ok: false,
      error: "new_date must be YYYY-MM-DD and new_time HH:mm (venue-local)",
    }, 400);
  }

  const rounds = ticket.negotiation_rounds ?? 0;
  if (rounds >= MAX_NEGOTIATION_ROUNDS) {
    // Cap reached — note the wish, park in-app, no more calls this ticket.
    await admin.from("reservations").update({
      outcome_note:
        `parked after ${rounds} rounds — guest wants ${date} ${time}${note ? ` (${note})` : ""}`
          .slice(0, 300),
    }).eq("id", ticket.id);
    return json({
      ok: true,
      parked: true,
      changed: false,
      reference_code: ticket.reference_code,
      say:
        "Ya hicimos varios intentos con el restaurante; su petición queda anotada y Mesita le confirma por la app.",
    });
  }

  const patch: Record<string, unknown> = {
    reserved_at: next.toISOString(),
    // New terms — the venue hasn't agreed to them yet.
    status: "pending",
    reported_verdict: null,
    guest_confirmed_at: new Date().toISOString(),
    negotiation_rounds: rounds + 1,
  };
  if (note) patch.outcome_note = note;
  const { error } = await admin.from("reservations").update(patch).eq("id", ticket.id);
  if (error) return json({ ok: false, error: error.message }, 500);

  // The double call: fire the Booker at the venue with the new terms. The
  // engine acks early; its run updates the ticket as it goes.
  const fired = await invokeArtificialCaller(
    envRes.env,
    "eleven-a2-confirm-reservation",
    "supabase-edgefunc-reservation-call",
    { reservation_id: ticket.id },
  );

  return json({
    ok: true,
    guest_confirmed: true,
    changed: true,
    reference_code: ticket.reference_code,
    date_es: esDate(next.toISOString()),
    time_es: esTime(next.toISOString()),
    needs_new_venue_call: true,
    venue_call_started: fired.ok,
    round: rounds + 1,
  });
});
