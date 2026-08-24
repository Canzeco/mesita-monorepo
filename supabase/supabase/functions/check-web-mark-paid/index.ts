// Supabase Edge Function — check-web-mark-paid (product caller: the public
// check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// The SINGLE close of the v3 lifecycle (MESITA-850): staff tap "done" and
// the ticket dies. MESITA-1095: an unbilled ticket refuses to close
// (409 bill_required) — the guest types the bill, always.
// Closes via the same closeTicketAndEnqueueReview helper: revealed +
// revealed_at/paid_at, first-honor recording (now bound to the close), and
// the queued post-visit review. With no bill on record the place applied
// the stated offer at its own POS.
//
// NOTE (accepted, by design): recordFirstTicketHonored — the Promos v4
// place-activation gate — now trusts this unauthenticated surface. It only
// gates the place's own promo lane, and every tap is audit-logged.
//
// Body:     { code: string }
// Response: { ok: true, alreadyPaid? } | 404 | 409 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { closeTicketAndEnqueueReview } from "../_shared/ticket-informal.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadCheckSettings,
  loadTicketByCheckCode,
  logCheckEvent,
  requireCheckPin,
} from "../_shared/ticket-check.ts";
import { CLOSED_TICKET_STATUS, LIVE_STATUS_SET } from "../_shared/ticket-status.ts";

type Body = { code?: string; pin?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = (bodyRes.body.code ?? "").toString().trim();
  if (!code) return checkNotFound(json);

  const ipHash = await hashRequestIp(req, envRes.env.serviceKey);
  if (await isRateLimited(admin, ipHash, { maxPerMinute: 30 })) {
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const ticket = await loadTicketByCheckCode(admin, code);
  if (!ticket) return checkNotFound(json);

  // Staff PIN gate (MESITA-823) — write actions only; no-op when the place
  // has no PIN set.
  const settings = await loadCheckSettings(admin, ticket.project_id);
  const pinRes = await requireCheckPin({
    admin,
    projectId: ticket.project_id,
    ticketId: ticket.id,
    pin: bodyRes.body.pin,
    ipHash,
    userAgent: req.headers.get("user-agent"),
    json,
    settings,
  });
  if (!pinRes.ok) return pinRes.response;

  if (ticket.status === CLOSED_TICKET_STATUS) {
    return json({ ok: true, alreadyPaid: true });
  }
  // v3b: the close is unconditional — a billed ticket (awaiting_payment_
  // confirm) and an unbilled open one both close on this tap. Only a
  // cancelled (or otherwise dead) ticket refuses.
  if (!LIVE_STATUS_SET.has(ticket.status)) {
    return json(
      { ok: false, error: `Ticket is ${ticket.status} — nothing to close.` },
      409,
    );
  }

  // Bill-required gate (MESITA-1095): the guest bill is always required.
  // Same billed test as get-ticket (either amount > 0).
  const billed = (ticket.total_cents ?? 0) > 0 ||
    (ticket.bill_subtotal_cents ?? 0) > 0;
  if (!billed) {
    return json(
      {
        ok: false,
        code: "bill_required",
        error:
          "The bill amount must be on record before closing the ticket.",
      },
      409,
    );
  }

  const closed = await closeTicketAndEnqueueReview(
    admin,
    ticket.id,
    ticket.consumer_id,
    ticket.project_id,
  );
  if (!closed.ok) {
    return json({ ok: false, error: closed.error }, 500);
  }

  const { user } = await getOptionalAuthedUser(req, envRes.env);
  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event: "marked_paid",
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  return json({ ok: true });
});
