import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { CLAIM_CODE_TTL_MS, claimIsLive, makeClaimCode, normalizeHandle } from "./instagram-claim.ts";

Deno.test("normalizeHandle: a handle, an @handle or a profile URL", () => {
  for (const raw of [" @Foo.Bar_9 ", "foo.bar_9", "https://www.instagram.com/Foo.Bar_9/?igsh=x", "instagram.com/@foo.bar_9"]) {
    assertEquals(normalizeHandle(raw), "foo.bar_9", raw);
  }
  for (const raw of ["has space", "x".repeat(31), 42, "", "https://instagram.com/p/abc", "instagram.com/explore", "https://evil.com/foo"]) {
    assertEquals(normalizeHandle(raw), null, String(raw));
  }
});

Deno.test("makeClaimCode: MESITA- + 6 characters with no look-alikes", () => {
  for (let i = 0; i < 50; i++) assertMatch(makeClaimCode(), /^MESITA-[A-HJ-NP-Z2-9]{6}$/);
});

Deno.test("a code lives 15 minutes", () => {
  const at = "2026-11-24T12:00:00Z";
  assert(claimIsLive(at, Date.parse(at) + CLAIM_CODE_TTL_MS - 1));
  assert(!claimIsLive(at, Date.parse(at) + CLAIM_CODE_TTL_MS));
  assert(!claimIsLive("nope", 0));
});
