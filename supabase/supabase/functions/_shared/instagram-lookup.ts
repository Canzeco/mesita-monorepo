// Instagram profile lookup (MESITA-3038): who an Instagram username is —
// its username, profile photo and follower count — behind one small
// interface, so Me › Instagram never changes when the source does.
//
// EMULATED. Meta Business verification is pending, so the only provider is
// the emulator: a predictable sample per username, computed here, marked
// `source: "emulator"`. It never fetches Instagram, Apify or anything else,
// and its answer is never stored, never "verified" and never reaches Social
// (MESITA-2461: a handle is proved, never typed and trusted). When an
// approved provider exists, it implements InstagramProfileLookup and
// readInstagramLookup() returns it; consumer-web-lookup-instagram and the
// page stay as they are.

export type InstagramProfile = {
  username: string;
  profilePictureUrl: string;
  followerCount: number;
};

export type InstagramLookupResult =
  | { ok: true; profile: InstagramProfile }
  | { ok: false; reason: "not_found" };

export interface InstagramProfileLookup {
  /** Says where an answer came from; the page labels "emulator" as sample. */
  readonly source: "emulator";
  /** `username` is already normalized (normalizeHandle). */
  lookup(username: string): Promise<InstagramLookupResult>;
}

/** A username starting with this finds no profile, so the empty result can
 *  be seen on demand. */
export const EMULATOR_NOT_FOUND_PREFIX = "unavailable";

// FNV-1a: the same username always gets the same sample.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 100..24,999 followers: both sides of the 1,000 bar show up. */
export function emulatedFollowerCount(username: string): number {
  return 100 + (hash(username) % 24_900);
}

/** A monogram drawn inline, so the emulator calls no image host. */
export function emulatedPictureUrl(username: string): string {
  const hue = hash(username) % 360;
  const letter = (username.match(/[a-z0-9]/)?.[0] ?? "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" fill="hsl(${hue} 55% 55%)"/>` +
    `<text x="64" y="64" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" ` +
    `font-size="60" font-weight="600" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const emulatorLookup: InstagramProfileLookup = {
  source: "emulator",
  lookup(username) {
    if (username.startsWith(EMULATOR_NOT_FOUND_PREFIX)) {
      return Promise.resolve({ ok: false, reason: "not_found" });
    }
    return Promise.resolve({
      ok: true,
      profile: {
        username,
        profilePictureUrl: emulatedPictureUrl(username),
        followerCount: emulatedFollowerCount(username),
      },
    });
  },
};

/** The provider in use. The swap point for an approved source. */
export function readInstagramLookup(): InstagramProfileLookup {
  return emulatorLookup;
}
