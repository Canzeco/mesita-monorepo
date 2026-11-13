// THE PAY KEYPAD AND ITS RULES (MESITA-3739). The guest types the bill and
// an Other tip on a keypad drawn in the page, never the phone's keyboard
// (which covered Next and pushed the step into a scroll). These are the pure
// rules behind it, React-free so they are tested on their own:
//
//   pressKey   one key on the amount text; it can only produce "" or text
//              readAmount accepts (≤ 7 integer digits, ≤ 2 decimals).
//   draftAmount  an amount saved before the keypad (or typed "1,250") put
//              into the keypad's own form, so a key never extends junk.
//   readTip    a typed tip: readAmount, and 0 too (no tip is Other with 0
//              typed, MESITA-3748; a bill is never 0).
//   draftTip   draftAmount for a typed tip: it keeps the 0.
//   payProblem what stops Pay: a code and the guest's sentence (null =
//              good to go). The screen acts on the code, never the sentence.
//   tipWays    the ways a tip can go when credit pays the whole bill: only
//              those payProblem would accept, so the screen never offers a
//              way the next check refuses.
//   amountShown  the typed amount in the app's money format (MESITA-3759):
//              the formatter's own prefix and suffix for the currency, the
//              whole part grouped, the decimals exactly as typed, and the
//              cents not typed yet as a muted ghost, so an amount always
//              reads with two decimals ("$20.00MX", MESITA-3766).
//   payButton  the Pay step's button and the one line above it, for every
//              shape a split can take. The button's amount is what the tap
//              charges or spends in the app: credit + card bill + card tip.
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

/** A typed tip in cents: what readAmount reads, and 0 ("0", "0.", "0.00").
 *  Empty or junk is null: nothing typed yet. */
export function readTip(text: string): number | null {
  const cents = readAmount(text);
  if (cents !== null) return cents;
  return /^0(\.0{0,2})?$/.test(text.replace(/[,\s]/g, "")) ? 0 : null;
}

/** A saved Other tip in the keypad's form: what readTip reads, or "". */
export function draftTip(text: string | undefined | null): string {
  if (!text) return "";
  const cents = readTip(text);
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

export type PayProblemCode = "card_unavailable" | "add_card" | "cash_off" | "card_min" | "card_tip_alone";
export type PayProblem = { code: PayProblemCode; message: string };

/** What stops Pay: its code and the guest's sentence; null when it can go. */
export function payProblem(a: PayProblemArgs): PayProblem | null {
  if (a.billCents <= 0) return null;
  const split = paySplit(a);
  const cardParts = split.card_bill_cents + split.card_tip_cents;
  const cashParts = split.cash_bill_cents + split.cash_tip_cents;
  if (cashParts === 0 && cardParts === 0) return null;
  if (cardParts > 0 && a.place.card_ok !== true) return { code: "card_unavailable", message: TAB_REFUSAL.card_unavailable };
  if (cardParts > 0 && !a.cardId) return { code: "add_card", message: "Add a card to pay by card." };
  if (cashParts > 0 && a.place.outside_ok !== true) return { code: "cash_off", message: TAB_REFUSAL.cash_off };
  if (cardParts > 0 && cardParts < a.place.card_min_cents) {
    return { code: "card_min", message: `Cards need at least ${money(a.place.card_min_cents, a.place.currency)} here.` };
  }
  if (split.card_tip_alone) return { code: "card_tip_alone", message: TAB_REFUSAL.card_tip_alone };
  return null;
}

/** The ways the tip can go when credit already pays the whole bill. */
export function tipWays(a: Omit<PayProblemArgs, "tipWith">): PayWith[] {
  return (["cash", "card"] as const).filter((w) => payProblem({ ...a, tipWith: w }) === null);
}

/** The typed amount as the screen draws it. `prefix` and `suffix` are what
 *  the money formatter puts around an amount in this currency (pesos read
 *  "$" before and "MX" after); `body` is what the guest typed, the whole
 *  part with thousands separators and the decimal part exactly as typed
 *  ("12." stays "12."); `ghost` is the rest of the two decimals, drawn muted,
 *  so the amount always reads with cents: "20" shows "20" + ".00", "20.5"
 *  shows "20.5" + "0" (MESITA-3766). Nothing typed: body "" and ghost
 *  "0.00", all muted. */
export function amountShown(text: string, currency: string): { prefix: string; body: string; ghost: string; suffix: string } {
  const zero = money(0, currency);
  const at = zero.indexOf("0");
  const prefix = at < 0 ? "" : zero.slice(0, at);
  const suffix = at < 0 ? "" : zero.slice(at).replace(/^[0.,]+/, "");
  if (text === "") return { prefix, body: "", ghost: "0.00", suffix };
  const dot = text.indexOf(".");
  const whole = dot < 0 ? text : text.slice(0, dot);
  const rest = dot < 0 ? "" : text.slice(dot);
  const ghost = dot < 0 ? ".00" : "00".slice(rest.length - 1);
  return { prefix, body: whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + rest, ghost, suffix };
}

export type PayButtonSplit = {
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
  card_bill_cents: number;
  card_tip_cents: number;
};

/** The Pay step's button and the line above it (MESITA-3798). The Pay
 *  step's rows already say how each way is paid (the card, the credits, the
 *  cash), so the line is only the cash that stays at the table:
 *
 *    anything moves in the app   Pay $490 · "+ $200 cash to the waiter" or none
 *    all cash                    I paid (no line; MESITA-3823)
 *
 *  The button's amount is always credit + card bill + card tip: what this
 *  tap charges or spends in the app. Cash is handed to the waiter, and a
 *  cash-only tap moves nothing: it opens the QR the waiter signs. */
export function payButton(split: PayButtonSplit, o: { m: (cents: number) => string }): { button: string; line: string | null } {
  const inApp = split.credit_cents + split.card_bill_cents + split.card_tip_cents;
  const cash = split.cash_bill_cents + split.cash_tip_cents;
  if (inApp === 0) return { button: "I paid", line: null };
  return { button: `Pay ${o.m(inApp)}`, line: cash > 0 ? `+ ${o.m(cash)} cash to the waiter` : null };
}
