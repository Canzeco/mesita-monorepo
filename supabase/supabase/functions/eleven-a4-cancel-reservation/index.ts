// Supabase Edge Function — eleven-a4-cancel-reservation (vendor caller)
//
// Caller = eleven-a4: the business INBOUND line. A verified venue cancels a
// booking at ITS OWN place ("we're closed that night") — scope re-verified
// server-side against the caller's phone number:
//
//   { caller_phone, reference_code, reason? }
//
// The ticket's place must own the calling line (places.phone or the
// products.reservations endpoint), else 403. cancelled_by = business — and
// the guest is then CALLED: cancelTicket owes notice_kind='guest_cancel' and
// the engine (intent cancel_notice) puts a2 on the line with call_context
// "cancelled_by_venue" (RESERVATIONS-PROTOCOL.md leg 6).
// Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a4-cancel-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import {
  cancelTicket,
  cleanNote,
  requireAgentSecret,
  sameLine,
  ticketByCode,
} from "../_shared/agent-tools.ts";
import { invokeArtificialCaller } from "../_shared/internal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

  const body = await readJsonOr<{
    caller_phone?: unknown;
    reference_code?: unknown;
    reason?: unknown;
  }>(req, {});

  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);

  const { data: placeRow } = await admin
    .from("places")
    .select("id, phone, products")
    .eq("id", ticket.project_id)
    .maybeSingle();
  const place = (placeRow ?? null) as {
    id: string;
    phone: string | null;
    products: Record<string, unknown> | null;
  } | null;
  const resv = (place?.products?.reservations ?? null) as { value?: string } | null;
  const owns = !!place &&
    (sameLine(place.phone, body.caller_phone) || sameLine(resv?.value ?? null, body.caller_phone));
  if (!owns) {
    return json({
      ok: false,
      error: "caller number does not match this reservation's place",
    }, 403);
  }
  if (ticket.status === "cancelled") {
    return json({ ok: true, already: true, reference_code: ticket.reference_code });
  }

  // Leg 6: the venue calls it off, so the GUEST must hear — a2 rings them
  // with call_context "cancelled_by_venue". The flag below used to be a
  // dead letter; the notice columns + this engine fire make it real.
  const err = await cancelTicket(admin, ticket.id, "business", cleanNote(body.reason), "guest_cancel");
  if (err) return json({ ok: false, error: err }, 500);

  await invokeArtificialCaller(
    envRes.env,
    "eleven-a4-cancel-reservation",
    "supabase-edgefunc-reservation-call",
    { reservation_id: ticket.id, intent: "cancel_notice" },
  );

  return json({
    ok: true,
    cancelled: true,
    reference_code: ticket.reference_code,
    guest_needs_notification: true,
  });
});
