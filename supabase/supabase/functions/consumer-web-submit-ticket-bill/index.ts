// Supabase Edge Function — consumer-web-submit-ticket-bill
//
// THE TICKET v4, step 1 (MESITA-1088): the BILL is guest-entered and required
// on the QR (C3). The guest types the printed total and picks a tip —
// 10/15/20% preset or a custom peso amount — and this EF prices the ticket:
// live rate (base + welcome + every verified action) × the place's cap, tip
// computed SERVER-SIDE on the raw subtotal (C4: a client-computed tip never
// crosses the wire; only the preset percent or a custom peso AMOUNT does).
//
// The bill does NOT advance the status: an `open` ticket stays open (the QR
// comes next), a `scanned` one stays scanned (this is the fix-loop re-entry —
// staff sent it back, the guest corrects it, their screen updates off the
// poll, same check_code). A bill or reward fix outstanding clears in the SAME
// update. After approval the amount is frozen: 409.
//
// Caller: consumer. Verb: submit. Noun: ticket-bill.
//
// Body:     { ticketId, subtotalCents, tipPct? (0-100) | tipCustomCents? }
// Response: { ok: true, ticket } | 400 | 404 | 409

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { computeTicketBill } from "../_shared/business-ticket-billing.ts";
import { resolveLiveTicketRate } from "../_shared/ticket-reprice.ts";
import { toCents } from "../_shared/money.ts";
import { TICKET_STATUS } from "../_shared/ticket-status.ts";
import { writeTicket } from "../_shared/ticket-doc.ts";

type Body = {
  ticketId?: string;
  subtotalCents?: number;
  tipPct?: number | null;
  /** Custom tip as CENTS (whole pesos ×100). Ignored when tipPct is set. */
  tipCustomCents?: number | null;
};

// The bill is editable while the guest still owns the amount: before the
// scan, and during the scanned handshake (that IS the fix loop). Approval
// freezes it — §12's "the last moment anything can change the amount".
const BILL_EDITABLE = [TICKET_STATUS.open, TICKET_STATUS.scanned];

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

  const subtotal = toCents(bodyRes.body.subtotalCents);
  if (subtotal === null || subtotal <= 0) {
    return json(
      { ok: false, error: "subtotalCents must be a positive integer" },
      400,
    );
  }

  const tipPctRaw = bodyRes.body.tipPct;
  const tipPct = tipPctRaw == null ? null : Math.trunc(Number(tipPctRaw));
  if (tipPct !== null && (!Number.isFinite(tipPct) || tipPct < 0 || tipPct > 100)) {
    return json({ ok: false, error: "tipPct must be between 0 and 100" }, 400);
  }
  const customTip = tipPct === null
    ? toCents(bodyRes.body.tipCustomCents ?? 0)
    : null;
  if (tipPct === null && customTip === null) {
    return json(
      { ok: false, error: "tipCustomCents must be a non-negative integer" },
      400,
    );
  }

  const admin = adminClient(envRes.env);
  const ticketRow = await admin
    .from("visit_tickets")
    .select(
      "id, consumer_id, project_id, status, story_status, review_status, fix_requested, approved_at, currency",
    )
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

  if (!BILL_EDITABLE.includes(ticket.status)) {
    return json(
      {
        ok: false,
        code: ticket.approved_at ? "amount_frozen" : "stale_state",
        error: ticket.approved_at
          ? "The place already approved this amount — it can't change now."
          : `Ticket is ${ticket.status} — the bill can't be edited.`,
      },
      409,
    );
  }

  // Live rate: base + welcome + every action already verified on the ticket.
  const live = await resolveLiveTicketRate(admin, ticket);
  if (!live.ok) return json({ ok: false, error: live.error }, 500);

  const billRes = computeTicketBill({
    subtotal,
    ratePercent: live.ratePercent,
    capPesos: live.capPesos,
    tipPct,
    carryTipCents: customTip,
  });
  if (!billRes.ok) {
    return json({ ok: false, error: billRes.error, code: billRes.code }, 400);
  }
  const snap = billRes.snapshot;

  // One UPDATE: the money, the source, and — when the outstanding fix is the
  // bill (or the reward, which re-resolves through this same pricing) — the
  // fix itself. CAS on the editable statuses.
  const clearingFix = ticket.fix_requested === "bill" ||
    ticket.fix_requested === "reward";
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticket.id,
    patch: {
      bill_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      tip_pct: tipPct,
      total_cents: snap.totalCents,
      redeem_cents: 0,
      discount_percent: snap.discountPercent,
      discount_cents: snap.discountCents,
      bill_source: "consumer",
      ...(clearingFix ? { fix_requested: null, fix_note: null } : {}),
    },
    guard: { in: { status: BILL_EDITABLE } },
    select:
      "id, status, bill_subtotal_cents, tip_cents, tip_pct, total_cents, discount_percent, discount_cents, fix_requested, updated_at, currency",
  });
  if (!update.ok) {
    return json({ ok: false, error: `ticket_update: ${update.error}` }, 500);
  }
  if (!update.row) {
    return json(
      { ok: false, code: "stale_state", error: "The ticket moved on — refresh and try again." },
      409,
    );
  }

  return json({
    ok: true,
    ticket: update.row,
    amount_due_cents: snap.amountDueCents,
  });
});
