// Supabase Edge Function — consumer-web-cancel-ticket (product caller)
//
// Tickets v2 (MESITA-806): the guest cancels their OWN self-created ticket
// while it is still `open` (QR live, nothing billed). Once billed, the
// discount is already on the table — resolution moves staff-side
// (business-web-cancel-ticket keeps that role, strikes included). No strike
// logic here on purpose: a guest-triggered cancel must never be able to
// award the place a strike.
//
// Body:     { ticketId: string }
// Response: { ok: true, ticket } | { ok, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  GUEST_CANCELLABLE_STATUS_SET,
  GUEST_CANCELLABLE_STATUSES,
  TICKET_STATUS,
} from "../_shared/ticket-status.ts";

type Body = { ticketId?: string };

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
  const ticketId = (bodyRes.body.ticketId ?? "").toString().trim();
  if (!ticketId) return json({ ok: false, error: "ticketId is required" }, 400);

  const admin = adminClient(envRes.env);

  const ticketRow = await admin
    .from("tickets")
    .select("id, consumer_id, status")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return json({ ok: false, error: `ticket_lookup: ${ticketRow.error.message}` }, 500);
  }
  if (!ticketRow.data || ticketRow.data.consumer_id !== authRes.user.id) {
    // Uniform miss — never confirms someone else's ticket exists.
    return json({ ok: false, error: "Ticket not found" }, 404);
  }
  const ticket = ticketRow.data;

  if (ticket.status === TICKET_STATUS.cancelled) {
    return json({ ok: true, alreadyCancelled: true });
  }
  if (!GUEST_CANCELLABLE_STATUS_SET.has(ticket.status)) {
    return json(
      {
        ok: false,
        error: "This ticket is already at the table — ask the staff to resolve it.",
      },
      409,
    );
  }

  const updated = await admin
    .from("tickets")
    .update({
      status: TICKET_STATUS.cancelled,
      cancelled_at: new Date().toISOString(),
      cancel_reason: "consumer_cancelled",
    })
    .eq("id", ticketId)
    .in("status", [...GUEST_CANCELLABLE_STATUSES])
    .select("id, status, cancelled_at")
    .single();
  if (updated.error) {
    return json({ ok: false, error: `ticket_update: ${updated.error.message}` }, 500);
  }

  return json({ ok: true, ticket: updated.data });
});
