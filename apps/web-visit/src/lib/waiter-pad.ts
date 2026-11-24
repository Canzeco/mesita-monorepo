// The waiter's keypad (MESITA-4871): amounts and the 6-digit code are typed on
// keys drawn in the page, as in the guest app; the phone keyboard never opens.

import { readAmount } from "@mesita/place-profile/lib/money";

export const WAITER_CODE_LENGTH = 6;
export type Key = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

/** The server's ceiling: 100,000.00 a bill or a tip. */
const MAX_CENTS = 10_000_000;

/** The amount text after one key: always "" or what readAmount accepts. */
export function pressAmount(text: string, key: Key): string {
  if (key === "back") return text.slice(0, -1);
  const dot = text.indexOf(".");
  if (key === ".") return dot >= 0 ? text : text === "" ? "0." : `${text}.`;
  if (dot >= 0 && text.length - dot > 2) return text;
  const next = text === "0" ? key : text + key;
  return Number(next) * 100 > MAX_CENTS ? text : next;
}

export function pressCode(code: string, key: Key): string {
  if (key === "back") return code.slice(0, -1);
  return key === "." || code.length >= WAITER_CODE_LENGTH ? code : code + key;
}

/** Nothing or zero typed is no tip. */
export const tipOf = (text: string): number => readAmount(text) ?? 0;

/** A typed amount as it reads: "1,250.5" and the cents not typed yet. */
export function amountParts(text: string): { typed: string; ghost: string } {
  if (text === "") return { typed: "", ghost: "0.00" };
  const [whole, dec] = text.split(".");
  return {
    typed: whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec === undefined ? "" : `.${dec}`),
    ghost: dec === undefined ? ".00" : "00".slice(dec.length),
  };
}
