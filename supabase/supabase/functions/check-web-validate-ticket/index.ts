// Supabase Edge Function — check-web-validate-ticket (product caller: the
// public check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// THE TICKET v4 (MESITA-1092): the restaurant's second and last touch —
// payment confirmed, the ticket validates and closes on its own. Closes via
// the same closeTicketAndEnqueueReview the v3 close used (revealed +
// revealed_at/paid_at + first-honor + the queued review), stamping
// validated_at and the settle method on the way.
//
// Accepts `paying` (the guest picked how they settle) AND `approved` — on a
// real floor the guest often just hands over cash without touching their
// phone again, and a waiter who cannot close a ticket the guest already paid
// is the exact friction v4 exists to remove. Validating from `approved`
// records paid_method='at_place'. (Deliberate widening of §12's paying-only
// row; logged on MESITA-1092.)
//
// NOT gated on projects.check_require_bill, deliberately (MESITA-1148): that
// gate fires at check-web-approve-ticket, the verdict. Everything this EF
// accepts is already approved, so a second gate here could only strand a
// ticket the floor had approved — the guest has paid and there would be no
// way to close. The v3 close (check-web-mark-paid) keeps its own gate,
// because it closes straight from `open` with no verdict in between.
//
// Body:     { code, pin? }
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
import { CLOSED_TICKET_STATUS, TICKET_STATUS } from "../_shared/ticket-status.ts";
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

  if (ticket.status === CLOSED_TICKET_STATUS) {
    return json({ ok: true, alreadyPaid: true });
  }
  if (
    ticket.status !== TICKET_STATUS.paying &&
    ticket.status !== TICKET_STATUS.approved
  ) {
    return json(
      {
        ok: false,
        code: "stale_state",
        status: ticket.status,
        error: `Ticket is ${ticket.status} — approve it before confirming the payment.`,
      },
      409,
    );
  }

  // Stamp the v4 close facts first (CAS on the two payable statuses), then
  // run the shared close — which flips to revealed, records first-honor and
  // queues the guest's review, exactly like every close before it.
  const now = new Date().toISOString();
  // paid_method is only stamped when validating from `approved` — a
  // `paying` ticket already carries the guest's own choice and keeps it.
  // Omitted from the patch entirely (not `undefined`) so the closed key set
  // never sees the key at all on that branch.
  const stamp = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: {
      validated_at: now,
      ...(ticket.status === TICKET_STATUS.paying ? {} : { paid_method: "at_place" as const }),
    },
    guard: { in: { status: [TICKET_STATUS.paying, TICKET_STATUS.approved] } },
    select: "id",
  });
  if (!stamp.ok) {
    return json({ ok: false, error: `ticket_update: ${stamp.error}` }, 500);
  }
  if (!stamp.row) {
    // Someone else closed or cancelled it between the read and the stamp.
    const fresh = await admin
      .from("visit_tickets")
      .select("id, status")
      .eq("id", ticket.id)
      .maybeSingle();
    if ((fresh.data as { status?: string } | null)?.status === CLOSED_TICKET_STATUS) {
      return json({ ok: true, alreadyPaid: true });
    }
    return json({ ok: false, code: "stale_state", error: "Ticket changed — refresh." }, 409);
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
    event: "validated",
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  return json({ ok: true });
});
