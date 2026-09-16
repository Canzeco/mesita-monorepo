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
const WEIGHTS = swipeLineupWeights(DISCOVERY_DEFAULTS);
const PARAMS = DISCOVERY_DEFAULTS.params;
/** Merit order only. These tests are about the blend, not the bought lane. */
const SLOT_OFF = { enabled: false, everyNth: 0 };

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
  const swipe = swipeLineupWeights(DISCOVERY_DEFAULTS);
  assertEquals(
    swipe,
    weightsForMode(
      "swipe",
      DISCOVERY_DEFAULTS.weights,
      DISCOVERY_DEFAULTS.weightsByMode,
    ),
  );
  assertEquals(swipe.name, 0);
  assertEquals(swipe.summary, 0);
  assertEquals(swipe.enriched, DISCOVERY_DEFAULTS.weights.enriched);
  assertEquals(swipe.partnered, DISCOVERY_DEFAULTS.weights.partnered);
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
    SLOT_OFF,
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
    SLOT_OFF,
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
    SLOT_OFF,
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
  const ordered = rankSwipeDeck([a, b], GEO, WEIGHTS, SLOT_OFF, PARAMS, {
    now: NOW,
    random,
  });
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
  // The mode key lives in ONE named function per mode, so the console's
  // "who reads this column" badge stays checkable against the code.
  assertEquals(src.includes("swipeLineupWeights"), true);
  assertEquals(src.includes("weightsForMode"), false);
  assertEquals(src.includes("swipeBlend"), false);
  // The whole config goes in, because the Scroll column lives on it
  // (MESITA-1859). Passing `cfg.weights` alone would compile and would
  // silently ignore every per-mode number an operator ever saved.
  assertEquals(src.includes("swipeLineupWeights(cfg)"), true);
  assertEquals(src.includes("swipeLineupWeights(cfg.weights)"), false);
});

Deno.test("swipeLineupWeights reads the stored Scroll column, and Map's cannot reach it", () => {
  const tuned = {
    ...DISCOVERY_DEFAULTS,
    weightsByMode: {
      ...DISCOVERY_DEFAULTS.weightsByMode,
      swipe: { ...DISCOVERY_DEFAULTS.weightsByMode.swipe, proximity: 2.5 },
      map: { ...DISCOVERY_DEFAULTS.weightsByMode.map, proximity: 0.25 },
    },
  };
  assertEquals(swipeLineupWeights(tuned).proximity, 2.5);
  // Untouched signals still read the Scroll column's own default.
  assertEquals(
    swipeLineupWeights(tuned).timing,
    DISCOVERY_DEFAULTS.weightsByMode.swipe.timing,
  );
  // The mask still wins over anything stored.
  assertEquals(swipeLineupWeights(tuned).name, 0);
});

// ── The bought lane on Scroll (MESITA-1855) ──────────────────────────────────
//
// All weights zero, so every place scores exactly 1 under `Π s^w` and merit
// order is the incoming order. Anything that moves was moved by slotting.
// Before MESITA-1858 the real mask lifted a promoting place on MERIT, so
// these assertions would have passed whether or not lane 2 ran. No signal
// reads `promoting` now; the zeroed weights stay for legibility.

const ZERO_WEIGHTS = Object.fromEntries(
  Object.keys(DISCOVERY_DEFAULTS.weights).map((k) => [k, 0]),
) as typeof WEIGHTS;

/** Rates `strategyForRates` recognises as Aggressive. An invented tuple
 *  returns null, the place does not promote, and the queue is empty. */
const PROMO_RATES = {
  welcome_free_rate: 30,
  welcome_premium_rate: 50,
  free_rate: 10,
  premium_rate: 30,
  strike_count: 0,
  last_strike_at: null,
  promo_paused_until: null,
  plan_forfeited_at: null,
};

Deno.test("Scroll: a promoting place is moved into the bought slot", () => {
  const rows = [
    row("a", 1, 4.2, 40, "pro"),
    row("b", 1, 4.2, 40, "pro"),
    row("c", 1, 4.2, 40, "pro"),
    { ...row("d", 1, 4.2, 40, "pro"), ...PROMO_RATES },
  ];
  const ordered = rankSwipeDeck(
    rows,
    GEO,
    ZERO_WEIGHTS,
    { enabled: true, everyNth: 2 },
    PARAMS,
    { now: NOW, random: () => 0.5 },
  );
  assertEquals(ordered.map((r) => r.id), ["a", "d", "b", "c"]);
});

Deno.test("Scroll: slotting off serves merit order", () => {
  const rows = [
    row("a", 1, 4.2, 40, "pro"),
    row("b", 1, 4.2, 40, "pro"),
    row("c", 1, 4.2, 40, "pro"),
    { ...row("d", 1, 4.2, 40, "pro"), ...PROMO_RATES },
  ];
  const ordered = rankSwipeDeck(
    rows,
    GEO,
    ZERO_WEIGHTS,
    SLOT_OFF,
    PARAMS,
    { now: NOW, random: () => 0.5 },
  );
  assertEquals(ordered.map((r) => r.id), ["a", "b", "c", "d"]);
});

Deno.test("recommend-swipe passes the slotting config, not a literal", async () => {
  // The bug this file exists to prevent is a lane that is wired in the shared
  // module and never reached from the EF.
  const src = await Deno.readTextFile(
    new URL("../consumer-web-recommend-swipe/index.ts", import.meta.url),
  );
  assertEquals(src.includes("cfg.slotting"), true);
});
