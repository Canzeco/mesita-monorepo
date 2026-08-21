import { assertEquals } from "jsr:@std/assert@1";
import { isPlacePromoting } from "./place-promoting.ts";
import { withFamilyKeys } from "./place-family-keys.ts";

const NOW = new Date("2026-08-21T00:00:00Z");
const days = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

// Conservative preset (see _shared/rewards-config strategyForRates).
const CONSERVATIVE = {
  free_rate: 10,
  premium_rate: 20,
  welcome_free_rate: 20,
  welcome_premium_rate: 30,
};

Deno.test("isPlacePromoting: a free plan never promotes", () => {
  assertEquals(
    isPlacePromoting({ plan: "free", ...CONSERVATIVE }, NOW),
    false,
  );
});

Deno.test("isPlacePromoting: paid + a strategy above Zero promotes", () => {
  assertEquals(isPlacePromoting({ plan: "pro", ...CONSERVATIVE }, NOW), true);
});

Deno.test("isPlacePromoting: paid but Zero offers nothing", () => {
  assertEquals(
    isPlacePromoting({
      plan: "pro",
      free_rate: null,
      premium_rate: null,
      welcome_free_rate: null,
      welcome_premium_rate: null,
    }, NOW),
    false,
  );
});

// The whole reason this function exists: listing_type stays 'partner' through
// a strike-2 pause, so a stored badge would keep promising a discount.
Deno.test("isPlacePromoting: a live pause closes it", () => {
  assertEquals(
    isPlacePromoting(
      { plan: "pro", ...CONSERVATIVE, promo_paused_until: days(10) },
      NOW,
    ),
    false,
  );
});

Deno.test("isPlacePromoting: an expired pause re-opens it", () => {
  assertEquals(
    isPlacePromoting(
      { plan: "pro", ...CONSERVATIVE, promo_paused_until: days(-1) },
      NOW,
    ),
    true,
  );
});

Deno.test("isPlacePromoting: forfeited stays shut even once plan is cleared", () => {
  assertEquals(
    isPlacePromoting(
      { plan: "free", ...CONSERVATIVE, plan_forfeited_at: days(-30) },
      NOW,
    ),
    false,
  );
});

Deno.test("isPlacePromoting: null row is not promoting", () => {
  assertEquals(isPlacePromoting(null, NOW), false);
  assertEquals(isPlacePromoting(undefined, NOW), false);
});

Deno.test("withFamilyKeys: computes promoting and drops the private columns", () => {
  const wire = withFamilyKeys({
    category: "restaurant",
    plan: "pro",
    strike_count: 2,
    last_strike_at: days(-1),
    promo_paused_until: days(10),
    plan_forfeited_at: null,
    plan_live_at: days(-90),
    first_ticket_honored_at: days(-80),
    ...CONSERVATIVE,
  }) as Record<string, unknown>;

  // Paused, so the guest is told the truth rather than the stale badge.
  assertEquals(wire.promoting, false);
  // A guest has no business reading the place's plan or its strike record.
  for (
    const key of [
      "plan",
      "strike_count",
      "last_strike_at",
      "promo_paused_until",
      "plan_forfeited_at",
      "plan_live_at",
      "first_ticket_honored_at",
    ]
  ) {
    assertEquals(key in wire, false, `${key} must not reach the wire`);
  }
  // The rates DO stay: the chip resolves the guest's own percentage from them.
  assertEquals(wire.free_rate, 10);
  assertEquals(Array.isArray(wire.family_keys), true);
});
