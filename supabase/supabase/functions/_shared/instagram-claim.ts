// The pure rules of adding and verifying an Instagram (MESITA-4858): a handle
// is saved as typed, unverified; a one-time code sent by DM proves it. The
// server never looks the handle up.

/** How long a code stays good: consumer_instagram_prove's 15 minutes. */
export const CLAIM_CODE_TTL_MS = 15 * 60 * 1000;

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const PROFILE_URL_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/@?([^/?#]+)\/?(?:[?#].*)?$/i;
/** instagram.com paths that are not a profile. */
const NOT_PROFILES = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct"]);

// No 0/O or 1/I: the guest may copy this by eye.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** `@Foo.Bar `, `foo.bar` or a profile URL → `foo.bar`, else null. */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const typed = raw.trim();
  const url = PROFILE_URL_RE.exec(typed);
  const h = (url ? url[1] : typed.replace(/^@/, "")).toLowerCase();
  if (url && NOT_PROFILES.has(h)) return null;
  return HANDLE_RE.test(h) ? h : null;
}

/** `MESITA-` + 6 characters from an alphabet with no look-alikes. */
export function makeClaimCode(
  random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = random(6);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `MESITA-${out}`;
}

export function claimIsLive(createdAt: string, now: number): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t < CLAIM_CODE_TTL_MS;
}
