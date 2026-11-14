// Supabase Edge Function — eleven-inbound-identify-caller (vendor caller)
//
// Caller = the inbound reservation agent (fleet key a3): anyone phones
// Mesita's one number. THE GATE for every inbound conversation (MESITA-3974):
// who is calling is the caller id the platform fills in
// ({{system__caller_id}}), never what the caller says. One lookup in places
// (their phone or Reservations phone) and guests (consumers.phone):
//
//   { caller_phone }  →  { kind: "place" | "guest" | "both", place?, guest? }
//
//   place  the place, its notes (MESITA-3955) and its upcoming book
//   guest  the account holder and their newest reservations
//   both   one number is a place's line AND a guest's account: the agent asks
//          which one they call about
// An unknown number answers 404, so the workflow's failure edge takes the
// unknown lane (the old verify functions answered 200 for an unknown caller,
// so that lane never ran).
//
// Matching is by the last 10 digits (+52 / +521 / bare compare equal).
// Replaces eleven-a3-verify-caller and eleven-a4-verify-caller.
// Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-inbound-identify-caller

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  guestName,
  phoneTail,
  placeByCallerLine,
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

  const body = await readJsonOr<{ caller_phone?: unknown }>(req, {});
  const tail = phoneTail(body.caller_phone);
  if (tail.length < 10) {
    return json({ ok: false, kind: "unknown", reason: "caller number unavailable" }, 404);
  }

  // ── A place's line ────────────────────────────────────────────────────────
  const placeRow = await placeByCallerLine(admin, tail);
  const place = placeRow
    ? {
      name: placeRow.name ?? "(sin nombre)",
      notes: notesForCall(await loadPlaceNotes(admin, placeRow.id)),
      tickets: (await ticketsOfPlace(admin, placeRow.id, 8)).map((t) =>
        speakable(t, placeRow.name ?? "", placeZone(placeRow))
      ),
    }
    : null;

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
  const kind = place && guest ? "both" : place ? "place" : "guest";
  return json({ ok: true, kind, ...(place ? { place } : {}), ...(guest ? { guest } : {}) });
});
