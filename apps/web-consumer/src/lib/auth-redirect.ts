const CONSUMER_AFTER_AUTH = "/auth/post-signin";

/**
 * Safe in-app path for `?next=` (no open redirects). Rejects absolute URLs
 * and protocol-relative `//evil.com` — the only thing we ever honour is a
 * path on our own origin.
 */
export function safeNextPath(raw: string | undefined | null): string | null {
  if (!raw?.startsWith("/") || raw.startsWith("//")) return null;
  // A browser reads `/\evil.com` as `//evil.com`, and a percent-encoded
  // slash or backslash can turn into one after a decode (MESITA-4246: Sign
  // links get shared, so `next` must never leave the site).
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  if (/%(2f|5c)/i.test(raw)) return null;
  try {
    const url = new URL(raw, "https://mesita.invalid");
    if (url.origin !== "https://mesita.invalid") return null;
  } catch {
    return null;
  }
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
export function withNext(
  route: string,
  raw: string | undefined | null,
): string {
  const target = safeNextPath(raw);
  return target ? `${route}?next=${encodeURIComponent(target)}` : route;
}

const UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
/** The table QR's shapes: the printed /pay?place=<id>, the door it forwards
 *  to, /pay/place/<id>, and that door's address before MESITA-4013,
 *  /pay/<id>. */
const PAY_PLACE_NEXT = [
  new RegExp(`^/pay\\?(?:.*&)?place=${UUID}(?:&|$)`, "i"),
  new RegExp(`^/pay/place/${UUID}(?:[/?#]|$)`, "i"),
  new RegExp(`^/pay/${UUID}(?:[/?#]|$)`, "i"),
];

/**
 * The Pay QR door (MESITA-3526): when the guest's `?next=` is a table QR's
 * `/pay?place=<id>` (or its door, `/pay/place/<id>`), the place id, so sign-in
 * can say "Sign in to pay at <name>". Anything else, null.
 */
export function payPlaceFromNext(
  raw: string | undefined | null,
): string | null {
  const target = safeNextPath(raw);
  if (!target) return null;
  for (const re of PAY_PLACE_NEXT) {
    const match = re.exec(target);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/** A gift link's key: 22 characters of base64url, case-sensitive. */
const GIFT_TOKEN = "([A-Za-z0-9_-]{22}|[A-Za-z0-9]{6})"; // a short key since MESITA-4390
/** A friend's gift link, /wallet/gift/<token>, and its address before
 *  MESITA-3614, /wallet?gift=<token>. No `i` flag: the key is
 *  case-sensitive, and a lowercased key is a different (dead) link. A
 *  trailing query (`?fbclid=` from Instagram or Messenger) is fine. */
const GIFT_NEXT = [
  new RegExp(`^/wallet/gift/${GIFT_TOKEN}(?:[/?#]|$)`),
  new RegExp(`^/wallet\\?(?:.*&)?gift=${GIFT_TOKEN}(?:&|#|$)`),
];

/**
 * A gift link at sign-in (MESITA-4229): when the guest's `?next=` is a
 * friend's gift link, its key, so sign-in can say what the link holds.
 * Anything else, null.
 */
export function giftTokenFromNext(
  raw: string | undefined | null,
): string | null {
  const target = safeNextPath(raw);
  if (!target) return null;
  for (const re of GIFT_NEXT) {
    const match = re.exec(target);
    if (match) return match[1];
  }
  return null;
}
