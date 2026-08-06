// Supabase Edge Function — eleven-a3-verify-caller (vendor caller)
//
// Caller = eleven-a3: the consumer INBOUND line — a guest phones Mesita for
// support. THE GATE for every a3 conversation: verifies the caller by phone
// number against `consumers` (the agent passes {{system__caller_id}}) and
// returns who is calling plus their newest tickets, speakable:
//
//   { caller_phone }
//
// Matching is by the last 10 digits so +52 / +521 / bare MX forms compare
// equal. The LLM's claims are never the authority — identity comes only from
// this lookup. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a3-verify-caller

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import {
  phoneTail,
  placeNames,
  requireAgentSecret,
  sameLine,
  speakable,
  ticketsOfConsumers,
} from "../_shared/agent-tools.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

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
  const guest = first.full_name?.trim() ||
    [first.first_name, first.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");

  return json({
    ok: true,
    verified: true,
    consumer: { name: guest || "(sin nombre)", first_name: first.first_name ?? "" },
    tickets: tickets.map((t) => speakable(t, names.get(t.project_id) ?? "")),
  });
});
