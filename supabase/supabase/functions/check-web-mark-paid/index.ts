// Supabase Edge Function — check-web-mark-paid (natural caller: the public
// check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// The "Paid received" tap, moved from the business console to the check
// page. Closes the ticket via the same closeTicketAndEnqueueReview helper
// the staff path used: revealed + revealed_at/paid_at, first-honor
// recording, and the queued post-visit review.
//
// NOTE (accepted, by design): recordFirstTicketHonored — the Promos v4
// place-activation gate — now trusts this unauthenticated surface. It only
// gates the place's own promo lane, and every tap is audit-logged.
//
// Body:     { code: string }
// Response: { ok: true, alreadyPaid? } | 404 | 409 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { closeTicketAndEnqueueReview } from "../_shared/ticket-informal.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadTicketByCheckCode,
  logCheckEvent,
  requireCheckPin,
} from "../_shared/ticket-check.ts";

type Body = { code?: string; pin?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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
  const pinRes = await requireCheckPin({
    admin,
    projectId: ticket.project_id,
    ticketId: ticket.id,
    pin: bodyRes.body.pin,
    ipHash,
    userAgent: req.headers.get("user-agent"),
    json,
  });
  if (!pinRes.ok) return pinRes.response;

  if (ticket.status === "revealed") {
    return json({ ok: true, alreadyPaid: true });
  }
  if (ticket.status !== "awaiting_payment_confirm") {
    return json(
      { ok: false, error: `Ticket is ${ticket.status} — nothing to confirm yet.` },
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
