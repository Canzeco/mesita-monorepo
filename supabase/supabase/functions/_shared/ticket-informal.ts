// The reward ticket's close, plus the cap helper the bill math uses. The
// rate is `resolveTicketRate` (rewards-config.ts) and the bill is
// `computeTicketBill` (business-ticket-billing.ts); this file only caps the
// discount base and closes the ticket, for every close path (the check page,
// the business console, the guest's payment pick, the Stripe webhook).
// Discounts only: Mesita never holds a balance, so there is no redeem/ledger
// step — the discount is applied straight to the bill.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { recordFirstTicketHonored } from "./membership-enforcement.ts";
import { ensureConsumerReviewNotification } from "./ticket-review-notify.ts";
import { CLOSED_TICKET_STATE } from "./ticket-state.ts";
import { writeTicket } from "./ticket-doc.ts";
import {
  type VisitTenderRow,
  recordVisitTenders,
} from "./visit-tenders.ts";

/** Promo rate applies to food/drink subtotal only — tip is excluded. */
export function promoEligibleSubtotalCents(
  subtotal: number,
  capPesos: number | null | undefined,
): number {
  if (capPesos != null && capPesos > 0) {
    return Math.min(subtotal, capPesos * 100);
  }
  return subtotal;
}

/**
 * Close a reward ticket: reveal it (idempotent) and stamp the close time.
 * Discounts only — the reward was applied at the bill, so closing is just a
 * state flip; there is no payment to settle.
 */
export async function finalizeInformalTicket(
  admin: SupabaseClient,
  ticketId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ticket = await admin
    .from("visit_tickets")
    .select(
      "id, state, place_id, bill_subtotal_cents, total_cents, discount_cents, discount_percent",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket.error || !ticket.data) {
    return { ok: false, error: ticket.error?.message ?? "ticket not found" };
  }
  if (ticket.data.state === CLOSED_TICKET_STATE) return { ok: true };

  const now = new Date().toISOString();
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticketId,
    patch: {
      state: CLOSED_TICKET_STATE,
      revealed_at: now,
      paid_at: now,
    },
  });
  if (!update.ok) return { ok: false, error: update.error };

  // Activation binds to the CLOSE (v3b, MESITA-850) — the close is the only
  // unconditional signal that the place honored a guest. With a bill on
  // record, a zero-discount ticket still doesn't count (nothing was given);
  // with no bill, the discount was applied at the place's own POS per the
  // stated offer, so the close itself is the honor.
  const billed = ((ticket.data.total_cents as number | null) ?? 0) > 0 ||
    ((ticket.data.bill_subtotal_cents as number | null) ?? 0) > 0;
  const discount =
    (ticket.data.discount_cents as number | null) ??
    (ticket.data.discount_percent as number | null) ??
    0;
  if ((!billed || discount > 0) && ticket.data.place_id) {
    await recordFirstTicketHonored(admin, ticket.data.place_id as string);
  }

  return { ok: true };
}

/** Reveal a ticket and queue the consumer's review prompt. */
export type CloseTicketSettlement = { tenders: VisitTenderRow[] };

export async function closeTicketAndEnqueueReview(
  admin: SupabaseClient,
  ticketId: string,
  consumerId: string,
  projectId: string,
  settlement: CloseTicketSettlement,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const recorded = await recordVisitTenders(admin, ticketId, settlement.tenders);
  if (!recorded.ok) return { ok: false, error: recorded.error };
  const fin = await finalizeInformalTicket(admin, ticketId);
  if (!fin.ok) return fin;
  await ensureConsumerReviewNotification(admin, consumerId, ticketId, projectId);
  return { ok: true };
}
