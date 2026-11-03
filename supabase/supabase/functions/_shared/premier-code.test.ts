// MESITA-3167 — Premier codes: what the database is asked (a hash, never the
// plain code), what a malformed try costs (nothing: no round trip, no
// attempt counted), and that a missing secret shuts every code door.

import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  CROCKFORD,
  formatCode,
  hashCode,
  mintCode,
  normalizeCode,
  parseCreateCode,
  redeemPremierCode,
} from "./premier-code.ts";

const PLACE = "00000000-0000-4000-8000-000000167000";
const USER = "00000000-0000-4000-8000-000000167001";

function fakeAdmin(answer: unknown) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const admin = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: answer, error: null });
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

Deno.test("normalizeCode: any case, dash or spaces; I and L read 1, O reads 0; U and wrong lengths are no code", () => {
  assertEquals(normalizeCode("7kq2-abcd"), "7KQ2ABCD");
  assertEquals(normalizeCode(" 7KQ2 ABCD "), "7KQ2ABCD");
  assertEquals(normalizeCode("ILO0-1234"), "11001234");
  assertEquals(normalizeCode("UUUU-UUUU"), null);
  assertEquals(normalizeCode("7KQ2-ABC"), null);
  assertEquals(normalizeCode(12345678), null);
  assertEquals(formatCode("7KQ2ABCD"), "7KQ2-ABCD");
});

Deno.test("mintCode: 8 Crockford characters that survive normalizeCode", () => {
  for (let i = 0; i < 50; i++) {
    const c = mintCode();
    assertEquals(c.length, 8);
    for (const ch of c) assert(CROCKFORD.includes(ch));
    assertEquals(normalizeCode(formatCode(c).toLowerCase()), c);
  }
});

Deno.test("hashCode: HMAC depends on the pepper, 64 hex characters", async () => {
  const a = await hashCode("7KQ2ABCD", "pepper-one");
  assertEquals(a.length, 64);
  assert(/^[0-9a-f]{64}$/.test(a));
  assertEquals(a, await hashCode("7KQ2ABCD", "pepper-one"));
  assertNotEquals(a, await hashCode("7KQ2ABCD", "pepper-two"));
});

Deno.test("redeem sends the hash of the normalized code, never the code", async () => {
  const { admin, calls } = fakeAdmin({
    result: "ok", tier: 2, days: 30, ends_at_2x: null, ends_at_5x: "2026-12-03T00:00:00Z", paused_tier: 1,
    paused_until: "2026-12-03T00:00:00Z",
  });
  const res = await redeemPremierCode(admin, { rawCode: "7kq2-abcd", placeId: PLACE, userId: USER }, "t", "pep");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].fn, "premier_redeem_code");
  assertEquals(calls[0].args, { p_code_hash: await hashCode("7KQ2ABCD", "pep"), p_place_id: PLACE, p_user_id: USER });
  assert(!JSON.stringify(calls[0].args).includes("7KQ2"));
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.ends_at, "2026-12-03T00:00:00Z");
  assertEquals(body.paused, { tier: 1, until: "2026-12-03T00:00:00Z" });
});

Deno.test("a malformed code is code_unknown with no database call (no attempt counted)", async () => {
  const { admin, calls } = fakeAdmin(null);
  const res = await redeemPremierCode(admin, { rawCode: "nope", placeId: PLACE, userId: USER }, "t", "pep");
  assertEquals(calls.length, 0);
  assertEquals(await res.json(), { ok: false, code: "code_unknown", error: "That code doesn't exist." });
});

Deno.test("a refusal is 200 { ok: false, code } and rate_limited carries retry_after", async () => {
  const { admin } = fakeAdmin({ result: "refused", code: "rate_limited", retry_after: "2026-11-03T11:00:00Z" });
  const res = await redeemPremierCode(admin, { rawCode: "7KQ2ABCD", placeId: PLACE, userId: USER }, "t", "pep");
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.code, "rate_limited");
  assertEquals(body.retry_after, "2026-11-03T11:00:00Z");
});

Deno.test("no PREMIER_CODE_PEPPER: 503 codes_off, nothing asked", async () => {
  const { admin, calls } = fakeAdmin(null);
  const res = await redeemPremierCode(admin, { rawCode: "7KQ2ABCD", placeId: PLACE, userId: USER }, "t", null);
  assertEquals(res.status, 503);
  assertEquals((await res.json()).code, "codes_off");
  assertEquals(calls.length, 0);
});

Deno.test("parseCreateCode: tier, days, uses and a future expiry", () => {
  const now = Date.parse("2026-11-03T00:00:00Z");
  assertEquals(parseCreateCode({ tier: 2, days: 30, maxRedemptions: 5 }, now), {
    tier: 2, days: 30, maxRedemptions: 5, expiresAt: null,
  });
  assertEquals(parseCreateCode({ tier: 1, days: 7, maxRedemptions: 1, expiresAt: "2026-12-01T00:00:00Z" }, now), {
    tier: 1, days: 7, maxRedemptions: 1, expiresAt: "2026-12-01T00:00:00.000Z",
  });
  assertEquals((parseCreateCode({ tier: 3, days: 30, maxRedemptions: 1 }, now) as { code: string }).code, "tier_invalid");
  assertEquals((parseCreateCode({ tier: 1, days: 367, maxRedemptions: 1 }, now) as { code: string }).code, "days_invalid");
  assertEquals((parseCreateCode({ tier: 1, days: 30, maxRedemptions: 0 }, now) as { code: string }).code, "max_invalid");
  assertEquals(
    (parseCreateCode({ tier: 1, days: 30, maxRedemptions: 1, expiresAt: "2026-11-01T00:00:00Z" }, now) as { code: string }).code,
    "expires_invalid",
  );
});
