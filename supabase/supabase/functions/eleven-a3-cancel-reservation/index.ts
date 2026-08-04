// Supabase Edge Function — eleven-a3-cancel-reservation (vendor caller)
//
// Caller = eleven-a3: the consumer INBOUND line. Cancels the caller's own
// ticket — ownership is re-verified server-side against the caller's phone
// number (never the LLM's word):
//
//   { caller_phone, reference_code, reason? }
//
// The ticket's consumer phone must be the same line as caller_phone, else 403.
// cancelled_by = consumer. Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a3-cancel-reservation

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
  if (!sameLine(ticket.consumer?.phone, body.caller_phone)) {
    return json({
      ok: false,
      error: "caller number does not match this reservation's guest",
    }, 403);
  }
  if (ticket.status === "cancelled") {
    return json({ ok: true, already: true, reference_code: ticket.reference_code });
  }

  // Leg 5: a confirmed table means the venue is holding it — it must hear.
  const notice = ticket.status === "confirmed" ? "venue_cancel" as const : null;
  const err = await cancelTicket(admin, ticket.id, "consumer", cleanNote(body.reason), notice);
  if (err) return json({ ok: false, error: err }, 500);

  // Fire-and-forget: the engine acks early; a lost invoke is caught by the
  // retry cron, which sweeps notice_state='pending'.
  if (notice) {
    await invokeArtificialCaller(
      envRes.env,
      "eleven-a3-cancel-reservation",
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
