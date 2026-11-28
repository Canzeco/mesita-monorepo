// MESITA-5060 — who a share is credited to. A wrong credit would pay (later)
// for a guest a share did not bring, so the rule is pinned.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { creditVerdict, isShareCode, isVisitorId, newShareCode, readShareClaim } from "./share-codes.ts";

const now = new Date("2026-11-28T12:00:00Z");
const base = {
  consumerId: "c-new",
  consumerCreatedAt: "2026-11-28T11:55:00Z",
  sharerId: "c-sharer",
  openedAt: "2026-11-20T12:00:00Z",
  now,
};

Deno.test("a new account that opened someone's link is credited", () => {
  assertEquals(creditVerdict(base), "credit");
});

Deno.test("never your own code", () => {
  assertEquals(creditVerdict({ ...base, sharerId: "c-new" }), "own_code");
});

Deno.test("an unknown code credits nobody", () => {
  assertEquals(creditVerdict({ ...base, sharerId: null }), "unknown_code");
});

Deno.test("an existing member signing in again is not a new guest", () => {
  assertEquals(creditVerdict({ ...base, consumerCreatedAt: "2026-10-01T00:00:00Z" }), "not_new");
  assertEquals(creditVerdict({ ...base, consumerCreatedAt: null }), "not_new");
});

Deno.test("a link opened more than 30 days ago has expired", () => {
  assertEquals(creditVerdict({ ...base, openedAt: "2026-10-27T11:00:00Z" }), "expired");
  assertEquals(creditVerdict({ ...base, openedAt: "2026-12-30T00:00:00Z" }), "expired");
});

Deno.test("codes are 8 unambiguous characters", () => {
  for (let i = 0; i < 50; i += 1) {
    const code = newShareCode();
    assert(isShareCode(code), code);
    assert(!/[01ilo]/.test(code), code);
  }
  assert(!isShareCode("ABCDEFGH"));
  assert(!isShareCode("abc"));
  assert(isVisitorId("v_abc123XYZ"));
  assert(!isVisitorId("short"));
});

Deno.test("a malformed claim is ignored, a slug or id names the place", () => {
  assertEquals(readShareClaim(null), null);
  assertEquals(readShareClaim({ code: "nope" }), null);
  assertEquals(readShareClaim({ code: "abcd2345", place: "tacos-piedra-1", opened_at: "2026-11-20T12:00:00Z" }), {
    code: "abcd2345",
    place: "tacos-piedra-1",
    openedAt: "2026-11-20T12:00:00Z",
  });
  assertEquals(readShareClaim({ code: "abcd2345", place: "../x", opened_at: "garbage" }), {
    code: "abcd2345",
    place: null,
    openedAt: null,
  });
});
