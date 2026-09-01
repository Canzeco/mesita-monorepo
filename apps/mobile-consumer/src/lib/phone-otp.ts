// Phone-OTP helpers — hand-mirrored from
// apps/web-consumer/src/lib/phone-otp.ts. Keep the two in step (same
// convention as consumer-route-contract.ts).
//
// E.164 assembly, per-country length validation, and human-readable copy
// for the errors Supabase Auth + Twilio actually return. Every send is a
// real SMS we pay for, so a malformed number is caught on device rather
// than bounced back as a raw provider string.

import { COUNTRY_BY_CODE } from '@/lib/countries';

/** Supabase Auth `sms.max_frequency` — one send per minute per number. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Digits Supabase's phone provider issues (dashboard: SMS OTP length). */
export const OTP_LENGTH = 6;

const NATIONAL_LENGTH: Record<string, { min: number; max: number }> = {
  MX: { min: 10, max: 10 },
  US: { min: 10, max: 10 },
  CA: { min: 10, max: 10 },
  DO: { min: 10, max: 10 },
  PR: { min: 10, max: 10 },
  ES: { min: 9, max: 9 },
  AR: { min: 10, max: 11 },
  CO: { min: 10, max: 10 },
  CL: { min: 9, max: 9 },
  PE: { min: 9, max: 9 },
  BR: { min: 10, max: 11 },
  UK: { min: 10, max: 10 },
  FR: { min: 9, max: 9 },
  DE: { min: 10, max: 11 },
  IT: { min: 9, max: 10 },
  NL: { min: 9, max: 9 },
  PT: { min: 9, max: 9 },
  JP: { min: 10, max: 10 },
  AU: { min: 9, max: 9 },
};
const DEFAULT_LENGTH = { min: 7, max: 15 };

const TRUNK_PREFIX_ZERO = new Set(['UK', 'DE', 'FR', 'NL', 'AU', 'AR']);

/**
 * Strip formatting and national trunk prefixes so what's left is the true
 * subscriber number. Mexico is the one that bites us daily: "1 55…" (the
 * old cellular prefix) and "044/045 55…" are still muscle memory.
 */
function normalizeNationalDigits(countryCode: string, raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (countryCode === 'MX') {
    if (digits.length === 13 && /^04[45]/.test(digits)) digits = digits.slice(3);
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  }
  if (TRUNK_PREFIX_ZERO.has(countryCode)) {
    digits = digits.replace(/^0+/, '');
  }
  return digits;
}

export type PhoneParseResult =
  | { ok: true; e164: string; digits: string }
  | { ok: false; error: string };

/** Assemble strict E.164 (`+<dial><national>`, no spaces). */
export function parsePhone(countryCode: string, raw: string): PhoneParseResult {
  const country = COUNTRY_BY_CODE[countryCode] ?? COUNTRY_BY_CODE.MX;
  const digits = normalizeNationalDigits(countryCode, raw);
  if (!digits) return { ok: false, error: 'Enter your phone number.' };

  const { min, max } = NATIONAL_LENGTH[countryCode] ?? DEFAULT_LENGTH;
  if (digits.length < min) {
    return {
      ok: false,
      error:
        min === max
          ? `That number is too short — ${country.name} numbers have ${min} digits.`
          : `That number is too short for ${country.name}.`,
    };
  }
  if (digits.length > max) {
    return {
      ok: false,
      error:
        min === max
          ? `That number is too long — ${country.name} numbers have ${min} digits.`
          : `That number is too long for ${country.name}.`,
    };
  }
  return { ok: true, e164: `+${country.dial}${digits}`, digits };
}

const TWILIO_MESSAGES: Record<string, string> = {
  '21211': "That number doesn't look valid. Check it and try again.",
  '21408': "We can't text that country yet. Try another number or reach out to us.",
  '21610': 'That number opted out of our messages. Reply START to re-enable.',
  '21612': "We can't deliver a code to that number. Try another one.",
  '21614': "That number can't receive SMS. Try a mobile number.",
  '30003': "That phone is unreachable — check it's on and has signal.",
  '30005': "That number doesn't exist. Check it and try again.",
  '30006': "That's a landline. Use a mobile number.",
};

type MaybeAuthError = {
  message?: string;
  code?: string | null;
  status?: number | null;
};

/** Map a Supabase Auth error to copy a guest can act on. */
export function otpErrorMessage(error: MaybeAuthError | null): string {
  if (!error) return 'Something went wrong. Try again.';
  const message = error.message ?? '';
  const code = error.code ?? '';

  if (code === 'over_sms_send_rate_limit' || /only request this after/i.test(message)) {
    const seconds = message.match(/after (\d+) seconds?/i)?.[1];
    return seconds
      ? `Hold on — you can ask for a new code in ${seconds}s.`
      : 'Hold on — you can ask for a new code in a moment.';
  }
  if (code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (code === 'otp_expired' || /expired/i.test(message)) {
    return 'That code expired. Ask for a new one.';
  }
  if (code === 'otp_disabled') {
    return 'Phone sign-in is temporarily unavailable. Try again shortly.';
  }
  if (/invalid|incorrect/i.test(message) && /token|otp|code/i.test(message)) {
    return "That code isn't right. Check the 6 digits and try again.";
  }
  const twilioCode = message.match(/twilio\.com\/docs\/errors\/(\d+)/i)?.[1];
  if (twilioCode && TWILIO_MESSAGES[twilioCode]) {
    return TWILIO_MESSAGES[twilioCode];
  }
  if (code === 'sms_send_failed') {
    return "We couldn't send the code. Check the number and try again.";
  }
  return message || 'Something went wrong. Try again.';
}
