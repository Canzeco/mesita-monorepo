// Supabase Edge Function — consumer-web-submit-ticket-total (product caller)
//
// v3b (MESITA-850): the amount fallback. The bill is optional for staff, but
// Performance still needs a peso figure — so when the business skipped it,
// the guest is asked for the total after the close. Unverified BY DESIGN:
// the place already applied the discount at its own POS, so this number is
// a record, not a money movement; provenance lands on the ticket
// (bill_source = 'consumer') so reporting can label it guest-typed.
//
// Guards: owner-only, ticket must be closed (revealed), and only when NO
// amount is on record — a business-entered bill is never overwritten.
//
// Body:     { ticketId: string, totalCents: number }
// Response: { ok: true, ticket: {…bill snapshot} } | 400 | 404 | 409

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { computeTicketBill } from "../_shared/business-ticket-billing.ts";
import { resolveLiveTicketRate } from "../_shared/ticket-reprice.ts";
import { toCents } from "../_shared/money.ts";
import { CLOSED_TICKET_STATUS } from "../_shared/ticket-status.ts";

type Body = { ticketId?: string; totalCents?: number };

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

  const total = toCents(bodyRes.body.totalCents);
  if (total == null || total <= 0) {
    return json(
      { ok: false, error: "totalCents must be a positive integer" },
      400,
    );
  }

  const admin = adminClient(envRes.env);

  // Literal select string — supabase-js parses it at the TYPE level;
  // concatenation yields GenericStringError and breaks deno check.
  const ticketRow = await admin
    .from("tickets")
    .select(
      "id, consumer_id, project_id, status, story_status, review_status, check_subtotal_cents, tip_cents, tip_pct, total_cents, discount_percent",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketRow.error) {
    return json(
      { ok: false, error: `ticket_lookup: ${ticketRow.error.message}` },
      500,
    );
  }
  if (!ticketRow.data || ticketRow.data.consumer_id !== authRes.user.id) {
    // Uniform miss — never confirms someone else's ticket exists.
    return json({ ok: false, error: "Ticket not found" }, 404);
  }
  const ticket = ticketRow.data;

  if (ticket.status !== CLOSED_TICKET_STATUS) {
    return json(
      { ok: false, error: "The total can be added once the visit is closed." },
      409,
    );
  }
  if ((ticket.check_subtotal_cents ?? 0) > 0 || (ticket.total_cents ?? 0) > 0) {
    return json(
      { ok: false, error: "This ticket already has an amount on record." },
      409,
    );
  }

  // Same math as the staff bill: live best-of rate × the capped portion.
  // The snapshotted percent (if any legacy value exists) never lowers it.
  const live = await resolveLiveTicketRate(admin, ticket);
  if (!live.ok) return json({ ok: false, error: live.error }, 500);
  const ratePercent = Math.max(live.ratePercent, ticket.discount_percent ?? 0);

  // v4 (MESITA-1087): the after-the-fact record keeps whatever tip the ticket
  // already carries — preset recomputes on the entered total, custom carries.
  const billRes = computeTicketBill({
    subtotal: total,
    ratePercent,
    capPesos: live.capPesos,
    tipPct: ticket.tip_pct,
    carryTipCents: ticket.tip_cents,
  });
  if (!billRes.ok) {
    return json({ ok: false, error: billRes.error, code: billRes.code }, 400);
  }
  const snap = billRes.snapshot;

  const updated = await admin
    .from("tickets")
    .update({
      check_subtotal_cents: snap.checkSubtotalCents,
      tip_cents: snap.tipCents,
      total_cents: snap.totalCents,
      discount_percent: snap.discountPercent,
      discount_cents: snap.discountCents,
      bill_source: "consumer",
    })
    .eq("id", ticketId)
    .eq("status", CLOSED_TICKET_STATUS)
    .is("bill_source", null) // a concurrent business record wins
    .select(
      "id, status, check_subtotal_cents, total_cents, discount_percent, discount_cents, bill_source, currency",
    )
    .single();
  if (updated.error) {
    return json(
      { ok: false, error: `ticket_update: ${updated.error.message}` },
      500,
    );
  }

  return json({ ok: true, ticket: updated.data });
});
