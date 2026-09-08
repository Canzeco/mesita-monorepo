// Supabase Edge Function — business-web-cancel-ticket
//
// Authenticated. Cancels a pending ticket. When cancel_reason is refused_qr
// or ignored_qr, records a Promos v4 membership strike and compensates the guest
// (MESITA-542).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireEditor,
} from "../_shared/auth.ts";
import {
  isStrikeReason,
  recordMembershipStrike,
} from "../_shared/membership-enforcement.ts";
import {
  BUSINESS_CANCELLABLE_STATES,
  TICKET_STATE,
} from "../_shared/ticket-state.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

type Body = { ticketId?: string; reason?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const ticketId = (body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);
  const reason = (body.reason ?? "").toString().trim().slice(0, 240) || null;

  const admin = adminClient(envRes.env);

  const ticket = await admin
    .from("visit_tickets")
    .select("id, place_id, state, consumer_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket.error) {
    return json({ ok: false, error: `ticket_lookup: ${ticket.error.message}` }, 500);
  }
  if (!ticket.data) return json({ ok: false, error: "Ticket not found" }, 404);

  const membership = await requireEditor(admin, authRes.user, ticket.data.place_id);
  if (!membership.ok) return membership.response;

  if (ticket.data.state === TICKET_STATE.cancelled) {
    return json({ ok: true, alreadyCancelled: true });
  }
  const cancellable = new Set<string>(BUSINESS_CANCELLABLE_STATES);
  if (!cancellable.has(ticket.data.state)) {
    return json(
      { ok: false, error: `Cannot cancel a ${ticket.data.state} ticket` },
      409,
    );
  }

  const cancelledAt = new Date().toISOString();
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticketId,
    patch: { state: TICKET_STATE.cancelled, cancelled_at: cancelledAt, cancel_reason: reason },
    guard: { in: { state: [...BUSINESS_CANCELLABLE_STATES] } },
    select: "id, state, cancelled_at, cancel_reason",
    single: true,
  });
  if (!update.ok) {
    return json({ ok: false, error: `ticket_update: ${update.error}` }, 500);
  }

  let strike: unknown = null;
  if (isStrikeReason(reason)) {
    const result = await recordMembershipStrike(admin, {
      placeId: ticket.data.place_id,
      reason,
      consumerId: ticket.data.consumer_id,
      ticketId,
      notes: reason,
    });
    if (result.ok) {
      strike = {
        strikeNumber: result.strikeNumber,
        consequence: result.consequence,
      };
    } else {
      console.error("[business-web-cancel-ticket] strike:", result.error);
    }
  }

  return json({ ok: true, ticket: update.row, strike });
});
