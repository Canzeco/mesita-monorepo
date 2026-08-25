// Discount ticket math — shared by the check page and the business console
// (validate-web-mark-paid, business-web-mark-ticket-paid, via
// business-ticket-billing.ts). Discounts only: Mesita never holds a balance,
// so there is no redeem/ledger step — the discount is applied straight to the
// bill.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { hasMesitaReview, isConsumerFirstVisit } from "./membership.ts";
import {
  loadRewardsGrid,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";
import { ratesForBilling } from "./ticket-rate-snapshot.ts";
import { ratesFromPlace } from "./promo-strategy.ts";
import { resolveBillCapPesos } from "./discount-cap.ts";
import { recordFirstTicketHonored } from "./membership-enforcement.ts";
import {
  buildConsumerBillPayload,
  formatMoneyMx,
  placeInstagramHandleForPayload,
} from "./ticket-bill-payload.ts";
import { ensureConsumerReviewNotification } from "./ticket-review-notify.ts";
import { CLOSED_TICKET_STATUS } from "./ticket-status.ts";
import { writeTicket } from "./ticket-doc.ts";

export {
  buildConsumerBillPayload,
  formatMoneyMx,
  placeInstagramHandleForPayload,
};

export {
  prepareTicketForReview,
  ensureConsumerReviewNotification,
} from "./ticket-review-notify.ts";

export type PlaceRateRow = {
  id: string;
  name: string;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
  fiscal_type: string;
  listing_type: string;
  status: string;
};

export type ConsumerRow = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  class_key: string | null;
  class_origin: string | null;
  instagram_followers_count: number | null;
  phone: string | null;
};

export type InformalBillCalc = {
  subtotal: number;
  tip: number;
  total: number;
  eligibleCents: number;
  ratePercent: number;
  discountPercent: number;
  discountCents: number;
  amountDueCents: number;
};

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

export async function computeInformalBill(
  admin: SupabaseClient,
  place: PlaceRateRow,
  consumer: ConsumerRow,
  subtotal: number,
  _tip: number,
  // The Mesita-review rung is granted once, on the ticket that carries the
  // review (v9, MESITA-877) — so it can only be resolved with a ticket in
  // hand. A caller without one simply doesn't qualify for that rung.
  ticketId?: string,
  ticketRates?: Record<string, unknown>,
): Promise<InformalBillCalc> {
  const total = subtotal;
  // Promos v5 best-of (MESITA-723): strategy (from snapshotted ticket rates
  // when present, else live place rates) × the operator grid.
  const grid = await loadRewardsGrid(admin);
  const [firstVisit, mesitaReviewed] = await Promise.all([
    isConsumerFirstVisit(admin, consumer.id, place.id),
    ticketId ? hasMesitaReview(admin, ticketId) : Promise.resolve(false),
  ]);
  const billingRates = ticketRates
    ? ratesForBilling(ticketRates, place as Record<string, unknown>)
    : ratesFromPlace(place as Record<string, unknown>);
  const ratePercent = resolveTicketRate(
    placeStrategy(billingRates as Record<string, unknown>),
    grid,
    {
      classKey: consumer.class_key,
      isFirstVisit: firstVisit,
      mesitaReviewed,
    },
  );

  const capPesos = resolveBillCapPesos(place as Record<string, unknown>, grid.cap);
  const eligibleCents = promoEligibleSubtotalCents(subtotal, capPesos);

  const discountPercent = ratePercent;
  let discountCents = Math.floor((eligibleCents * ratePercent) / 100);
  if (discountCents > subtotal) discountCents = subtotal;

  const amountDueCents = subtotal - discountCents;

  return {
    subtotal,
    tip: 0,
    total,
    eligibleCents,
    ratePercent,
    discountPercent,
    discountCents,
    amountDueCents,
  };
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
      "id, status, place_id, bill_subtotal_cents, total_cents, discount_cents, discount_percent",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket.error || !ticket.data) {
    return { ok: false, error: ticket.error?.message ?? "ticket not found" };
  }
  if (ticket.data.status === CLOSED_TICKET_STATUS) return { ok: true };

  const now = new Date().toISOString();
  const update = await writeTicket(admin, {
    mode: "update",
    id: ticketId,
    patch: {
      status: CLOSED_TICKET_STATUS,
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
export async function closeTicketAndEnqueueReview(
  admin: SupabaseClient,
  ticketId: string,
  consumerId: string,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fin = await finalizeInformalTicket(admin, ticketId);
  if (!fin.ok) return fin;
  await ensureConsumerReviewNotification(admin, consumerId, ticketId, projectId);
  return { ok: true };
}
