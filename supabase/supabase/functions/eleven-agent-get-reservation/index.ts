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
// agent must resolve operator test calls too). Two lookup keys, either works:
//   { reference_code }              — the 8-digit code (exact)
//   { first_name?, last_name? }     — the name the reservation is under: the
//                                     name typed on Reserve, else (older
//                                     reservations) the guest's profile name.
//                                     Accent-insensitive, every word must match.
// Newest first, 5 max, es-MX speakable fields.
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
import {
  accentTolerantPattern,
  placeNames,
  speakable,
  type SpeakableTicket,
  ticketMatchesGuestName,
} from "../_shared/agent-tools.ts";

type Body = {
  reference_code?: unknown;
  first_name?: unknown;
  last_name?: unknown;
};

/** speakable's shape: place-local es-MX date + time the agent can speak back. */
type AgentTicket = ReturnType<typeof speakable>;

// PostgREST .or() expressions are comma/paren-delimited — strip those (and
// wildcards) from user-spoken terms so a weird transcription can't break the
// filter syntax.
function cleanTerm(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/[,()%*]/g, "").slice(0, 60) : "";
}

async function searchReservations(
  admin: SupabaseClient,
  code: string | null,
  terms: string[],
): Promise<AgentTicket[]> {
  type Row = SpeakableTicket & { place_id: string };
  const SELECT =
    "reference_code, reserved_at, party_size, state, notes, is_test, place_id, guest_first_name, guest_last_name, consumer:consumers(full_name, first_name, last_name)";
  let rows: Row[] = [];
  if (code) {
    const { data } = await admin
      .from("reservation_tickets")
      .select(SELECT)
      .eq("reference_code", code)
      .limit(5);
    // supabase-js types an embedded to-one relation as an ARRAY, so the direct
    // cast is "insufficiently overlapping" (TS2352); the runtime shape is one
    // object. Go through unknown rather than widen Row to a lie.
    rows = (data ?? []) as unknown as Row[];
  } else {
    // 1 · The name typed on the reservation (MESITA-3607) — what a place
    // hears: "la reservación a nombre de Ana López".
    // Accent-blind at the database (MESITA-3622): "Lopez" finds "López".
    const t0 = accentTolerantPattern(terms[0]);
    const query = terms.join(" ");
    const { data: typed } = await admin
      .from("reservation_tickets")
      .select(SELECT)
      .or(`guest_first_name.ilike.${t0},guest_last_name.ilike.${t0}`)
      .order("created_at", { ascending: false })
      .limit(25);
    // 2 · Older reservations carry no typed name: fall back to the profile.
    const { data: guests } = await admin
      .from("consumers")
      .select("id")
      .or(`full_name.ilike.${t0},first_name.ilike.${t0},last_name.ilike.${t0}`)
      .limit(25);
    const ids = ((guests ?? []) as { id: string }[]).map((g) => g.id);
    const { data: byProfile } = ids.length
      ? await admin
        .from("reservation_tickets")
        .select(SELECT)
        .in("consumer_id", ids)
        .order("created_at", { ascending: false })
        .limit(25)
      : { data: [] };
    // supabase-js types an embedded to-one relation as an ARRAY, so the direct
    // cast is "insufficiently overlapping" (TS2352); the runtime shape is one
    // object. Go through unknown rather than widen Row to a lie.
    const all = [...(typed ?? []), ...(byProfile ?? [])] as unknown as Row[];
    const seen = new Set<string>();
    rows = all.filter((r) => {
      const k = r.reference_code ?? JSON.stringify(r);
      if (seen.has(k) || !ticketMatchesGuestName(r, query)) return false;
      seen.add(k);
      return true;
    });
  }
  if (rows.length === 0) return [];

  // reservation_tickets.place_id has no PostgREST FK hint to places — batch the
  // place names separately (same workaround as the engine).
  // A nameless place speaks as "" here (the a3 tools say "(sin nombre)").
  const placeName = await placeNames(admin, [...new Set(rows.map((r) => r.place_id))], "");

  return rows.map((r) => speakable(r, placeName.get(r.place_id) ?? ""));
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
  const code = /^\d{8}$/.test(codeDigits) ? codeDigits : null;
  const terms = [cleanTerm(body.first_name), cleanTerm(body.last_name)].filter(Boolean);
  if (!code && terms.length === 0) {
    return json({
      ok: false,
      error: "Pass reference_code (8 digits) or first_name / last_name",
    }, 400);
  }

  const tickets = (await searchReservations(admin, code, terms))
    .sort((a, b) => (a.reserved_at < b.reserved_at ? 1 : -1))
    .slice(0, 5);

  return json({ ok: true, found: tickets.length, tickets });
});
