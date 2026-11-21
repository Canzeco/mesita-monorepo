// Wallet's Pay Here and Method (MESITA-4485). A failed bill read must not
// look like a clear bill, and a missing card list must not look like Add card.

import { isExpired, payMethodOf, type PayMethod, type SavedCard } from "@/lib/api/cards";
import { pickCard } from "@/lib/pay-cards";

// THE DEFAULT WAY TO PAY (MESITA-4526). One answer for the Wallet header,
// the Payment methods page and checkout:
//
//   stored apple_pay/google_pay, in this browser  -> that wallet
//   stored card, a wallet not in this browser, or never chosen
//                                                 -> the default card
//   no usable card                                -> null ("Add payment method")
//
// The default card is the one checkout preselects: the remembered card if it
// is still saved and not expired, else the first non-expired one (Stripe's
// order, newest first).

export type DefaultMethod = { kind: "card"; card: SavedCard } | { kind: "apple_pay" } | { kind: "google_pay" } | null;

/** Whether this browser is Apple's (Apple Pay, no Google Pay button). The
 *  only test the app has without a place's Stripe element (MESITA-4397). */
export function isApplePhone(): boolean {
  return typeof window !== "undefined" && "ApplePaySession" in window;
}

/** Whether a phone wallet can be used in this browser. */
export function walletInBrowser(wallet: "apple_pay" | "google_pay", applePhone: boolean): boolean {
  return (wallet === "apple_pay") === applePhone;
}

/** The card checkout preselects: remembered if still usable, else the first
 *  non-expired one, else none. */
export function defaultCard(cards: SavedCard[], remembered: string | null, now: Date = new Date()): SavedCard | null {
  const usable = cards.filter((c) => !isExpired(c, now));
  const id = pickCard(usable, remembered);
  return usable.find((c) => c.id === id) ?? null;
}

export function defaultMethod(
  stored: unknown,
  cards: SavedCard[],
  applePhone: boolean,
  remembered: string | null = null,
  now: Date = new Date(),
): DefaultMethod {
  const s: PayMethod | null = payMethodOf(stored);
  if ((s === "apple_pay" || s === "google_pay") && walletInBrowser(s, applePhone)) return { kind: s };
  const card = defaultCard(cards, remembered, now);
  return card ? { kind: "card", card } : null;
}

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
