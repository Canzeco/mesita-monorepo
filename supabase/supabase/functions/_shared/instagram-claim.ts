// The pure rules of an Instagram claim (MESITA-2461): a handle is proved by
// a one-time code in the member's bio, never typed into the app and trusted.
// consumer-web-claim-instagram owns the I/O; everything decidable without a
// network call lives here so it is tested.

import { numOf } from "./parse-utils.ts";

/** How long a code stays good after `start`. */
export const CLAIM_CODE_TTL_MS = 24 * 60 * 60 * 1000;

/** The least time between two `check`s for one member: each is a paid scrape. */
export const CLAIM_CHECK_COOLDOWN_MS = 10_000;

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

// No 0/O or 1/I: the member copies this by eye into their bio.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** `@Foo.Bar ` → `foo.bar`, or null when it is not an Instagram username. */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().replace(/^@/, "").toLowerCase();
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

/** The bio holds the code, ignoring case and any spaces around the dash. */
export function bioHasCode(bio: unknown, code: string): boolean {
  if (typeof bio !== "string" || !bio) return false;
  const squash = (s: string) => s.toUpperCase().replace(/\s*-\s*/g, "-");
  return squash(bio).includes(squash(code));
}

export function claimIsLive(createdAt: string, now: number): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t < CLAIM_CODE_TTL_MS;
}

/** Milliseconds until the next check is allowed; 0 = go. */
export function checkWaitMs(checkedAt: string | null, now: number): number {
  if (!checkedAt) return 0;
  const t = Date.parse(checkedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, CLAIM_CHECK_COOLDOWN_MS - (now - t));
}

export type ClaimVerdict =
  | { ok: true; followers: number }
  | { ok: false; error: "wrong_profile" | "code_not_in_bio" };

/**
 * Judges one scraped profile against the pending claim. The scrape must be
 * the claimed account (Instagram can answer a renamed handle with another
 * profile) and its bio must hold the code. The follower count is the
 * scrape's, never the app's.
 */
export function judgeProfile(
  profile: Record<string, unknown>,
  claim: { handle: string; code: string },
): ClaimVerdict {
  const username = normalizeHandle(profile.username);
  if (username !== claim.handle) return { ok: false, error: "wrong_profile" };
  if (!bioHasCode(profile.biography, claim.code)) {
    return { ok: false, error: "code_not_in_bio" };
  }
  const followers = numOf(profile.followersCount);
  return {
    ok: true,
    followers: followers != null && followers > 0 ? Math.trunc(followers) : 0,
  };
}
