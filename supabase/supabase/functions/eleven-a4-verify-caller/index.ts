// Supabase Edge Function — eleven-a4-verify-caller (vendor caller)
//
// Caller = eleven-a4: the business INBOUND line — a place phones Mesita to
// ask about or change bookings. THE GATE for every a4 conversation: verifies
// the caller by phone number against the place's lines (places.phone and the
// reservation_target endpoint) and returns the place plus its upcoming
// book, speakable:
//
//   { caller_phone }
//
// Businesses never call the consumer directly — they call the agent, and the
// agent relays. Matching is last-10-digits. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a4-verify-caller

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  phoneTail,
  placeByCallerLine,
  speakable,
  ticketsOfPlace,
} from "../_shared/agent-tools.ts";
import { placeZone } from "../_shared/local-time.ts";

serveJson("eleven-a4-verify-caller", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ caller_phone?: unknown }>(req, {});
  const tail = phoneTail(body.caller_phone);
  if (tail.length < 10) {
    return json({ ok: true, verified: false, reason: "caller number unavailable" });
  }

  const place = await placeByCallerLine(admin, tail);
  if (!place) {
    return json({ ok: true, verified: false, reason: "no Mesita place with this number" });
  }

  const tickets = await ticketsOfPlace(admin, place.id, 8);

  return json({
    ok: true,
    verified: true,
    place: { name: place.name ?? "(sin nombre)" },
    tickets: tickets.map((t) => speakable(t, place.name ?? "", placeZone(place))),
  });
});
