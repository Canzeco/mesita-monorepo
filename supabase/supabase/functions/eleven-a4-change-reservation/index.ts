// Supabase Edge Function — eleven-a4-change-reservation (vendor caller)
//
// Caller = eleven-a3's place lane (a4 merged into a3, MESITA-3974). A place
// that calls Mesita's line about one of its CONFIRMED tables asks to move it
// to another time and/or another party size (MESITA-4073, Pato: a4 "can
// change the time or party size, not only cancel. The guest is told in the
// app and accepts the change."):
//
//   { caller_phone, reference_code, new_date?, new_time?, new_party_size?, reason? }
//
// new_date is YYYY-MM-DD and new_time HH:mm (24 h), both on the place's own
// clock; a missing one keeps the table's. Nothing moves yet: the ticket
// carries the proposal (change_*), the guest gets a Me › Notifications row
// and answers in the app (consumer-web-confirm-reservation). A decline or no
// answer keeps the original table and a1 tells the place
// (_shared/reservation-change.ts).
//
// Scope is re-verified server-side: the calling line must belong to the
// place, and another place's code reads as not found. Auth: anon bearer +
// x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a4-change-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import { cleanNote, esDate, esTime, phoneTail, placesByCallerLine, ticketByCode } from "../_shared/agent-tools.ts";
import { placeZone } from "../_shared/local-time.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import { judgeProposal, proposePatch } from "../_shared/reservation-change.ts";
import { notifyReservationOutcome } from "../_shared/reservation-notification.ts";

serveJson("eleven-a4-change-reservation", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{
    caller_phone?: unknown;
    reference_code?: unknown;
    new_date?: unknown;
    new_time?: unknown;
    new_party_size?: unknown;
    reason?: unknown;
  }>(req, {});

  const tail = phoneTail(body.caller_phone);
  // The caller's line may answer for several places (a group's shared desk,
  // MESITA-4143): the place in play is the one on that line that owns the
  // ticket; any other ticket stays not_found.
  const places = tail.length >= 10 ? await placesByCallerLine(admin, tail) : [];
  const ticket = places.length > 0 ? await ticketByCode(admin, body.reference_code) : null;
  const place = places.find((p) => p.id === ticket?.place_id) ?? places[0] ?? null;
  const zone = placeZone(place);
  const now = new Date();

  const verdict = judgeProposal(ticket, place?.id ?? null, body, zone, now);
  if (!verdict.ok) return json({ ok: false, code: verdict.code, error: verdict.error }, verdict.status);
  // judgeProposal answered not_found for a missing ticket.
  const t = ticket!;

  const write = await writeReservation(admin, {
    mode: "update",
    id: t.id,
    match: { state: "confirmed" },
    patch: proposePatch(verdict, cleanNote(body.reason), now),
    select: "id",
  });
  if (!write.ok) {
    // No row matched: the guest cancelled between the lookup and the write.
    if (write.code === "PGRST116") {
      return json({ ok: false, code: "not_confirmed", error: "this table is no longer confirmed" }, 409);
    }
    return json({ ok: false, error: write.error }, 500);
  }

  await notifyReservationOutcome(admin, {
    consumerId: t.consumer_id,
    reservationId: t.id,
    referenceCode: t.reference_code,
    outcome: "change_proposed",
    placeName: place?.name ?? null,
    placePhotos: place?.photos ?? null,
  });

  return json({
    ok: true,
    proposed: true,
    reference_code: t.reference_code,
    // What the place asked for, spoken, so a3 says it back once.
    new_date_es: verdict.next ? esDate(verdict.next.toISOString(), zone) : null,
    new_time_es: verdict.next ? esTime(verdict.next.toISOString(), zone) : null,
    new_party_size: verdict.partySize,
    guest_answers_in_app: true,
    if_declined: "the original table stands and Mesita calls the place to say so",
  });
});
