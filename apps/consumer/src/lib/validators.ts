// Shared client-side validators. Mirror the Edge Function checks so the
// UI rejects junk before a roundtrip; the EFs still re-validate
// authoritatively. Keep these intentionally permissive — Supabase /
// downstream consumers normalise further.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// https-only URLs. Matches manager-update-unit's isUrl(); Next.js Image
// also rejects http:// by default so this avoids mixed-content surprises.
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
