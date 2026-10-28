// Supabase Edge Function — consumer-web-confirm-reservation (product caller)
//
// Authenticated guest accepts the place's confirmation, or picks one of the
// place's structured alternatives, without an a2 phone call (MESITA-787
// app-only notify). Mirrors the accept / on-the-spot paths of
// eleven-a2-confirm-reservation under consumer ownership.
//
// Body:
//   { reservation_id: uuid }
//   { reservation_id: uuid, new_date?: "YYYY-MM-DD", new_time?: "HH:mm" }
//     — when date/time provided, must match a place alternative (matchesOffer)
//
// Deploy: supabase functions deploy consumer-web-confirm-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  matchesOffer,
  normalizeAlternatives,
} from "../_shared/reservation-alternatives.ts";
import { placeLocalDate } from "../_shared/agent-tools.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import {
  onTheSpotConfirmPatch,
  placeLng,
  resolveRequestedSlot,
} from "../_shared/reservation-confirm.ts";
import { readOwnedTicket } from "../_shared/reservation-owned.ts";

type Body = {
  reservation_id?: string;
  new_date?: string;
  new_time?: string;
};

serveJson("consumer-web-confirm-reservation", async (req) => {
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
  const { row: ticket, error: loadErr } = await readOwnedTicket<{
    id: string;
    state: string;
    reserved_at: string;
    alternatives: unknown;
    consumer_confirmed_at: string | null;
    consumer_id: string;
    is_test: boolean;
    place_id: string;
    consumer_notify: string | null;
  }>(
    admin,
    body.reservation_id,
    consumerId,
    "id, state, reserved_at, alternatives, consumer_confirmed_at, consumer_id, is_test, place_id, consumer_notify",
    { excludeTest: true },
  );
  if (loadErr) return json({ ok: false, error: loadErr }, 500);
  if (!ticket) {
    return json({ ok: false, error: "reservation not found" }, 404);
  }
  if (ticket.state === "cancelled") {
    return json({ ok: false, error: "this reservation is cancelled" }, 409);
  }

  const wantsChange = body.new_date !== undefined || body.new_time !== undefined;

  // Accept the current slot (place already confirmed, or ack app-only confirm).
  if (!wantsChange) {
    if (ticket.state !== "confirmed" && ticket.state !== "pending") {
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
        last_call_state: "guest confirmed in the app",
      },
    });
    if (!write.ok) return json({ ok: false, error: write.error }, 500);
    return json({
      ok: true,
      guest_confirmed: true,
      changed: false,
      both_confirmed: ticket.state === "confirmed",
    });
  }

  // Pick a place alternative — only when the ticket is still pending with offers.
  if (ticket.state !== "pending") {
    return json({
      ok: false,
      error: "alternatives can only be accepted on a pending counter-offer",
    }, 409);
  }

  const { date, time, next } = resolveRequestedSlot(
    ticket.reserved_at,
    body.new_date,
    body.new_time,
    { trim: true },
  );
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

  const lng = await placeLng(admin, ticket.place_id);
  const guestNotify: "call" | "app" = ticket.consumer_notify === "app" ? "app" : "call";

  const confirm = await writeReservation(admin, {
    mode: "update",
    id: ticket.id,
    match: { consumer_id: consumerId, state: "pending" },
    patch: onTheSpotConfirmPatch({
      next,
      lng,
      notify: guestNotify,
      lastCallState:
        `guest took the place's own ${date} ${time} offer in the app — confirmed on the spot`,
    }),
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
