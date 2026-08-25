// Supabase Edge Function — eleven-a2-confirm-reservation (vendor caller)
//
// Caller = eleven-a2: the b2c OUTBOUND Confirmer — the agent leg that calls
// the human guest. Records the guest's answer and DRIVES THE NEGOTIATION LOOP:
//
//   { reference_code, new_date?: "YYYY-MM-DD", new_time?: "HH:mm", note? }
//
// Plain acceptance → consumer_confirmed_at stamps (both-sides-confirmed when the
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
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";
import {
  matchesOffer,
  normalizeAlternatives,
} from "../_shared/reservation-alternatives.ts";
import {
  cleanNote,
  esDate,
  esTime,
  parsePlaceLocal,
  placeLocalDate,
  placeLocalTime,
  requireAgentSecret,
  ticketByCode,
} from "../_shared/agent-tools.ts";
import { type ReservationPatch, writeReservation } from "../_shared/reservation-doc.ts";
import { reminderParkPatch } from "../_shared/reservation-reminder.ts";

const MAX_NEGOTIATION_ROUNDS = 2;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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
    run_id?: unknown;
  }>(req, {});

  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);
  // Stale-run guard (eng-review 2026-08-04): run_id rides every outbound call
  // as a bound dynamic variable. A mismatch means this CALL belongs to an
  // orphaned run (the guest rescheduled/cancelled mid-call) — ignore the
  // write, tell the agent to wrap up gracefully.
  const callRunId = typeof body.run_id === "string" ? body.run_id.trim() : "";
  if (callRunId && ticket.run_id && callRunId !== ticket.run_id) {
    return json({
      ok: true,
      stale_run: true,
      ignored: true,
      say: "Esa reservación acaba de cambiar desde la app; Mesita le confirma los nuevos datos por ahí.",
    });
  }

  if (ticket.status === "cancelled") {
    return json({ ok: false, error: "this reservation is cancelled" }, 409);
  }

  const wantsChange = body.new_date !== undefined || body.new_time !== undefined;
  const note = cleanNote(body.note);

  // ── No change: the guest accepts what the venue confirmed ──────────────────
  if (!wantsChange) {
    const patch: ReservationPatch = {
      consumer_confirmed_at: new Date().toISOString(),
    };
    if (note) patch.outcome_note = note;
    const write = await writeReservation(admin, { mode: "update", id: ticket.id, patch });
    if (!write.ok) return json({ ok: false, error: write.error }, 500);
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
    : placeLocalDate(ticket.reserved_at);
  const time = typeof body.new_time === "string" && body.new_time.trim()
    ? body.new_time
    : placeLocalTime(ticket.reserved_at);
  const next = parsePlaceLocal(date, time);
  if (!next) {
    return json({
      ok: false,
      error: "new_date must be YYYY-MM-DD and new_time HH:mm (place-local)",
    }, 400);
  }

  // ── Did the guest just accept one of the venue's OWN offers? ─────────────
  // If so the venue has already said that slot is free — re-calling it to ask
  // for a slot it volunteered is a question that was answered a minute ago,
  // and calling the guest back afterwards reports news they gave us
  // themselves. That was 4 calls for one booking; this makes it 2. a1's
  // counter-offer close asks the venue to hold what it offered, so acting on
  // it here is a promise the venue already made, not an assumption.
  const offered = normalizeAlternatives(ticket.alternatives);
  if (matchesOffer(offered, date, time, placeLocalDate(ticket.reserved_at))) {
    const { data: placeRow } = await admin
      .from("places")
      .select("lng")
      .eq("id", ticket.project_id)
      .maybeSingle();
    const lng = typeof placeRow?.lng === "number" ? placeRow.lng : null;
    const nowIso = new Date().toISOString();
    const patch: ReservationPatch = {
      reserved_at: next.toISOString(),
      status: "confirmed",
      reported_verdict: "confirmed",
      confirmed_at: nowIso,
      consumer_confirmed_at: nowIso,
      next_attempt_at: null,
      attempts_state: "answered",
      // a2 is ON the phone with the guest right now — there is nothing left
      // to call them back about.
      callback_state: "skipped",
      callback_next_attempt_at: null,
      ...reminderParkPatch(lng, next, "call"),
      last_call_status: `guest took the venue's own ${date} ${time} offer — confirmed on the spot`,
    };
    if (note) patch.outcome_note = note;
    const confirm = await writeReservation(admin, { mode: "update", id: ticket.id, patch });
    if (!confirm.ok) return json({ ok: false, error: confirm.error }, 500);
    return json({
      ok: true,
      guest_confirmed: true,
      changed: true,
      confirmed_on_the_spot: true,
      both_confirmed: true,
      needs_new_venue_call: false,
      reference_code: ticket.reference_code,
      date_es: esDate(next.toISOString()),
      time_es: esTime(next.toISOString()),
      say:
        "Listo, esa opción ya la tenía apartada el restaurante: su mesa queda confirmada. No hace falta otra llamada.",
    });
  }

  const rounds = ticket.negotiation_rounds ?? 0;
  if (rounds >= MAX_NEGOTIATION_ROUNDS) {
    // Cap reached — note the wish, park in-app, no more calls this ticket.
    await writeReservation(admin, {
      mode: "update",
      id: ticket.id,
      patch: {
        outcome_note:
          `parked after ${rounds} rounds — guest wants ${date} ${time}${note ? ` (${note})` : ""}`
            .slice(0, 300),
      },
    });
    return json({
      ok: true,
      parked: true,
      changed: false,
      reference_code: ticket.reference_code,
      say:
        "Ya hicimos varios intentos con el restaurante; su petición queda anotada y Mesita le confirma por la app.",
    });
  }

  const patch: ReservationPatch = {
    reserved_at: next.toISOString(),
    // New terms — the venue hasn't agreed to them yet.
    status: "pending",
    reported_verdict: null,
    consumer_confirmed_at: new Date().toISOString(),
    negotiation_rounds: rounds + 1,
    callback_attempts: 0,
    callback_next_attempt_at: null,
    reminder_state: "idle",
    reminder_at: null,
  };
  if (note) patch.outcome_note = note;
  const write = await writeReservation(admin, { mode: "update", id: ticket.id, patch });
  if (!write.ok) return json({ ok: false, error: write.error }, 500);

  // The double call: fire the Booker at the venue with the new terms. The
  // engine acks early; its run updates the ticket as it goes.
  const fired = await invokeInternalCaller(
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
