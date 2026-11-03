// "I run this place" (MESITA-3103). Since the Business app signs in with
// Google only (MESITA-3105), the proof is a review: a short request a
// super-admin approves or rejects in the Business app's Internal page.
// (`phone_match` rows from before stay valid until they expire.)
//
// MESITA-3093's code channel (Twilio Verify to the listing phone, `phone_code`)
// writes the same rows when it ships; until then it does not exist.

import { phoneDigits } from "./phone.ts";

/** How long a verification lasts before the guest proves it again. */
export const VERIFICATION_DAYS = 365;

/** The listing phone as a guest may see it before proving anything:
 *  `+52 ••• ••• 12 34`. Null when there is none. */
export function maskPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = phoneDigits(raw);
  if (digits.length < 4) return null;
  const tail = digits.slice(-4);
  const country = raw.trim().startsWith("+") && digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "";
  return `${country}••• ••• ${tail.slice(0, 2)} ${tail.slice(2)}`;
}

/** Whose place it is, as a stranger may see it (MESITA-3155: "the email
 *  termination of the owner"): the first letter and the domain,
 *  `p•••@canzeco.com`. Null when there is no usable address. */
export function maskEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim();
  const at = email ? email.lastIndexOf("@") : -1;
  if (!email || at < 1 || at === email.length - 1) return null;
  return `${email[0]}•••${email.slice(at)}`;
}

/** Trimmed text within a limit, or null when blank; `undefined` for too long. */
export function boundedText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? undefined : t;
}
