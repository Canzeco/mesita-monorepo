// "I run this place" (MESITA-3103), the two proofs this release ships:
//
//   phone_match  the phone the guest signed in with (Supabase phone OTP, so
//                they hold it) is the phone on the place's listing: approved
//                on the spot.
//   review       anything else: a short request a super-admin approves or
//                rejects in the Business app's Internal page.
//
// MESITA-3093's code channel (Twilio Verify to the listing phone, `phone_code`)
// writes the same rows when it ships; until then it does not exist.

import { phoneDigits } from "./phone.ts";

/** How long a verification lasts before the guest proves it again. */
export const VERIFICATION_DAYS = 365;

/** National digits: the last ten, so `+52 1 81…` (the old Mexican mobile
 *  prefix), `+52 81…` and a listing written `81 …` all compare equal. */
function nationalDigits(raw: string): string {
  const digits = phoneDigits(raw);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** True when the signed-in phone is the listing's phone. Pure. A missing or
 *  short number on either side never matches. */
export function phoneMatches(userPhone: string | null | undefined, placePhone: string | null | undefined): boolean {
  if (!userPhone || !placePhone) return false;
  const a = nationalDigits(userPhone);
  const b = nationalDigits(placePhone);
  return a.length === 10 && a === b;
}

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

/** Trimmed text within a limit, or null when blank; `undefined` for too long. */
export function boundedText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? undefined : t;
}
