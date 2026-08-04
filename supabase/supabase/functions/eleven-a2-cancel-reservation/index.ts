// Supabase Edge Function — eleven-a2-cancel-reservation (vendor caller)
//
// Caller = eleven-a2: the b2c OUTBOUND Confirmer. On the confirmation call the
// guest may simply cancel — this records it:
//
//   { reference_code, reason? }
//
// status → cancelled, cancelled_by = consumer (it is the guest's decision,
// captured by the agent). Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a2-cancel-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { cancelTicket, cleanNote, requireAgentSecret, ticketByCode } from "../_shared/agent-tools.ts";
import { invokeArtificialCaller } from "../_shared/internal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

  const body = await readJsonOr<{ reference_code?: unknown; reason?: unknown }>(req, {});
  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);
  if (ticket.status === "cancelled") {
    return json({ ok: true, already: true, reference_code: ticket.reference_code });
  }

  // A CONFIRMED table is being walked away from — the venue is holding it and
  // must hear (RESERVATIONS-PROTOCOL.md leg 5). Pending tickets owe nothing.
  const notice = ticket.status === "confirmed" ? "venue_cancel" as const : null;
  const err = await cancelTicket(admin, ticket.id, "consumer", cleanNote(body.reason), notice);
  if (err) return json({ ok: false, error: err }, 500);

  // Fire-and-forget: the engine acks early; a lost invoke is caught by the
  // retry cron, which sweeps notice_state='pending'.
  if (notice) {
    await invokeArtificialCaller(
      envRes.env,
      "eleven-a2-cancel-reservation",
      "supabase-edgefunc-reservation-call",
      { reservation_id: ticket.id, intent: "cancel_notice" },
    );
  }

  return json({
    ok: true,
    cancelled: true,
    reference_code: ticket.reference_code,
    venue_notified: notice !== null,
  });
});
