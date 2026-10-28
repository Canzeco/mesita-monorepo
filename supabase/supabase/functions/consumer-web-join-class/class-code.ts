// The VIP join code a guest types on /me/class (MESITA-2984): twelve digits.
// Spaces and dashes are how people copy a long number, so they are dropped;
// anything else, or a count other than twelve, is not a code.

export const CLASS_CODE_DIGITS = 12;

/** The twelve digits, or null when `raw` is not a code. */
export function parseClassCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{12}$/.test(digits) ? digits : null;
}
