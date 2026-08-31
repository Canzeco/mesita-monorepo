import { promoEligibleSubtotalCents } from "./ticket-informal.ts";

export type TicketBillSnapshot = {
  checkSubtotalCents: number;
  tipCents: number;
  totalCents: number;
  discountPercent: number;
  discountCents: number;
  amountDueCents: number;
  eligibleCents: number;
};

type ComputeTicketBillInput = {
  subtotal: number;
  ratePercent: number;
  capPesos: number | null;
  /**
   * Preset tip percent (0–100, whole). Wins over carryTipCents when non-null,
   * so a bill re-entry recomputes the tip on the NEW subtotal.
   */
  tipPct?: number | null;
  /**
   * Server-trusted tip cents to carry forward: the ticket row's existing
   * tip_cents, or a custom peso amount ×100. NEVER a client-computed number —
   * C4-3: a client-sent tip_cents is ignored, not validated; only tip_pct or
   * a custom peso AMOUNT crosses the wire.
   */
  carryTipCents?: number | null;
};

/**
 * C4-1/2 — the tip formula, in exactly one place. Computed on the RAW guest
 * subtotal (never on eligibleCents, never on amountDueCents: a cap must not
 * shrink a waiter's tip), rounded to WHOLE PESOS with Math.round —
 * deliberately differing from the discount's Math.floor. Both roundings cut
 * against Mesita's interest, which is the correct bias; whole pesos keep the
 * displayed number (formatCurrency, 0 fraction digits) and the charged
 * number identical.
 */
export function tipCentsFor(subtotalCents: number, tipPct: number): number {
  const pct = Math.min(100, Math.max(0, Math.trunc(tipPct)));
  return Math.round((subtotalCents * pct) / 10000) * 100;
}

/**
 * C4-6 — THE amount-due formula. Three independent copies of this arithmetic
 * used to exist (here, ticket-check.ts, TicketScreen) and were equal only
 * because tip was always zero; every reader now consumes this one.
 * C4-8 rides along: the result is always >= tipCents — any future Credits
 * redemption may reduce only the (subtotal − discount) part, never the tip.
 */
export function amountDueCents(s: {
  checkSubtotalCents: number;
  discountCents: number;
  tipCents: number;
}): number {
  return Math.max(0, s.checkSubtotalCents - s.discountCents) + s.tipCents;
}

// Discounts only: the promo rate applies to the subtotal, the discount is
// applied at the bill, and the consumer pays the place directly. Mesita never
// holds a balance, so there is no redemption or credit here. The tip line
// (v4, MESITA-1087) is real money that rides THROUGH the bill untouched:
// computed on the pre-discount subtotal, excluded from the discount base,
// never capped, and paid to the place in full.
export function computeTicketBill(
  input: ComputeTicketBillInput,
): { ok: true; snapshot: TicketBillSnapshot } | { ok: false; code?: string; error: string } {
  const { subtotal, ratePercent, capPesos } = input;

  if (subtotal === 0) {
    return { ok: false, error: "Check total can't be zero" };
  }

  const tipCents = input.tipPct != null
    ? tipCentsFor(subtotal, input.tipPct)
    : Math.max(0, Math.trunc(input.carryTipCents ?? 0));

  // C4-4: the discount base is the raw subtotal (cap-limited), tip excluded;
  // the over-discount clamp stays bound to subtotal, never to total.
  const eligibleCents = promoEligibleSubtotalCents(subtotal, capPesos);

  const discountPercent = ratePercent;
  let discountCents = Math.floor((eligibleCents * ratePercent) / 100);
  if (discountCents > subtotal) discountCents = subtotal;

  // C4-5: total_cents is the pre-discount bill INCLUDING the tip.
  const totalCents = subtotal + tipCents;

  return {
    ok: true,
    snapshot: {
      checkSubtotalCents: subtotal,
      tipCents,
      totalCents,
      discountPercent,
      discountCents,
      amountDueCents: amountDueCents({
        checkSubtotalCents: subtotal,
        discountCents,
        tipCents,
      }),
      eligibleCents,
    },
  };
}
