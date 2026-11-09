// THE PAY TAB'S SPLIT (MESITA-3457). One amount, what the guest pays on
// Mesita: available credit covers it first, the rest goes by card where the
// place takes one. A tip is its own amount, by card only, with no fee and
// no cashback.
//
// ONE SOURCE, TWO READERS: this file is the source; packages/place-profile/
// src/pay-split.ts is its byte-identical copy (`deno task sync-shared`), so
// the form shows the same split the server will accept. It imports nothing.
// The server is still the last word: consumer-web-start-payment refuses
// below_minimum on card + tip and insufficient on credit, and the form
// recomputes on either.
//
// The minimum (Stripe's, per currency) arrives from the server as
// `card_min_cents` (MIN_CHARGE_CENTS in money.ts); the cashback rate as
// `cashback_bps`. Every number is integer centavos.

/** The smallest card part the form ever asks for. The server refuses a tip
 *  without a card part ("A tip goes with a card part"), so where credit
 *  would cover the whole amount and a tip is typed, at least this much of
 *  the amount moves to the card (decision on MESITA-3457). */
export const MIN_CARD_PART_CENTS = 100;

export type PaySplit =
  /** Credit covers it all; no card. */
  | { kind: "credit"; credit_cents: number; card_cents: 0; tip_cents: 0 }
  /** A card part (and the tip, if any). `raised` when less credit was used
   *  so card + tip reaches the card minimum. */
  | { kind: "card"; credit_cents: number; card_cents: number; tip_cents: number; raised: boolean }
  /** More than the credit at a place that takes no card. */
  | { kind: "over"; credit_cents: number; short_cents: number }
  /** A tip at a place that takes no card. */
  | { kind: "no_card_tip" }
  /** The card would be needed but even all of it stays under the minimum. */
  | { kind: "below_minimum"; minimum_cents: number };

export function paySplit(args: {
  amountCents: number;
  tipCents: number;
  availableCents: number;
  cardOk: boolean;
  minCents: number;
}): PaySplit {
  const amount = Math.max(0, Math.floor(args.amountCents));
  const tip = Math.max(0, Math.floor(args.tipCents));
  const min = Math.max(0, Math.floor(args.minCents));
  const credit = Math.min(amount, Math.max(0, Math.floor(args.availableCents)));
  const card = amount - credit;

  if (!args.cardOk) {
    if (tip > 0) return { kind: "no_card_tip" };
    if (card > 0) return { kind: "over", credit_cents: credit, short_cents: card };
    return { kind: "credit", credit_cents: credit, card_cents: 0, tip_cents: 0 };
  }
  if (card === 0 && tip === 0) return { kind: "credit", credit_cents: credit, card_cents: 0, tip_cents: 0 };
  if (card > 0 && card + tip >= min) {
    return { kind: "card", credit_cents: credit, card_cents: card, tip_cents: tip, raised: false };
  }
  // Card + tip is under the minimum, or a tip has no card part: move credit
  // to the card until both hold.
  const fromMin = min - tip;
  const target = Math.max(fromMin, MIN_CARD_PART_CENTS);
  if (target > amount) return { kind: "below_minimum", minimum_cents: min };
  return {
    kind: "card",
    credit_cents: amount - target,
    card_cents: target,
    tip_cents: tip,
    raised: fromMin >= MIN_CARD_PART_CENTS && fromMin > card,
  };
}

/** The cashback a card part earns, rounded down: what "You earn MX$4 back"
 *  prints. 0 when the place's Cashback is off (`cashback_bps` 0). */
export function cashbackFor(cardCents: number, cashbackBps: number): number {
  return Math.floor((Math.max(0, cardCents) * Math.max(0, cashbackBps)) / 10000);
}
