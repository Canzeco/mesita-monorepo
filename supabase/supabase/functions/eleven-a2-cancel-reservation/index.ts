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
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { cancelTicket, cleanNote, requireAgentSecret, ticketByCode, fireCancelNotice } from "../_shared/agent-tools.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

  const body = await readJsonOr<{
    reference_code?: unknown;
    reason?: unknown;
    run_id?: unknown;
  }>(req, {});
  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);
  // Stale-run guard (eng-review 2026-08-04): run_id rides every outbound call
  // as a bound dynamic variable. A mismatch means this CALL belongs to an
  // orphaned run (the guest rescheduled/cancelled mid-call) — ignore the
  // write, tell the agent to wrap up gracefully.
  const callRunId = typeof body.run_id === "string" ? body.run_id.trim() : "";
  if (callRunId && ticket.run_id && callRunId !== ticket.run_id) {
    return json({
      ok: true,
      stale_run: true,
      ignored: true,
      say: "Esa reservación acaba de cambiar desde la app; Mesita le confirma los nuevos datos por ahí.",
    });
  }

  if (ticket.status === "cancelled") {
    return json({ ok: true, already: true, reference_code: ticket.reference_code });
  }

  // A CONFIRMED table is being walked away from — the venue is holding it and
  // must hear (Reservations Rules §B leg 5). Pending tickets owe nothing.
  const notice = ticket.status === "confirmed" ? "venue_cancel" as const : null;
  const err = await cancelTicket(admin, ticket.id, "consumer", cleanNote(body.reason), notice);
  if (err) return json({ ok: false, error: err }, 500);

  // Fire-and-forget: the engine acks early; a lost invoke is caught by the
  // retry cron, which sweeps notice_state='pending'.
  if (notice) {
    await fireCancelNotice(envRes.env, "eleven-a2-cancel-reservation", ticket.id);
  }

  return json({
    ok: true,
    cancelled: true,
    reference_code: ticket.reference_code,
    venue_notified: notice !== null,
  });
});
