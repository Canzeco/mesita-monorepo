// Supabase Edge Function — eleven-a4-find-reservation (vendor caller)
//
// Caller = eleven-a3's place lane (a4 merged into a3, MESITA-3974). Finds a
// reservation at the CALLER'S OWN place by whatever the place says: the name
// it is under (misheard names welcome), the day, the hour, the party size
// (MESITA-3956, a forgiving search — _shared/reservation-search.ts). Returns
// the closest matches, best first; the agent reads the best one back to
// confirm. A dictated 8-digit code is looked up exactly, and only within the
// caller's place (MESITA-3622: another place's code reads as not found):
//
//   { caller_phone, guest_name?, date?, time?, party_size?, reference_code? }
//
// Scope is re-verified server-side: the calling line must belong to the place
// (places.phone or the reservation_target endpoint), and only that place's
// book is searched. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a4-find-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  lineName,
  phoneTail,
  placesByCallerLine,
  speakable,
  ticketByCode,
  ticketsOfPlace,
  type TicketRow,
} from "../_shared/agent-tools.ts";
import { placeZone } from "../_shared/local-time.ts";
import { rankTickets, type SearchClues } from "../_shared/reservation-search.ts";


serveJson("eleven-a4-find-reservation", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{
    caller_phone?: unknown;
    guest_name?: unknown;
    date?: unknown;
    time?: unknown;
    party_size?: unknown;
    reference_code?: unknown;
  }>(req, {});
  const tail = phoneTail(body.caller_phone);
  if (tail.length < 10) {
    return json({ ok: true, verified: false, reason: "caller number unavailable" });
  }
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const party = Number(body.party_size);
  const clues: SearchClues = {
    name: text(body.guest_name) || undefined,
    date: text(body.date) || undefined,
    time: text(body.time) || undefined,
    party_size: Number.isInteger(party) && party > 0 ? party : undefined,
  };
  const code = text(body.reference_code);
  if (!code && !clues.name && !clues.date && !clues.time && !clues.party_size) {
    return json({ ok: false, error: "a name, day, hour, party size or reference_code is required" }, 400);
  }

  // Every place on the caller's line: one, or a group's shared desk
  // (MESITA-4143). The line speaks for all of them.
  const places = await placesByCallerLine(admin, tail);
  if (places.length === 0) {
    return json({ ok: true, verified: false, reason: "no Mesita place with this number" });
  }
  const byId = new Map(places.map((p) => [p.id, p]));

  let found: TicketRow[];
  if (code) {
    // Another line's code reads as not found — never as "not yours".
    const t = await ticketByCode(admin, code);
    found = t && byId.has(t.place_id) ? [t] : [];
  } else {
    // Each place's book from six hours ago, ranked in its own zone (a place's
    // book is small, so rank it all in code), then merged best first.
    const now = new Date();
    const ranked = (await Promise.all(places.map(async (p) =>
      rankTickets(await ticketsOfPlace(admin, p.id, 300), clues, placeZone(p), now)
    ))).flat();
    found = ranked.sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.ticket);
  }

  return json({
    ok: true,
    verified: true,
    place: { name: lineName(places) },
    found: found.length > 0,
    // Best first: the agent reads tickets[0] back to confirm.
    tickets: found.map((t) => {
      const p = byId.get(t.place_id);
      return speakable(t, p?.name ?? "", placeZone(p));
    }),
  });
});
