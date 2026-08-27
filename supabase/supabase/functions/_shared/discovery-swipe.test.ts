// deno test supabase/functions/_shared/discovery-swipe.test.ts

import { assertAlmostEquals, assertEquals, assert } from "jsr:@std/assert@1";
import { DEFAULT_SWIPE } from "./discovery-config.ts";
import {
  rankSwipeDeck,
  swipeAdmissionFilters,
  swipeBlend,
  swipeJitter,
  swipePartnerLevel,
  swipePopularity,
  swipeProximity,
} from "./discovery-swipe.ts";
import { isOpenThrough } from "./local-time-open.ts";
import type { PromotingFields } from "./place-promoting.ts";

const NOW = new Date("2026-08-21T00:00:00Z");
const CONSERVATIVE = {
  free_rate: 10,
  premium_rate: 20,
  welcome_free_rate: 20,
  welcome_premium_rate: 30,
};
const AGGRESSIVE = {
  welcome_free_rate: 30,
  welcome_premium_rate: 50,
  free_rate: 10,
  premium_rate: 30,
};
const DOMINANT = {
  welcome_free_rate: 40,
  welcome_premium_rate: 50,
  free_rate: 20,
  premium_rate: 30,
};

const HOURS = {
  friday: [{ open: "18:00", close: "02:00" }],
  saturday: [{ open: "13:00", close: "16:00" }],
};

Deno.test("proximity is linear: 1 at 0 km, 0 at the radius", () => {
  assertEquals(swipeProximity(0, 5), 1);
  assertEquals(swipeProximity(2.5, 5), 0.5);
  assertEquals(swipeProximity(5, 5), 0);
  assertEquals(swipeProximity(6, 5), 0);
});

Deno.test("popularity matches ln(stars^1.5 * reviews) / 10, clamped at 1", () => {
  const expected = Math.log(4.5 ** 1.5 * 2000) / 10;
  assertEquals(swipePopularity(4.5, 2000, 1.5, 10), Math.min(1, expected));
  // Ceiling: product ~22,026 is e^10. 4.5^1.5 * 2000 ≈ 19,092 — just under 1.
  assert(swipePopularity(4.5, 2000, 1.5, 10) < 1);
  assertEquals(swipePopularity(4.5, 3000, 1.5, 10), 1);
  // Floor: 1 star × 1 review → ln(1) / 10 = 0.
  assertEquals(swipePopularity(1, 1, 1.5, 10), 0);
  assertEquals(swipePopularity(0, 12, 1.5, 10), 0);
  assertEquals(swipePopularity(4.9, 0, 1.5, 10), 0);
});

Deno.test("blend is a weighted sum, not a product", () => {
  // Far but popular: product would kill it; sum keeps 0.3 of popularity.
  assertAlmostEquals(swipeBlend(0, 1, 0.7), 0.3);
  assertAlmostEquals(swipeBlend(1, 0, 0.7), 0.7);
  assertAlmostEquals(swipeBlend(1, 1, 0.7), 1);
});

Deno.test("partner levels: free / partner-no-promo / ladder", () => {
  assertEquals(swipePartnerLevel({ plan: "free", ...CONSERVATIVE }, NOW), "none");
  assertEquals(
    swipePartnerLevel({
      plan: "pro",
      free_rate: null,
      premium_rate: null,
      welcome_free_rate: null,
      welcome_premium_rate: null,
    }, NOW),
    "partner",
  );
  assertEquals(swipePartnerLevel({ plan: "pro", ...CONSERVATIVE }, NOW), "conservative");
  assertEquals(swipePartnerLevel({ plan: "pro", ...AGGRESSIVE }, NOW), "aggressive");
  assertEquals(swipePartnerLevel({ plan: "pro", ...DOMINANT }, NOW), "dominant");
  // Pause closes the promo but the place still pays — partner, no promo.
  assertEquals(
    swipePartnerLevel({
      plan: "pro",
      ...CONSERVATIVE,
      promo_paused_until: "2026-09-01T00:00:00Z",
    }, NOW),
    "partner",
  );
});

type Row = {
  id: string;
  lat: number;
  lng: number;
  stars: number;
  reviews: number;
  partner: PromotingFields;
};

