import { assertEquals } from "jsr:@std/assert@1";
import {
  isPlacePromoting,
  placePromotingLevel,
} from "./place-promoting.ts";
import { withFamilyKeys } from "./place-family-keys.ts";

const NOW = new Date("2026-08-21T00:00:00Z");
const days = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

// withFamilyKeys takes NO clock — it is the wire shaper, and a guest's badge
// must read against the real one. So its fixture dates hang off the real
// clock too. Hanging them off the frozen NOW above is a time bomb: a "paused
// ten days out" written against 2026-08-21 came due on 2026-08-31 and turned
// the suite red on a day nobody had touched this file.
const fromNow = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

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
    last_strike_at: fromNow(-1),
    promo_paused_until: fromNow(10),
    plan_forfeited_at: null,
    plan_live_at: fromNow(-90),
    first_ticket_honored_at: fromNow(-80),
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

// ── placePromotingLevel — the 0-3 ladder (Pato, 2026-08-22) ────────────────

Deno.test("promoting level: agrees with the boolean by construction", () => {
  // The invariant that keeps the two from drifting: level 0 exactly when the
  // boolean is false, for every strategy.
  for (
    const rates of [
      { welcome_free_rate: null, welcome_premium_rate: null, free_rate: null, premium_rate: null },
      { welcome_free_rate: 20, welcome_premium_rate: 30, free_rate: 10, premium_rate: 20 },
      { welcome_free_rate: 30, welcome_premium_rate: 50, free_rate: 10, premium_rate: 30 },
      { welcome_free_rate: 40, welcome_premium_rate: 50, free_rate: 20, premium_rate: 30 },
    ]
  ) {
    const row = { plan: "pro", ...rates };
    assertEquals(
      placePromotingLevel(row) === 0,
      !isPlacePromoting(row),
      JSON.stringify(rates),
    );
  }
});

Deno.test("promoting level: the four rungs in order", () => {
  const paid = (r: Record<string, unknown>) => ({ plan: "pro", ...r });
  assertEquals(
    placePromotingLevel(paid({
      welcome_free_rate: null,
      welcome_premium_rate: null,
      free_rate: null,
      premium_rate: null,
    })),
    0,
  );
  assertEquals(
    placePromotingLevel(paid({
      welcome_free_rate: 20,
      welcome_premium_rate: 30,
      free_rate: 10,
      premium_rate: 20,
    })),
    1,
  );
  assertEquals(
    placePromotingLevel(paid({
      welcome_free_rate: 30,
      welcome_premium_rate: 50,
      free_rate: 10,
      premium_rate: 30,
    })),
    2,
  );
  assertEquals(
    placePromotingLevel(paid({
      welcome_free_rate: 40,
      welcome_premium_rate: 50,
      free_rate: 20,
      premium_rate: 30,
    })),
    3,
  );
});

Deno.test("promoting level: an unpaid place is 0 whatever its rate columns say", () => {
  assertEquals(
    placePromotingLevel({
      plan: "free",
      welcome_free_rate: 40,
      welcome_premium_rate: 50,
      free_rate: 20,
      premium_rate: 30,
    }),
    0,
  );
});

Deno.test("promoting level: a closed promo lane is 0, not the signed-up strategy", () => {
  // The whole reason this is a refinement of `promoting` rather than a read of
  // the strategy: a strike pause means the guest gets nothing right now.
  const paused = new Date("2026-08-22T00:00:00Z");
  assertEquals(
    placePromotingLevel(
      {
        plan: "pro",
        welcome_free_rate: 40,
        welcome_premium_rate: 50,
        free_rate: 20,
        premium_rate: 30,
        promo_paused_until: "2026-09-01T00:00:00Z",
      },
      paused,
    ),
    0,
  );
});

Deno.test("promoting: a ghost-partner hold reads 0 whatever the strategy says (MESITA-1311)", () => {
  // Under review after a confirmed guest report: the guest gets nothing
  // right now, so the pin/badge must not promise a discount.
  assertEquals(
    placePromotingLevel({
      plan: "pro",
      welcome_free_rate: 40,
      welcome_premium_rate: 50,
      free_rate: 20,
      premium_rate: 30,
      reward_lane_pending_review_at: "2026-09-01T00:00:00Z",
    }),
    0,
  );
});
