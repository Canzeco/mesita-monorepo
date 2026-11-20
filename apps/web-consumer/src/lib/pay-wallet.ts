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

/** What a row's Pay does (MESITA-4497). Only a clear read starts a checkout.
 *  With a bill open, every Pay opens that bill: a second one never starts.
 *  A failed read asks again; a read in flight waits. */
export function payHere(bill: BillRead): "checkout" | "bill" | "recheck" | "wait" {
  if (bill === "loading") return "wait";
  if (bill === "unknown") return "recheck";
  if (bill === "open") return "bill";
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
