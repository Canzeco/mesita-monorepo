// Supabase Edge Function — eleven-inbound-identify-caller (vendor caller)
//
// Caller = the inbound reservation agent (fleet key a3): anyone phones
// Mesita's one number. THE GATE for every inbound conversation (MESITA-3974):
// who is calling is the caller id the platform fills in
// ({{system__caller_id}}), never what the caller says. One lookup in places
// (their phone or Reservations phone) and guests (consumers.phone):
//
//   { caller_phone, expect? }  →  { kind: "place" | "guest" | "both", place?, guest? }
//
//   place  the place, its notes (MESITA-3955) and its upcoming book; a line
//          a restaurant group shares answers for all its places at once
//          (names joined, each ticket names its place, MESITA-4143)
//   guest  the account holder and their newest reservations
//   both   one number is a place's line AND a guest's account: the agent asks
//          which one they call about
// `expect` (MESITA-4022) lets the graph, not the LLM, pick the lane: the
// workflow calls this twice as two tools with a constant expect —
// inbound_identify_place ("place": 404 unless the number is a place's line)
// and, on that failure, inbound_identify_guest ("guest": 404 unless it is a
// guest's account). Without expect, any match answers 200.
// An unknown number answers 404, so the workflow's failure edge takes the
// unknown lane (the old verify functions answered 200 for an unknown caller,
// so that lane never ran).
//
// Matching is by the last 10 digits (+52 / +521 / bare compare equal), and a
// place's stored number may carry spaces (placesByCallerLine).
// Replaces eleven-a3-verify-caller and eleven-a4-verify-caller.
// Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-inbound-identify-caller

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  guestName,
  lineName,
  phoneTail,
  placesByCallerLine,
  placeNames,
  sameLine,
  speakable,
  ticketsOfConsumers,
  ticketsOfPlace,
} from "../_shared/agent-tools.ts";
import { placeZone } from "../_shared/local-time.ts";
import { loadPlaceNotes, notesForCall } from "../_shared/place-notes.ts";

serveJson("eleven-inbound-identify-caller", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ caller_phone?: unknown; expect?: unknown }>(req, {});
  const expect = body.expect === "place" || body.expect === "guest" ? body.expect : null;
  const tail = phoneTail(body.caller_phone);
  if (tail.length < 10) {
    return json({ ok: false, kind: "unknown", reason: "caller number unavailable" }, 404);
  }

  // ── A place's line (one place, or a group's shared desk) ──────────────────
  const linePlaces = await placesByCallerLine(admin, tail);
  let place: Record<string, unknown> | null = null;
  if (linePlaces.length > 0) {
    const perPlace = await Promise.all(linePlaces.map(async (p) => ({
      p,
      notes: notesForCall(await loadPlaceNotes(admin, p.id)),
      tickets: await ticketsOfPlace(admin, p.id, 8),
    })));
    const notes = perPlace.length === 1
      ? perPlace[0].notes
      : perPlace.filter((x) => x.notes).map((x) => `${x.p.name ?? ""}: ${x.notes}`).join(" · ");
    place = {
      name: lineName(linePlaces),
      notes,
      // Soonest first across the line's places; each names its place.
      tickets: perPlace
        .flatMap((x) => x.tickets.map((t) => ({ t, p: x.p })))
        .sort((a, b) => Date.parse(a.t.reserved_at) - Date.parse(b.t.reserved_at))
        .slice(0, 8)
        .map(({ t, p }) => speakable(t, p.name ?? "", placeZone(p))),
    };
  }

  // ── A guest's account ─────────────────────────────────────────────────────
  const { data: candidates, error } = await admin
    .from("consumers")
    .select("id, full_name, first_name, last_name, phone")
    .ilike("phone", `%${tail}%`)
    .limit(10);
  if (error) return json({ ok: false, error: `guest lookup failed: ${error.message}` }, 500);
  type C = { id: string; full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null };
  const matches = ((candidates ?? []) as C[]).filter((c) => sameLine(c.phone, tail));
  let guest: Record<string, unknown> | null = null;
  if (matches.length > 0) {
    const tickets = await ticketsOfConsumers(admin, matches.map((m) => m.id), 5);
    const names = await placeNames(admin, [...new Set(tickets.map((t) => t.project_id))]);
    guest = {
      name: guestName(matches[0], "(sin nombre)"),
      first_name: matches[0].first_name ?? "",
      tickets: tickets.map((t) =>
        speakable(t, names.get(t.project_id)?.name ?? "", names.get(t.project_id)?.zone ?? placeZone(null))
      ),
    };
  }

  if (!place && !guest) {
    return json({ ok: false, kind: "unknown", reason: "no Mesita place or account with this number" }, 404);
  }
  if (expect === "place" && !place) {
    return json({ ok: false, kind: "guest", reason: "this number is not a Mesita place's line" }, 404);
  }
  if (expect === "guest" && !guest) {
    return json({ ok: false, kind: "place", reason: "this number is not a Mesita account" }, 404);
  }
  const kind = place && guest ? "both" : place ? "place" : "guest";
  return json({ ok: true, kind, ...(place ? { place } : {}), ...(guest ? { guest } : {}) });
});
