// Wallet's Pay Here and Method (MESITA-4485). A failed bill read must not
// look like a clear bill, and a missing card list must not look like Add card.

export type BillRead = "loading" | "clear" | "open" | "unknown";

/** Clear only after a successful visits read, every local id resolved, and
 *  no draft. A loaded tab or a draft is open. Anything else stays unknown. */
export function billRead(i: {
  visitsOk: boolean;
  missed: boolean;
  live: number;
  draft: boolean;
}): Exclude<BillRead, "loading"> {
  if (i.live > 0 || i.draft) return "open";
  if (!i.visitsOk || i.missed) return "unknown";
  return "clear";
}

/** Pay Here opens this place's checkout, this place's open bill, or nothing. */
export function payHere(bill: BillRead, samePlace: boolean): "checkout" | "bill" | "blocked" {
  if (bill === "loading" || bill === "unknown") return "blocked";
  if (bill === "open") return samePlace ? "bill" : "blocked";
  return "checkout";
}

/** undefined: not asked yet (bone). null: Stripe failed (Retry). []: Add card. */
export function methodFace(cards: unknown): "bone" | "retry" | "add" | "card" {
  if (cards === undefined) return "bone";
  if (cards === null) return "retry";
  if (Array.isArray(cards) && cards.length === 0) return "add";
  if (Array.isArray(cards) && cards.length > 0) return "card";
  return "retry";
}

/** Add Funds only when the place sells credit. A missing flag does not enable it. */
export function addFundsOn(cardOk: boolean | undefined): boolean {
  return cardOk === true;
}
