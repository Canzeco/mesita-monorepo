// Instagram profile lookup (MESITA-3038, MESITA-3039): who an Instagram
// username is — its username, profile photo and follower count — behind one
// small interface, so Me › Instagram never changes when the source does.
//
// APIFY, FOR TESTING (Pato, 2026-10-29: "user inputs their instagram. you
// just assume is true and use apify to scrape username and followers and
// profile picture … it's a testing bot"). The provider scrapes the public
// profile with the Apify Instagram profile actor; a private account still
// shows its follower count and photo. It proves nothing: the real proof is
// the Meta DM bot (MESITA-2579), which replaces this once Meta approves.
// MESITA-3038's emulator was the first provider and is gone.

import { APIFY_ACTORS, runApifyActor } from "./apify.ts";
import { isDeadIgStub } from "./enrich-instagram-match.ts";
import { pickProfilePicUrl } from "./instagram-avatar.ts";
import { normalizeHandle } from "./instagram-claim.ts";
import { numOf } from "./parse-utils.ts";

export type InstagramProfile = {
  username: string;
  /** Instagram's own link: it expires, so it is copied, never stored. */
  profilePictureUrl: string | null;
  followerCount: number;
};

export type InstagramLookupResult =
  | { ok: true; profile: InstagramProfile }
  | { ok: false; reason: "not_found" | "unavailable" };

export interface InstagramProfileLookup {
  /** Where an answer came from. */
  readonly source: "apify";
  /** `username` is already normalized (normalizeHandle). */
  lookup(username: string): Promise<InstagramLookupResult>;
}

// The profile scrape is synchronous; a cold actor takes ~10–20s.
const SCRAPE_TIMEOUT_MS = 45_000;

/** One scraped item → the profile, or null when it is not that account. */
export function profileFromScrape(
  item: Record<string, unknown> | undefined,
  username: string,
): InstagramProfile | null {
  if (!item || isDeadIgStub(item)) return null;
  // Instagram can answer a renamed handle with another profile.
  if (normalizeHandle(item.username) !== username) return null;
  const followers = numOf(item.followersCount);
  return {
    username,
    profilePictureUrl: pickProfilePicUrl(item),
    followerCount: followers != null && followers > 0
      ? Math.trunc(followers)
      : 0,
  };
}

export function apifyLookup(apifyKey: string): InstagramProfileLookup {
  return {
    source: "apify",
    async lookup(username) {
      const run = await runApifyActor<Record<string, unknown>>(
        APIFY_ACTORS.instagramProfile,
        { usernames: [username] },
        apifyKey,
        SCRAPE_TIMEOUT_MS,
      );
      if (run.error || !run.items) {
        console.error("instagram lookup scrape failed", run.status, run.error);
        return { ok: false, reason: "unavailable" };
      }
      const profile = profileFromScrape(run.items[0], username);
      return profile
        ? { ok: true, profile }
        : { ok: false, reason: "not_found" };
    },
  };
}

/** The provider in use, or null when it has no key. The swap point. */
export function readInstagramLookup(): InstagramProfileLookup | null {
  const key = Deno.env.get("APIFY_KEY")?.trim();
  return key ? apifyLookup(key) : null;
}
