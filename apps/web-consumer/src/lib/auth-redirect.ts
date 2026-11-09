const CONSUMER_AFTER_AUTH = "/auth/post-signin";

/**
 * Safe in-app path for `?next=` (no open redirects). Rejects absolute URLs
 * and protocol-relative `//evil.com` — the only thing we ever honour is a
 * path on our own origin.
 */
export function safeNextPath(raw: string | undefined | null): string | null {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * After phone OTP (or a signed-in visit to /?next=…), always run
 * post-signin so consumer-signin-phone stamps role + profile.
 */
export function consumerAuthDestination(raw: string | undefined): string {
  const target = safeNextPath(raw);
  if (!target || target === CONSUMER_AFTER_AUTH) return CONSUMER_AFTER_AUTH;
  return `/auth/post-signin?next=${encodeURIComponent(target)}`;
}

/**
 * Append `?next=` to an in-app route, dropping it when the target isn't a
 * safe path. Used for every hop that has to hand the user's real
 * destination to the next surface: the auth wall → `/`, and both
 * `/auth/post-signin` and the (shell) gate → `/onboard`.
 *
 * Without this the destination dies at whichever hop forgets it — a guest
 * who opens a shared place link, signs in, and onboards used to be dumped
 * on /home/swipe with no idea what they'd clicked.
 */
export function withNext(route: string, raw: string | undefined | null): string {
  const target = safeNextPath(raw);
  return target ? `${route}?next=${encodeURIComponent(target)}` : route;
}

const PAY_PLACE_NEXT = /^\/pay\?(?:.*&)?place=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:&|$)/i;

/**
 * The Pay QR door (MESITA-3526): when the guest's `?next=` is a table QR's
 * `/pay?place=<id>`, the place id, so sign-in can say "Sign in to pay at
 * <name>". Anything else, null.
 */
export function payPlaceFromNext(raw: string | undefined | null): string | null {
  const target = safeNextPath(raw);
  if (!target) return null;
  const match = PAY_PLACE_NEXT.exec(target);
  return match ? match[1].toLowerCase() : null;
}
