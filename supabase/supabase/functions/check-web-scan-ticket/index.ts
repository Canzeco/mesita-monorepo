// Supabase Edge Function — check-web-scan-ticket (product caller: the public
// check page at check.mesita.ai/<code>)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// THE TICKET v4 (MESITA-1090): `open → scanned` is an affirmative staff-side
// WRITE, fired once by the check page after it renders — never a side effect
// of a GET, so a WhatsApp unfurler or a curious tap can't advance a ticket
// (check-web-get-ticket stays read-shaped and only stamps first_scanned_at).
//
// Idempotent by design: re-scans are a feature, so a ticket already past
// `open` answers 200 with its current status instead of an error a waiter
// would read as failure.
//
// Body:     { code: string, pin?: string }
// Response: { ok: true, status, already?: true } | 404 | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadCheckSettings,
  loadTicketByCheckCode,
  logCheckEvent,
  requireCheckPin,
} from "../_shared/ticket-check.ts";
import { LIVE_STATUS_SET, TICKET_STATUS } from "../_shared/ticket-status.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

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

  // Already past open: a re-scan, a second waiter, a refresh. Fine — echo
  // where the ticket is; the page renders from its own poll anyway.
  if (ticket.status !== TICKET_STATUS.open) {
    if (!LIVE_STATUS_SET.has(ticket.status)) {
      return json(
        { ok: false, code: "stale_state", status: ticket.status, error: `Ticket is ${ticket.status}.` },
        409,
      );
    }
    return json({ ok: true, already: true, status: ticket.status });
  }

  // CAS: a concurrent scan loses cleanly and reads as already-scanned.
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: { status: TICKET_STATUS.scanned },
    guard: { eq: { status: TICKET_STATUS.open } },
    select: "id, status",
  });
  if (!update.ok) {
    return json({ ok: false, error: `ticket_update: ${update.error}` }, 500);
  }
  if (!update.row) {
    return json({ ok: true, already: true, status: TICKET_STATUS.scanned });
  }

  const { user } = await getOptionalAuthedUser(req, envRes.env);
  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event: "scan_opened",
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  return json({ ok: true, status: TICKET_STATUS.scanned });
});
