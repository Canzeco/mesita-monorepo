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
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireAgentRequest } from "../_shared/request.ts";
import {
  cancelAsGuest,
  cleanNote,
  staleRunReply,
  ticketByCode,
} from "../_shared/agent-tools.ts";

serveJson("eleven-a2-cancel-reservation", async (req) => {
  const ctx = await requireAgentRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;

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
    env,
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