function row(
  id: string,
  kmSouth: number,
  stars: number,
  reviews: number,
  partner: PromotingFields = { plan: "free" },
): Row {
  // 1° latitude ≈ 111 km. Guest at 25.67, -100.31 (Monterrey-ish).
  return {
    id,
    lat: 25.67 - kmSouth / 111,
    lng: -100.31,
    stars,
    reviews,
    partner,
  };
}

const read = {
  latOf: (r: Row) => r.lat,
  lngOf: (r: Row) => r.lng,
  starsOf: (r: Row) => r.stars,
  reviewsOf: (r: Row) => r.reviews,
  partnerOf: (r: Row) => r.partner,
};

const GEO = { lat: 25.67, lng: -100.31 };

Deno.test("rank: closer beats popular-and-far; bias cannot run before admit", () => {
  const near = row("near", 0.2, 4.0, 20);
  const farGreat = row("far", 4.8, 4.9, 4000, { plan: "pro", ...DOMINANT });
  const ordered = rankSwipeDeck(
    [farGreat, near],
    GEO,
    DEFAULT_SWIPE,
    read,
    NOW,
    () => 0,
  );
  assertEquals(ordered.map((r) => r.id), ["near", "far"]);
});

Deno.test("rank: a good nearby partner can pass a slightly weaker non-partner", () => {
  const plain = row("plain", 1, 4.2, 40);
  const partner = row("partner", 1, 4.2, 40, { plan: "pro", ...DOMINANT });
  const ordered = rankSwipeDeck(
    [plain, partner],
    GEO,
    DEFAULT_SWIPE,
    read,
    NOW,
    () => 0,
  );
  assertEquals(ordered[0].id, "partner");
});

Deno.test("rank: a partner at the radius edge is scored, not dropped", () => {
  const edge = row("edge", 4.9, 4.8, 800, { plan: "pro", ...DOMINANT });
  const mid = row("mid", 2, 3.5, 8);
  const ordered = rankSwipeDeck(
    [mid, edge],
    GEO,
    DEFAULT_SWIPE,
    read,
    NOW,
    () => 0,
  );
  assertEquals(ordered.map((r) => r.id).sort(), ["edge", "mid"]);
  assert(ordered[0].id === "edge" || ordered[0].id === "mid");
});

Deno.test("jitter is Uniform[1, max]; 1 is off", () => {
  assertEquals(swipeJitter(0, 1.3), 1);
  assertAlmostEquals(swipeJitter(1, 1.3), 1.3);
  assertAlmostEquals(swipeJitter(0.5, 1.3), 1.15);
  assertEquals(swipeJitter(0.9, 1), 1);
  assertEquals(swipeJitter(0.9, 0.5), 1);
});

Deno.test("rank: randomness can flip two close places", () => {
  const a = row("a", 1, 4.2, 40);
  const b = row("b", 1, 4.2, 40);
  let n = 0;
  const rng = () => (n++ === 0 ? 1 : 0);
  const ordered = rankSwipeDeck([a, b], GEO, DEFAULT_SWIPE, read, NOW, rng);
  assertEquals(ordered.map((r) => r.id), ["a", "b"]);
});

Deno.test("admission filters: ready + swipe reviews + swipe radius", () => {
  assertEquals(swipeAdmissionFilters(DEFAULT_SWIPE), {
    requireReady: true,
    minRating: 0,
    minReviews: 1,
    maxDistanceKm: 5,
  });
});

Deno.test("closing buffer: open now but closing soon is closed", () => {
  // Saturday 15:40, lunch closes 16:00. 30 min buffer fails; 10 min passes.
  assertEquals(isOpenThrough(HOURS, "saturday", 15 * 60 + 40, 30), false);
  assertEquals(isOpenThrough(HOURS, "saturday", 15 * 60 + 40, 10), true);
  assertEquals(isOpenThrough(HOURS, "saturday", 14 * 60, 30), true);
  // Overnight Friday 18:00 → Saturday 02:00. 01:40 + 30 overshoots close;
  // 01:20 + 30 is still inside.
  assertEquals(isOpenThrough(HOURS, "saturday", 1 * 60 + 40, 30), false);
  assertEquals(isOpenThrough(HOURS, "saturday", 1 * 60 + 20, 30), true);
  assertEquals(isOpenThrough(HOURS, "friday", 23 * 60, 30), true);
  assertEquals(isOpenThrough(null, "saturday", 14 * 60, 30), null);
});
