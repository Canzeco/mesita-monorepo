// deno test supabase/functions/_shared/discovery-swipe.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_SWIPE, DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  rankSwipeDeck,
  swipeAdmissionFilters,
  swipeLineupWeights,
} from "./discovery-swipe.ts";
import { isOpenThrough } from "./local-time-open.ts";
import { weightsForMode } from "./discovery-matrix.ts";

const NOW = new Date("2026-08-21T18:00:00Z");
const GEO = { lat: 25.67, lng: -100.31 };
const WEIGHTS = swipeLineupWeights(DISCOVERY_DEFAULTS.weights);
const PARAMS = DISCOVERY_DEFAULTS.params;

const HOURS = {
  friday: [{ open: "18:00", close: "02:00" }],
  saturday: [{ open: "13:00", close: "16:00" }],
};

type Row = {
  id: string;
  lat: number;
  lng: number;
  google_stars_overall: number;
  google_review_count: number;
  plan: string;
  hours: typeof HOURS;
  category: string;
};

function row(
  id: string,
  kmSouth: number,
  stars: number,
  reviews: number,
  plan = "free",
): Row {
  // 1° latitude ≈ 111 km. Guest at 25.67, -100.31 (Monterrey-ish).
  return {
    id,
    lat: 25.67 - kmSouth / 111,
    lng: -100.31,
    google_stars_overall: stars,
    google_review_count: reviews,
    plan,
    hours: HOURS,
    category: "restaurant",
  };
}

Deno.test("swipe mask matches the locked matrix", () => {
  const swipe = swipeLineupWeights(DISCOVERY_DEFAULTS.weights);
  assertEquals(swipe, weightsForMode("swipe", DISCOVERY_DEFAULTS.weights));
  assertEquals(swipe.name, 0);
  assertEquals(swipe.summary, 0);
  assertEquals(swipe.social, 0);
  assertEquals(swipe.proximity, DISCOVERY_DEFAULTS.weights.proximity);
  assertEquals(swipe.randomness, DISCOVERY_DEFAULTS.weights.randomness);
  assertEquals(weightsForMode("map", DISCOVERY_DEFAULTS.weights).randomness, 0);
});

Deno.test("rank: closer beats farther when the other signals tie", () => {
  const near = row("near", 0.2, 4.2, 40);
  const far = row("far", 4.8, 4.2, 40);
  const ordered = rankSwipeDeck(
    [far, near],
    GEO,
    WEIGHTS,
    PARAMS,
    { now: NOW, random: () => 0.5 },
  );
  assertEquals(ordered.map((r) => r.id), ["near", "far"]);
});

Deno.test("rank: paid plan beats free at the same pin", () => {
  const plain = row("plain", 1, 4.2, 40);
  const partner = row("partner", 1, 4.2, 40, "pro");
  const ordered = rankSwipeDeck(
    [plain, partner],
    GEO,
    WEIGHTS,
    PARAMS,
    { now: NOW, random: () => 0.5 },
  );
  assertEquals(ordered[0].id, "partner");
});

Deno.test("rank: a partner at the radius edge is scored, not dropped", () => {
  const edge = row("edge", 4.9, 4.8, 800, "pro");
  const mid = row("mid", 2, 3.5, 8);
  const ordered = rankSwipeDeck(
    [mid, edge],
    GEO,
    WEIGHTS,
    PARAMS,
    { now: NOW, random: () => 0.5 },
  );
  assertEquals(ordered.map((r) => r.id).sort(), ["edge", "mid"]);
});

Deno.test("rank: randomness can flip two close places", () => {
  const a = row("a", 1, 4.2, 40);
  const b = row("b", 1, 4.2, 40);
  let n = 0;
  const random = () => (n++ === 0 ? 0.99 : 0.01);
  const ordered = rankSwipeDeck([a, b], GEO, WEIGHTS, PARAMS, { now: NOW, random });
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

Deno.test("recommend-swipe ranks with the Swipe mask, not the old sum", async () => {
  const src = await Deno.readTextFile(
    new URL("../consumer-web-recommend-swipe/index.ts", import.meta.url),
  );
  assertEquals(src.includes("swipeLineupWeights"), true);
  assertEquals(src.includes("weightsForMode"), false);
  assertEquals(src.includes("weightProximity"), false);
  assertEquals(src.includes("partnerBias"), false);
  assertEquals(src.includes("swipeBlend"), false);
});
