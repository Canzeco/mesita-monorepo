// Supabase Edge Function — eleven-a3-verify-caller (vendor caller)
//
// Caller = eleven-a3: the consumer INBOUND line — a guest phones Mesita for
// support. THE GATE for every a3 conversation: verifies the caller by phone
// number against `consumers` (the agent passes {{system__caller_id}}) and
// returns who is calling plus their newest tickets, speakable:
//
//   { caller_phone }
//
// `consumer.name` is the ACCOUNT holder (the person calling); each
// reservation's `guest_name` is the name it is under — typed on Reserve, else
// the profile (speakable → ticketGuestName), which is what the agent reads.
//
// Matching is by the last 10 digits so +52 / +521 / bare MX forms compare
// equal. The LLM's claims are never the authority — identity comes only from
// this lookup. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a3-verify-caller

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  guestName,
  phoneTail,
  placeNames,
  sameLine,
  speakable,
  ticketsOfConsumers,
} from "../_shared/agent-tools.ts";

serveJson("eleven-a3-verify-caller", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ caller_phone?: unknown }>(req, {});
  const tail = phoneTail(body.caller_phone);
  if (tail.length < 10) {
    return json({ ok: true, verified: false, reason: "caller number unavailable" });
  }

  const { data: candidates } = await admin
    .from("consumers")
    .select("id, full_name, first_name, last_name, phone")
    .ilike("phone", `%${tail}%`)
    .limit(10);
  type C = {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };
  const matches = ((candidates ?? []) as C[]).filter((c) => sameLine(c.phone, tail));
  if (matches.length === 0) {
    return json({ ok: true, verified: false, reason: "no Mesita account with this number" });
  }

  const tickets = await ticketsOfConsumers(admin, matches.map((m) => m.id), 5);
  const names = await placeNames(admin, [...new Set(tickets.map((t) => t.project_id))]);
  const first = matches[0];

  return json({
    ok: true,
    verified: true,
    consumer: { name: guestName(first, "(sin nombre)"), first_name: first.first_name ?? "" },
    tickets: tickets.map((t) => speakable(t, names.get(t.project_id) ?? "")),
  });
});
