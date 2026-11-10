// Supabase Edge Function — eleven-a4-find-reservation (vendor caller)
//
// Caller = eleven-a4: the business INBOUND line. Finds reservations at the
// CALLER'S OWN place by the guest's NAME — the primary lookup key on a phone
// call ("la reservación de Ana López"); the 8-digit code is secondary and the
// agent reads it from these results, the caller never needs to say it:
//
//   { caller_phone, guest_name }
//
// Scope is re-verified server-side: the calling line must belong to the place
// (places.phone or the reservation_target endpoint), and only that place's
// book is searched. Matching is accent-insensitive, every spoken word must
// appear in the guest's name. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a4-find-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  phoneTail,
  placeByCallerLine,
  speakable,
  ticketMatchesGuestName,
  ticketsOfPlace,
} from "../_shared/agent-tools.ts";

serveJson("eleven-a4-find-reservation", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ caller_phone?: unknown; guest_name?: unknown }>(req, {});
  const tail = phoneTail(body.caller_phone);
  if (tail.length < 10) {
    return json({ ok: true, verified: false, reason: "caller number unavailable" });
  }
  const query = typeof body.guest_name === "string" ? body.guest_name.trim() : "";
  if (!query) return json({ ok: false, error: "guest_name required" }, 400);

  const place = await placeByCallerLine(admin, tail);
  if (!place) {
    return json({ ok: true, verified: false, reason: "no Mesita place with this number" });
  }

  // Wide window, then name-filter in JS — a place's near-term book is small.
  const book = await ticketsOfPlace(admin, place.id, 30);
  const found = book.filter((t) => ticketMatchesGuestName(t, query)).slice(0, 8);

  return json({
    ok: true,
    verified: true,
    place: { name: place.name ?? "(sin nombre)" },
    found: found.length > 0,
    tickets: found.map((t) => speakable(t, place.name ?? "")),
  });
});
