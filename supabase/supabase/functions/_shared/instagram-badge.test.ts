// MESITA-4714: the yellow badge is a public mark (more than 1,000 followers
// and a public account); pin the rule so a client never decides it.
import { assertEquals } from "jsr:@std/assert@1";
import { instagramBadge } from "./instagram-badge.ts";

const V = "2026-11-23T00:00:00Z";
const pub = { instagram_verified_at: V, instagram_followers_count: 1001, instagram_followers_emulated: null, instagram_is_private: false };

Deno.test("badge: verified, public, more than 1,000 followers", () => {
  assertEquals(instagramBadge(pub, true), true);
  assertEquals(instagramBadge({ ...pub, instagram_followers_count: 1000 }, true), false);
  assertEquals(instagramBadge({ ...pub, instagram_is_private: true }, true), false);
  assertEquals(instagramBadge({ ...pub, instagram_is_private: null }, true), false);
  assertEquals(instagramBadge({ ...pub, instagram_verified_at: null }, true), false);
  assertEquals(instagramBadge(null, true), false);
});

Deno.test("badge: the emulated count counts in test mode only", () => {
  const emu = { ...pub, instagram_followers_count: 10, instagram_is_private: true, instagram_followers_emulated: 1001 };
  assertEquals(instagramBadge(emu, false), true);
  assertEquals(instagramBadge(emu, true), false);
  assertEquals(instagramBadge({ ...pub, instagram_followers_emulated: 320 }, false), false);
  assertEquals(instagramBadge({ ...pub, instagram_followers_emulated: 320 }, true), true);
});
