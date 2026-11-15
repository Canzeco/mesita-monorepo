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
//   { reservation_id: uuid, change: "accept" | "decline" }
//     — the guest's answer to a change the place asked for on a3's line
//       (MESITA-4073, _shared/reservation-change.ts): accept moves the table
//       on the spot; decline keeps the original and a1 tells the place.
//
// Deploy: supabase functions deploy consumer-web-confirm-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import {
  matchesOffer,
  normalizeAlternatives,
} from "../_shared/reservation-alternatives.ts";
import { fireCancelNotice, placeLocalDate } from "../_shared/agent-tools.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import {
  onTheSpotConfirmPatch,
  placeZoneOf,
  resolveRequestedSlot,
} from "../_shared/reservation-confirm.ts";
import { readOwnedTicket } from "../_shared/reservation-owned.ts";
import { acceptChangePatch, changeIsOpen, keepOriginalPatch } from "../_shared/reservation-change.ts";

type Body = {
  reservation_id?: string;
  new_date?: string;
  new_time?: string;
  change?: string;
};

serveJson("consumer-web-confirm-reservation", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, env, user } = ctx;
  const consumerId = user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (!body.reservation_id || typeof body.reservation_id !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }

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
    party_size: number;
    notice_state: string | null;
    change_state: string | null;
    change_reserved_at: string | null;
    change_party_size: number | null;
    change_expires_at: string | null;
  }>(
    admin,
    body.reservation_id,
    consumerId,
    "id, state, reserved_at, alternatives, consumer_confirmed_at, consumer_id, is_test, place_id, consumer_notify, party_size, notice_state, change_state, change_reserved_at, change_party_size, change_expires_at",
    { excludeTest: true },
  );
  if (loadErr) return json({ ok: false, error: loadErr }, 500);
  if (!ticket) {
    return json({ ok: false, error: "reservation not found" }, 404);
  }
  if (ticket.state === "cancelled") {
    return json({ ok: false, error: "this reservation is cancelled" }, 409);
  }

  // The guest answers the place's own change (MESITA-4073).
  if (body.change !== undefined) {
    if (body.change !== "accept" && body.change !== "decline") {
      return json({ ok: false, error: 'change must be "accept" or "decline"' }, 400);
    }
    const now = new Date();
    if (!changeIsOpen(ticket, now)) {
      return json({ ok: false, code: "change_not_open", error: "There is no change waiting for your answer." }, 409);
    }
    const accept = body.change === "accept";
    const notify: "call" | "app" = ticket.consumer_notify === "app" ? "app" : "call";
    const patch = accept
      ? acceptChangePatch(ticket, await placeZoneOf(admin, ticket.place_id), notify, now)
      : keepOriginalPatch("declined", ticket.notice_state, now);
    // Compare-and-swap on the open proposal: a double tap, or the cron
    // expiring it meanwhile, finds no row and answers 409.
    const write = await writeReservation(admin, {
      mode: "update",
      id: ticket.id,
      match: { consumer_id: consumerId, state: "confirmed", change_state: "proposed" },
      patch,
      select: "id",
    });
    if (!write.ok) {
      if (write.code === "PGRST116") {
        return json({ ok: false, code: "change_not_open", error: "There is no change waiting for your answer." }, 409);
      }
      return json({ ok: false, error: write.error }, 500);
    }
    // A decline owes the place one call: the original table stands.
    if (!accept && patch.notice_kind === "change_declined") {
      await fireCancelNotice(env, "consumer-web-confirm-reservation", ticket.id);
    }
    return json({ ok: true, change: accept ? "accepted" : "declined", changed: accept });
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

  // The place's offers are in its own clock (MESITA-3626).
  const zone = await placeZoneOf(admin, ticket.place_id);
  const { date, time, next } = resolveRequestedSlot(
    ticket.reserved_at,
    body.new_date,
    body.new_time,
    { trim: true },
    zone,
  );
  if (!next) {
    return json({
      ok: false,
      error: "new_date must be YYYY-MM-DD and new_time HH:mm (place-local)",
    }, 400);
  }

  const offered = normalizeAlternatives(ticket.alternatives);
  if (!matchesOffer(offered, date, time, placeLocalDate(ticket.reserved_at, zone))) {
    return json({
      ok: false,
      error: "That time isn't one of the place's offers. Pick an alternative or reschedule.",
    }, 400);
  }

  const guestNotify: "call" | "app" = ticket.consumer_notify === "app" ? "app" : "call";

  const confirm = await writeReservation(admin, {
    mode: "update",
    id: ticket.id,
    match: { consumer_id: consumerId, state: "pending" },
    patch: onTheSpotConfirmPatch({
      next,
      zone,
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
