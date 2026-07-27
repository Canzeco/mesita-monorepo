// Supabase Edge Function — eleven-a4-verify-caller (vendor caller)
//
// Caller = eleven-a4: the business INBOUND line — a venue phones Mesita to
// ask about or change bookings. THE GATE for every a4 conversation: verifies
// the caller by phone number against the place's lines (places.phone and the
// products.reservations endpoint) and returns the place plus its upcoming
// book, speakable:
//
//   { caller_phone }
//
// Businesses never call the consumer directly — they call the agent, and the
// agent relays. Matching is last-10-digits. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a4-verify-caller

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import {
  phoneTail,
  requireAgentSecret,
  sameLine,
  speakable,
  ticketsOfPlace,
} from "../_shared/agent-tools.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

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
    .from("places")
    .select("id, name, phone, products")
    .or(`phone.ilike.%${tail}%,products->reservations->>value.ilike.%${tail}%`)
    .limit(10);
  type P = {
    id: string;
    name: string | null;
    phone: string | null;
    products: Record<string, unknown> | null;
  };
  const matches = ((candidates ?? []) as P[]).filter((p) => {
    const resv = (p.products?.reservations ?? null) as { value?: string } | null;
    return sameLine(p.phone, tail) || sameLine(resv?.value ?? null, tail);
  });
  if (matches.length === 0) {
    return json({ ok: true, verified: false, reason: "no Mesita place with this number" });
  }

  const place = matches[0];
  const tickets = await ticketsOfPlace(admin, place.id, 8);

  return json({
    ok: true,
    verified: true,
    place: { name: place.name ?? "(sin nombre)" },
    tickets: tickets.map((t) => speakable(t, place.name ?? "")),
  });
});
