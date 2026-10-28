// Supabase Edge Function — eleven-a2-cancel-reservation (vendor caller)
//
// Caller = eleven-a2: the b2c OUTBOUND Confirmer. On the confirmation call the
// guest may simply cancel — this records it:
//
//   { reference_code, reason? }
//
// state → cancelled, cancelled_by = consumer (it is the guest's decision,
// captured by the agent). Auth: anon bearer + x-agent-secret.
//
// Deploy: supabase functions deploy eleven-a2-cancel-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import {
  cancelAsGuest,
  cleanNote,
  requireAgentSecret,
  staleRunReply,
  ticketByCode,
} from "../_shared/agent-tools.ts";

serveJson("eleven-a2-cancel-reservation", async (req) => {
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
  // Stale-run guard: a call from an orphaned run writes nothing.
  const stale = staleRunReply(body, ticket);
  if (stale) return stale;

  if (ticket.state === "cancelled") {
    return json({ ok: true, already: true, reference_code: ticket.reference_code });
  }

  // A CONFIRMED table is being walked away from — the place is holding it and
  // must hear (Docs › Reservations §B leg 5). Pending tickets owe nothing.
  const res = await cancelAsGuest(
    admin,
    envRes.env,
    "eleven-a2-cancel-reservation",
    ticket,
    cleanNote(body.reason),
  );
  if (!res.ok) return json({ ok: false, error: res.error }, 500);

  return json({
    ok: true,
    cancelled: true,
    reference_code: ticket.reference_code,
    place_notified: res.placeNotified,
  });
});
