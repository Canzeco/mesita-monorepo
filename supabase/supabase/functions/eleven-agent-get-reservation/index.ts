// Supabase Edge Function — eleven-agent-get-reservation (vendor caller)
//
// Naming: caller-verb-words. Caller = eleven-agent — the ElevenLabs
// Reservationist calling home MID-CONVERSATION as a server tool (webhook on the
// agent), the same vendor-caller family as stripe-webhook-* / twilio-*. This is
// how "connect ElevenLabs to Supabase" works in Mesita: the agent never touches
// the DB — it calls an EF, like every other client.
//
// Looks up a reservation ticket in REAL TIME on the ONE reservation_tickets table
// (sandbox retired 2026-07-27; is_test rows are included on purpose — the
// agent must resolve operator test calls too). ONE lookup key:
//   { reference_code }              — the 8-digit code (exact)
// The name search is gone (MESITA-3973): this tool serves a3's unknown-number
// lane, and a name let any caller hear another guest's table ("la reservación
// a nombre de Juan Pérez"). A known caller hears only their own tickets
// (a3_verify_caller); a place searches only its own (a4_find_reservation).
//
// Auth (two locks):
//   1. Gateway verify_jwt — the tool sends `Authorization: Bearer <anon key>`
//      (the anon key is a valid project JWT; it grants NOTHING here by itself).
//   2. `x-agent-secret` header must match app_config.agents_config.toolSecret
//      (timing-safe). Stored in the DB, not EF env, so it rotates with SQL.
//
// Deploy: supabase functions deploy eleven-agent-get-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import { phoneDigits } from "../_shared/phone.ts";
import { codeLookupKey, placeNames, speakable, type SpeakableTicket } from "../_shared/agent-tools.ts";
import { placeZone } from "../_shared/local-time.ts";

type Body = {
  reference_code?: unknown;
};

/** speakable's shape: place-local es-MX date + time the agent can speak back. */
type AgentTicket = ReturnType<typeof speakable>;

async function searchReservations(admin: SupabaseClient, code: string): Promise<AgentTicket[]> {
  type Row = SpeakableTicket & { place_id: string };
  const { data } = await admin
    .from("reservation_tickets")
    .select(
      "reference_code, reserved_at, party_size, state, notes, is_test, place_id, guest_first_name, guest_last_name, consumer:consumers(full_name, first_name, last_name)",
    )
    .eq("reference_code", code)
    .limit(5);
  // supabase-js types an embedded to-one relation as an ARRAY, so the direct
  // cast is "insufficiently overlapping" (TS2352); the runtime shape is one
  // object. Go through unknown rather than widen Row to a lie.
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];
  // reservation_tickets.place_id has no PostgREST FK hint to places — batch the
  // place names separately (same workaround as the engine).
  const placeName = await placeNames(admin, [...new Set(rows.map((r) => r.place_id))], "");
  return rows.map((r) => speakable(r, placeName.get(r.place_id)?.name ?? "", placeName.get(r.place_id)?.zone ?? placeZone(null)));
}

serveJson("eleven-agent-get-reservation", async (req) => {
  // Lock 2 (lock 1 is the gateway's verify_jwt): the shared tool secret.
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<Body>(req, {});
  const codeDigits = typeof body.reference_code === "string"
    ? phoneDigits(body.reference_code)
    : "";
  const code = codeLookupKey(codeDigits);
  if (!code) {
    return json({ ok: false, error: "Pass reference_code (8 digits); names are not searched" }, 400);
  }

  const tickets = (await searchReservations(admin, code))
    .sort((a, b) => (a.reserved_at < b.reserved_at ? 1 : -1))
    .slice(0, 5);

  return json({ ok: true, found: tickets.length, tickets });
});
