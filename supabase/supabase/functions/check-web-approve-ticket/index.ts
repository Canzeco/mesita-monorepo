// Supabase Edge Function — check-web-approve-ticket (product caller: the
// public check page)
//
// verify_jwt = FALSE — code-possession auth (see _shared/ticket-check.ts).
// THE TICKET v4 (MESITA-1090): the staff verdict, bound to the TICKET, never
// to a task (C1). "Does the ticket on my screen match the table in front of
// me" — one tap, and the amount FREEZES: approved_discount_cents and
// approved_amount_due_cents snapshot here, and the reprice early-returns on
// approved_at from now on. Approval is the last moment anything can change
// the amount.
//
// Concurrency (§12): the staff mutation carries expectedUpdatedAt — the
// updated_at it last rendered. A mismatch means the guest changed something
// under the waiter's glance; the answer is 409 stale_ticket and a forced
// re-render, never a silent approval at a stale number. The guest's write
// always wins: their edit is the newer fact about the bill.
//
// Body:     { code, pin?, expectedUpdatedAt }
// Response: { ok: true, already? } | 404 | 409 stale_ticket / fix_outstanding /
//           stale_state / bill_required | 429

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { amountDueCents } from "../_shared/business-ticket-billing.ts";
import {
  checkNotFound,
  hashRequestIp,
  isRateLimited,
  loadCheckSettings,
  loadTicketByCheckCode,
  logCheckEvent,
  requireCheckPin,
} from "../_shared/ticket-check.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

type Body = { code?: string; pin?: string; expectedUpdatedAt?: string };

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
  const expectedUpdatedAt = (bodyRes.body.expectedUpdatedAt ?? "").toString();
  if (!expectedUpdatedAt) {
    return json(
      { ok: false, error: "expectedUpdatedAt is required" },
      400,
    );
  }

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

  // A repeat of a transition the caller already won answers 200, never 409 —
  // a waiter's second tap must not read as failure (§12).
  if (
    ticket.status === TICKET_STATUS.approved ||
    ticket.status === TICKET_STATUS.paying
  ) {
    return json({ ok: true, already: true, status: ticket.status });
  }
  if (ticket.status !== TICKET_STATUS.scanned) {
    return json(
      {
        ok: false,
        code: "stale_state",
        status: ticket.status,
        error: `Ticket is ${ticket.status} — nothing to approve.`,
      },
      409,
    );
  }

  // Bill-required gate (MESITA-898 · MESITA-1148): the place opted out of the
  // optional bill, so an unbilled ticket cannot be approved. The gate lives
  // HERE, at the verdict, and not at check-web-validate-ticket: approval is
  // the moment the amount freezes and the last moment staff can still act —
  // they enter the bill, or send the ticket back with fix='bill'. A gate at
  // the close would dead-end a ticket the floor had already approved, with
  // the guest standing there. Same billed test as get-ticket/submit-bill.
  const billed = (ticket.total_cents ?? 0) > 0 ||
    (ticket.bill_subtotal_cents ?? 0) > 0;
  if (settings.requireBill && !billed) {
    return json(
      {
        ok: false,
        code: "bill_required",
        error:
          "This place requires the bill amount on record before the ticket can be approved.",
      },
      409,
    );
  }

  const now = new Date().toISOString();
  const frozenDue = amountDueCents({
    checkSubtotalCents: ticket.bill_subtotal_cents ?? 0,
    discountCents: ticket.discount_cents ?? 0,
    tipCents: ticket.tip_cents ?? 0,
  });

  // CAS: scanned, no fix outstanding, and the row is exactly what the staff
  // screen rendered. Zero rows means someone else won — diagnose below.
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: {
      status: TICKET_STATUS.approved,
      approved_at: now,
      approved_discount_cents: ticket.discount_cents ?? 0,
      approved_amount_due_cents: frozenDue,
    },
    guard: {
      eq: { status: TICKET_STATUS.scanned, updated_at: expectedUpdatedAt },
      is: { fix_requested: null },
    },
    select: "id, status, approved_at",
  });
  if (!update.ok) {
    return json({ ok: false, error: `ticket_update: ${update.error}` }, 500);
  }
  if (!update.row) {
    const fresh = await admin
      .from("visit_tickets")
      .select("id, status, fix_requested, updated_at")
      .eq("id", ticket.id)
      .maybeSingle();
    const row = fresh.data as
      | { status: string; fix_requested: string | null; updated_at: string }
      | null;
    if (row?.status === TICKET_STATUS.approved || row?.status === TICKET_STATUS.paying) {
      return json({ ok: true, already: true, status: row.status });
    }
    if (row?.fix_requested) {
      return json(
        {
          ok: false,
          code: "fix_outstanding",
          error: "A fix is still outstanding on this ticket.",
        },
        409,
      );
    }
    return json(
      {
        ok: false,
        code: "stale_ticket",
        error: "The ticket changed since you last saw it — review it again.",
      },
      409,
    );
  }

  const { user } = await getOptionalAuthedUser(req, envRes.env);
  await logCheckEvent(admin, {
    ticketId: ticket.id,
    event: "approved",
    selfView: user?.id === ticket.consumer_id,
    ipHash,
    userAgent: req.headers.get("user-agent"),
  });

  return json({ ok: true, approvedAt: now });
});
