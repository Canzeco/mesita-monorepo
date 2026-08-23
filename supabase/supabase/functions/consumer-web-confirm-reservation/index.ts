// Supabase Edge Function — consumer-web-confirm-reservation (product caller)
//
// Authenticated guest accepts the venue's confirmation, or picks one of the
// venue's structured alternatives, without an a2 phone call (MESITA-787
// app-only notify). Mirrors the accept / on-the-spot paths of
// eleven-a2-confirm-reservation under consumer ownership.
//
// Body:
//   { reservation_id: uuid }
//   { reservation_id: uuid, new_date?: "YYYY-MM-DD", new_time?: "HH:mm" }
//     — when date/time provided, must match a venue alternative (matchesOffer)
//
// Deploy: supabase functions deploy consumer-web-confirm-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  matchesOffer,
  normalizeAlternatives,
} from "../_shared/reservation-alternatives.ts";
import {
  parsePlaceLocal,
  placeLocalDate,
  placeLocalTime,
} from "../_shared/agent-tools.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";

type Body = {
  reservation_id?: string;
  new_date?: string;
  new_time?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (!body.reservation_id || typeof body.reservation_id !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }

  const admin = adminClient(envRes.env);
  const { data: ticket, error: loadErr } = await admin
    .from("reservation_tickets")
    .select(
      "id, status, reserved_at, alternatives, consumer_confirmed_at, consumer_id, is_test",
    )
    .eq("id", body.reservation_id)
    .maybeSingle();
  if (loadErr) return json({ ok: false, error: loadErr.message }, 500);
  if (!ticket || ticket.consumer_id !== consumerId || ticket.is_test) {
    return json({ ok: false, error: "reservation not found" }, 404);
  }
  if (ticket.status === "cancelled") {
    return json({ ok: false, error: "this reservation is cancelled" }, 409);
  }

  const wantsChange = body.new_date !== undefined || body.new_time !== undefined;

  // Accept the current slot (venue already confirmed, or ack app-only confirm).
  if (!wantsChange) {
    if (ticket.status !== "confirmed" && ticket.status !== "pending") {
      return json({ ok: false, error: "reservation is not open to confirm" }, 409);
    }
    const nowIso = new Date().toISOString();
    const write = await writeReservation(admin, {
      mode: "update",
      id: ticket.id,
      match: { consumer_id: consumerId },
      patch: {
        consumer_confirmed_at: nowIso,
        callback_state: "skipped",
        callback_next_attempt_at: null,
        last_call_status: "guest confirmed in the app",
      },
    });
    if (!write.ok) return json({ ok: false, error: write.error }, 500);
    return json({
      ok: true,
      guest_confirmed: true,
      changed: false,
      both_confirmed: ticket.status === "confirmed",
    });
  }

  // Pick a venue alternative — only when the ticket is still pending with offers.
  if (ticket.status !== "pending") {
    return json({
      ok: false,
      error: "alternatives can only be accepted on a pending counter-offer",
    }, 409);
  }

  const date = typeof body.new_date === "string" && body.new_date.trim()
    ? body.new_date.trim()
    : placeLocalDate(ticket.reserved_at);
  const time = typeof body.new_time === "string" && body.new_time.trim()
    ? body.new_time.trim()
    : placeLocalTime(ticket.reserved_at);
  const next = parsePlaceLocal(date, time);
  if (!next) {
    return json({
      ok: false,
      error: "new_date must be YYYY-MM-DD and new_time HH:mm (place-local)",
    }, 400);
  }

  const offered = normalizeAlternatives(ticket.alternatives);
  if (!matchesOffer(offered, date, time, placeLocalDate(ticket.reserved_at))) {
    return json({
      ok: false,
      error: "That time isn't one of the place's offers. Pick an alternative or reschedule.",
    }, 400);
  }

  const nowIso = new Date().toISOString();
  const confirm = await writeReservation(admin, {
    mode: "update",
    id: ticket.id,
    match: { consumer_id: consumerId, status: "pending" },
    patch: {
      reserved_at: next.toISOString(),
      status: "confirmed",
      reported_verdict: "confirmed",
      confirmed_at: nowIso,
      consumer_confirmed_at: nowIso,
      next_attempt_at: null,
      attempts_state: "answered",
      callback_state: "skipped",
      callback_next_attempt_at: null,
      last_call_status:
        `guest took the venue's own ${date} ${time} offer in the app — confirmed on the spot`,
    },
  });
  if (!confirm.ok) return json({ ok: false, error: confirm.error }, 500);

  return json({
    ok: true,
    guest_confirmed: true,
    changed: true,
    confirmed_on_the_spot: true,
    both_confirmed: true,
  });
});
