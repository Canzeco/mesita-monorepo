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
  BUSINESS_CANCELLABLE_STATUSES,
  TICKET_STATUS,
} from "../_shared/ticket-status.ts";

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
    .from("tickets")
    .select("id, project_id, status, consumer_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket.error) {
    return json({ ok: false, error: `ticket_lookup: ${ticket.error.message}` }, 500);
  }
  if (!ticket.data) return json({ ok: false, error: "Ticket not found" }, 404);

  const membership = await requireEditor(admin, authRes.user, ticket.data.project_id);
  if (!membership.ok) return membership.response;

  if (ticket.data.status === TICKET_STATUS.cancelled) {
    return json({ ok: true, alreadyCancelled: true });
  }
  const cancellable = new Set<string>(BUSINESS_CANCELLABLE_STATUSES);
  if (!cancellable.has(ticket.data.status)) {
    return json(
      { ok: false, error: `Cannot cancel a ${ticket.data.status} ticket` },
      409,
    );
  }

  const cancelledAt = new Date().toISOString();
  const update = await admin
    .from("tickets")
    .update({ status: TICKET_STATUS.cancelled, cancelled_at: cancelledAt, cancel_reason: reason })
    .eq("id", ticketId)
    .in("status", [...BUSINESS_CANCELLABLE_STATUSES])
    .select("id, status, cancelled_at, cancel_reason")
    .single();
  if (update.error) {
    return json({ ok: false, error: `ticket_update: ${update.error.message}` }, 500);
  }

  let strike: unknown = null;
  if (isStrikeReason(reason)) {
    const result = await recordMembershipStrike(admin, {
      projectId: ticket.data.project_id,
      reason,
      consumerId: ticket.data.consumer_id,
      ticketId,
      notes: reason,
    });
    if (result.ok) {
      strike = {
        strikeNumber: result.strikeNumber,
        consequence: result.consequence,
        compensationCouponId: result.compensationCouponId,
      };
    } else {
      console.error("[business-web-cancel-ticket] strike:", result.error);
    }
  }

  return json({ ok: true, ticket: update.data, strike });
});
