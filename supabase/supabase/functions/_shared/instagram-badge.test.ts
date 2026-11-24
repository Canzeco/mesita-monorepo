// MESITA-4858: the badge is proof of ownership, never a follower count.
import { assertEquals } from "jsr:@std/assert@1";
import { instagramBadge } from "./instagram-badge.ts";

Deno.test("badge: only a proved handle", () => {
  assertEquals(instagramBadge({ instagram_handle: "vale", instagram_proved_at: "2026-11-24T00:00:00Z" }), true);
  assertEquals(instagramBadge({ instagram_handle: "vale", instagram_proved_at: null }), false);
  assertEquals(instagramBadge({ instagram_handle: null, instagram_proved_at: "2026-11-24T00:00:00Z" }), false);
  assertEquals(instagramBadge(null), false);
});
