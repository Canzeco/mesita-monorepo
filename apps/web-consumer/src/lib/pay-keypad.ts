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
//   amountShown  the typed amount in the app's money format (MESITA-3759):
//              the formatter's own prefix and suffix for the currency, the
//              whole part grouped, the decimals exactly as typed, and the
//              cents not typed yet as a muted ghost, so an amount always
//              reads with two decimals ("$20.00MX", MESITA-3766).
//
// MESITA-4708: payProblem, tipWays, paySplit and payButton left with the card
// part of a bill (they weighed card against cash). Every peso is still the
// server's; these only decide what the screen offers.

import { amountText, readAmount } from "@mesita/place-profile/lib/money";
import { money } from "@/lib/api/wallet";

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
