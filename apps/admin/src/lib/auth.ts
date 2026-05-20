// Tiny shared-password gate. One password, no users, no email, no DB.
//
// The cookie value is the password itself (HttpOnly + Secure in prod).
// If you can read the cookie you already have the password — fine for
// an internal admin console with a single rotating shared secret.
//
// Set ADMIN_PASSWORD in Vercel (Production + Preview + Development) and
// in .env.local for local runs. Pick something long: 24+ chars from a
// password manager. Rotate by changing the env var; all existing
// cookies invalidate on next request.

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Edge-runtime safe: middleware runs on the Edge, so we can't import
// node:crypto. Web Crypto's subtle.timingSafeEqual doesn't exist either,
// so we do it by hand. Constant-time relative to the first arg's length,
// which is always the (server-side) expected password.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function isValidSession(
  cookieValue: string | undefined,
  expected: string | undefined,
): boolean {
  if (!cookieValue || !expected) return false;
  return timingSafeEqual(cookieValue, expected);
}
