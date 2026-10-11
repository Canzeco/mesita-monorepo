/** Digits-only phone helper. */

export function phoneDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
