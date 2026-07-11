// Shared client-side validators. Mirror the Edge Function checks so the
// UI rejects junk before a roundtrip; the EFs still re-validate
// authoritatively. Keep these intentionally permissive — Supabase /
// downstream consumers normalise further.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// OTP codes are exactly 6 ASCII digits — same shape for phone and email
// verification. Callers trim before passing.
const OTP_CODE_RE = /^\d{6}$/;

export function isOtpCode(value: string): boolean {
  return OTP_CODE_RE.test(value);
}
