import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import {
  bioHasCode,
  CLAIM_CHECK_COOLDOWN_MS,
  CLAIM_CODE_TTL_MS,
  checkWaitMs,
  claimIsLive,
  judgeProfile,
  makeClaimCode,
  normalizeHandle,
} from "./instagram-claim.ts";

Deno.test("normalizeHandle: strips @, lowercases, refuses non-usernames", () => {
  assertEquals(normalizeHandle(" @Foo.Bar_9 "), "foo.bar_9");
  assertEquals(normalizeHandle("has space"), null);
  assertEquals(normalizeHandle("x".repeat(31)), null);
  assertEquals(normalizeHandle(42), null);
});

Deno.test("makeClaimCode: MESITA- + 6 characters with no look-alikes", () => {
  for (let i = 0; i < 50; i++) {
    const code = makeClaimCode();
    assertMatch(code, /^MESITA-[A-HJ-NP-Z2-9]{6}$/);
  }
  assertEquals(makeClaimCode(() => new Uint8Array([0, 1, 2, 3, 4, 5])), "MESITA-ABCDEF");
});

Deno.test("bioHasCode: case and dash spacing don't matter; absence does", () => {
  assert(bioHasCode("tacos 🌮 mesita-7k3q9x cdmx", "MESITA-7K3Q9X"));
  assert(bioHasCode("MESITA - 7K3Q9X", "MESITA-7K3Q9X"));
  assert(!bioHasCode("MESITA-7K3Q9", "MESITA-7K3Q9X"));
  assert(!bioHasCode(null, "MESITA-7K3Q9X"));
});

Deno.test("claimIsLive: a code lasts 24h", () => {
  const t0 = Date.parse("2026-10-19T00:00:00Z");
  assert(claimIsLive("2026-10-19T00:00:00Z", t0 + CLAIM_CODE_TTL_MS - 1));
  assert(!claimIsLive("2026-10-19T00:00:00Z", t0 + CLAIM_CODE_TTL_MS));
  assert(!claimIsLive("garbage", t0));
});

Deno.test("checkWaitMs: one paid scrape per cooldown", () => {
  const t0 = Date.parse("2026-10-19T00:00:00Z");
  assertEquals(checkWaitMs(null, t0), 0);
  assertEquals(checkWaitMs("2026-10-19T00:00:00Z", t0 + 4_000), CLAIM_CHECK_COOLDOWN_MS - 4_000);
  assertEquals(checkWaitMs("2026-10-19T00:00:00Z", t0 + CLAIM_CHECK_COOLDOWN_MS), 0);
});

Deno.test("judgeProfile: the scrape's follower count, only with the code in the bio", () => {
  const claim = { handle: "perdon.mx", code: "MESITA-7K3Q9X" };
  assertEquals(
    judgeProfile({ username: "Perdon.MX", biography: "hi MESITA-7K3Q9X", followersCount: 1234 }, claim),
    { ok: true, followers: 1234 },
  );
  assertEquals(
    judgeProfile({ username: "perdon.mx", biography: "hi", followersCount: 1234 }, claim),
    { ok: false, error: "code_not_in_bio" },
  );
  // Instagram answering with a different account is not proof.
  assertEquals(
    judgeProfile({ username: "someone_else", biography: "MESITA-7K3Q9X" }, claim),
    { ok: false, error: "wrong_profile" },
  );
  assertEquals(
    judgeProfile({ username: "perdon.mx", biography: "MESITA-7K3Q9X" }, claim),
    { ok: true, followers: 0 },
  );
});
