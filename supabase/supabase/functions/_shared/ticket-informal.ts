// Discount ticket math — shared by the check page and the business console
// (check-web-mark-paid, business-web-mark-ticket-paid, via
// business-ticket-billing.ts). Discounts only: Mesita never holds a balance,
// so there is no redeem/ledger step — the discount is applied straight to the
// bill.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isConsumerFirstVisit } from "./membership.ts";
import {
  loadRewardsGrid,
  placeStrategy,
  resolveTicketRate,
} from "./rewards-config.ts";
import { recordFirstTicketHonored } from "./membership-enforcement.ts";
import {
  buildConsumerBillPayload,
  formatMoneyMx,
  placeInstagramHandleForPayload,
} from "./ticket-bill-payload.ts";
import { ensureConsumerReviewNotification } from "./ticket-review-notify.ts";

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
  consumer_instagram_followers_count: number | null;
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
): Promise<InformalBillCalc> {
  const total = subtotal;
  // Promos v5 best-of (MESITA-723): strategy (from the place's v4 rate columns)
  // × the operator grid.
  const grid = await loadRewardsGrid(admin);
  const firstVisit = await isConsumerFirstVisit(admin, consumer.id, place.id);
  const ratePercent = resolveTicketRate(placeStrategy(place), grid, {
    classKey: consumer.class_key,
    isFirstVisit: firstVisit,
  });

  const capPesos = grid.cap;
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
    .from("tickets")
    .select("id, status, project_id, discount_cents, discount_percent")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket.error || !ticket.data) {
    return { ok: false, error: ticket.error?.message ?? "ticket not found" };
  }
  if (ticket.data.status === "revealed") return { ok: true };

  const now = new Date().toISOString();
  const update = await admin
    .from("tickets")
    .update({
      status: "revealed",
      revealed_at: now,
      paid_at: now,
    })
    .eq("id", ticketId);
  if (update.error) return { ok: false, error: update.error.message };

  // Honoring a discount ticket completes the Promos v4 activation gate
  // (MESITA-542). Zero-discount tickets don't count.
  const discount =
    (ticket.data.discount_cents as number | null) ??
    (ticket.data.discount_percent as number | null) ??
    0;
  if (discount > 0 && ticket.data.project_id) {
    await recordFirstTicketHonored(admin, ticket.data.project_id as string);
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
