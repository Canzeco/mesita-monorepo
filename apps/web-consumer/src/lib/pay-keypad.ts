// THE PAY KEYPAD AND ITS RULES (MESITA-3739). The guest types the bill and
// an Other tip on a keypad drawn in the page, never the phone's keyboard
// (which covered Next and pushed the step into a scroll). These are the pure
// rules behind it, React-free so they are tested on their own:
//
//   pressKey   one key on the amount text; it can only produce "" or text
//              readAmount accepts (≤ 7 integer digits, ≤ 2 decimals).
//   draftAmount  an amount saved before the keypad (or typed "1,250") put
//              into the keypad's own form, so a key never extends junk.
//   payProblem what stops Pay, in the guest's words (null = good to go).
//   tipWays    the ways a tip can go when credit pays the whole bill: only
//              those payProblem would accept, so the screen never offers a
//              way the next check refuses.
//
// Every peso is still the server's; these only decide what the screen offers.

import { amountText, readAmount } from "@mesita/place-profile/lib/money";
import { type PayWith, TAB_REFUSAL, tabSplit } from "@/lib/api/tab";
import { money, type PayPlace } from "@/lib/api/wallet";

export type PadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

const MAX_INT_DIGITS = 7;
const MAX_DECIMALS = 2;

/** The amount text after one key. */
export function pressKey(text: string, key: PadKey): string {
  if (key === "back") return text.slice(0, -1);
  const dot = text.indexOf(".");
  if (key === ".") {
    if (dot >= 0) return text;
    return text === "" ? "0." : `${text}.`;
  }
  if (dot >= 0) {
    return text.length - dot - 1 >= MAX_DECIMALS ? text : text + key;
  }
  if (text === "0") return key;
  if (text.length >= MAX_INT_DIGITS) return text;
  return text + key;
}

/** Whether a key would change the text now (a dead key is dimmed). */
export function keyLive(text: string, key: PadKey): boolean {
  return pressKey(text, key) !== text;
}

/** A saved amount in the keypad's form: what readAmount reads, or "". */
export function draftAmount(text: string | undefined | null): string {
  if (!text) return "";
  const cents = readAmount(text);
  return cents === null ? "" : amountText(cents);
}

export type PayProblemArgs = {
  place: PayPlace;
  billCents: number;
  tipCents: number;
  spendableCents: number;
  useCredit: boolean;
  restWith: PayWith | null;
  tipWith: PayWith;
  /** The saved card a card part would use; null when the guest has none. */
  cardId: string | null;
};

export function paySplit(a: PayProblemArgs) {
  return tabSplit({
    billCents: a.billCents,
    tipCents: a.tipCents,
    spendableCents: a.spendableCents,
    useCredit: a.useCredit && a.spendableCents > 0,
    cashBackBps: a.place.outside_bps ?? 0,
    cardBackBps: a.place.cashback_bps ?? 0,
    billWith: a.restWith ?? "cash",
    tipWith: a.tipWith,
  });
}

/** What stops Pay, in the guest's words; null when it can go. */
export function payProblem(a: PayProblemArgs): string | null {
  if (a.billCents <= 0) return null;
  const split = paySplit(a);
  const cardParts = split.card_bill_cents + split.card_tip_cents;
  const cashParts = split.cash_bill_cents + split.cash_tip_cents;
  if (cashParts === 0 && cardParts === 0) return null;
  if (cardParts > 0 && a.place.card_ok !== true) return TAB_REFUSAL.card_unavailable;
  if (cardParts > 0 && !a.cardId) return "Add a card to pay by card.";
  if (cashParts > 0 && a.place.outside_ok !== true) return TAB_REFUSAL.cash_off;
  if (cardParts > 0 && cardParts < a.place.card_min_cents) {
    return `Cards need at least ${money(a.place.card_min_cents, a.place.currency)} here.`;
  }
  if (split.card_tip_alone) return TAB_REFUSAL.card_tip_alone;
  return null;
}

/** The ways the tip can go when credit already pays the whole bill. */
export function tipWays(a: Omit<PayProblemArgs, "tipWith">): PayWith[] {
  return (["cash", "card"] as const).filter((w) => payProblem({ ...a, tipWith: w }) === null);
}
