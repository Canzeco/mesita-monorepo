// deno test supabase/functions/_shared/discovery-swipe.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { DEFAULT_SWIPE, DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import {
  fillSwipeDeck,
  partitionSwipeTiers,
  rankSwipeDeck,
  SWIPE_TIER_ORDER,
  swipeAdmissionFilters,
  swipeLineupWeights,
  swipeOpenThrough,
  swipeDistanceKm,
  swipeReachKm,
  swipeSettledCount,
  swipeTierCount,
  widenSwipePool,
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

// ── Tiers: open-now and the radius band the deck, never empty it (MESITA-2047)
//
// The live catalog on 2026-09-22 was ONE place — Dos Amores, San Luis Potosí,
// 08:30–15:00, shut on Tuesdays — and Scroll said "No places yet" all Tuesday
// because the timing gate was a cut. These fixtures are that place.

/** Tue 2026-09-22 21:54 in San Luis Potosí (America/Mexico_City, UTC−6). */
const TUE_NIGHT = new Date("2026-09-23T03:54:00Z");
/** Wed 2026-09-23 12:00 local. */
const WED_NOON = new Date("2026-09-23T18:00:00Z");
const SLP = { lat: 22.1317, lng: -101.0135 };
const DOS_AMORES_HOURS = Object.fromEntries(
  ["monday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
    (d) => [d, [{ open: "08:30", close: "15:00" }]],
  ),
);

type TierRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  hours: unknown;
  google_stars_overall?: number;
  google_review_count?: number;
  plan?: string;
  category?: string;
};

function slp(
  id: string,
  kmSouth: number | null,
  hours: unknown = DOS_AMORES_HOURS,
): TierRow {
  return {
    id,
    lat: kmSouth === null ? null : SLP.lat - kmSouth / 111,
    lng: kmSouth === null ? null : SLP.lng,
    hours,
    google_stars_overall: 4.7,
    google_review_count: 262,
    plan: "free",
    category: "brunch",
  };
}

function tiersAt<T extends TierRow>(
  rows: T[],
  at: Date,
  geo: { lat: number; lng: number } | null,
) {
  return partitionSwipeTiers(rows, {
    geo,
    radiusKm: DEFAULT_SWIPE.radiusKm,
    reachKm: swipeReachKm(DEFAULT_SWIPE.radiusKm, PARAMS),
    bufferMin: DEFAULT_SWIPE.closingBufferMin,
    hoursOf: (r) => r.hours,
    latOf: (r) => r.lat,
    // Unlocated rows keep the place's own clock; the zone is lng-banded.
    lngOf: (r) => r.lng,
    at,
  });
}

const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);
const SHUT = { tuesday: [{ open: "08:30", close: "15:00" }] };
/** The real blend, the real bought lane — what the EF hands fillSwipeDeck. */
const rankLive = (at: Date, geo: { lat: number; lng: number } | null) =>
<T,>(band: T[]) =>
  rankSwipeDeck(band, geo, WEIGHTS, DISCOVERY_DEFAULTS.slotting, PARAMS, {
    now: at,
    random: () => 0.5,
  });

Deno.test("tiers: the live case — one closed place, no geo, fills a deck of one", async () => {
  // The exact request web's shared deck and every Expo binary send: no lat/lng.
  const tiers = tiersAt([slp("dos-amores", 0)], TUE_NIGHT, null);
  assertEquals(ids(tiers.strict), []);
  assertEquals(ids(tiers.closedReach), ["dos-amores"]);
  const { deck, backfilled } = await fillSwipeDeck(
    tiers,
    50,
    rankLive(TUE_NIGHT, null),
  );
  assertEquals(ids(deck), ["dos-amores"]);
  assertEquals(backfilled, 1);
});

Deno.test("tiers: the same place at Wednesday noon is strict, not backfill", async () => {
  const tiers = tiersAt([slp("dos-amores", 0)], WED_NOON, SLP);
  assertEquals(ids(tiers.strict), ["dos-amores"]);
  const { deck, backfilled } = await fillSwipeDeck(
    tiers,
    50,
    rankLive(WED_NOON, SLP),
  );
  assertEquals(ids(deck), ["dos-amores"]);
  assertEquals(backfilled, 0);
});

Deno.test("tiers: a located guest 400 km away still gets the one place", async () => {
  const guest = { lat: SLP.lat + 400 / 111, lng: SLP.lng };
  const tiers = tiersAt([slp("dos-amores", 0)], TUE_NIGHT, guest);
  assertEquals(ids(tiers.beyond), ["dos-amores"]);
  const { deck } = await fillSwipeDeck(tiers, 50, rankLive(TUE_NIGHT, guest));
  assertEquals(ids(deck), ["dos-amores"]);
});

Deno.test("tiers: reach is the operator's Proximity maxKm, never under the radius", () => {
  assertEquals(swipeReachKm(5, PARAMS), 25);
  assertEquals(swipeReachKm(5, { proximity: { maxKm: 40 } }), 40);
  assertEquals(swipeReachKm(5, { proximity: { maxKm: 2 } }), 5);
  assertEquals(swipeReachKm(5, undefined), 25);
});

Deno.test("tiers: each row lands in exactly one band", () => {
  const rows = [
    slp("open-near", 1),
    slp("open-reach", 10),
    slp("closed-near", 1, SHUT),
    // Open at noon, shut at 12:20 — inside the 30-minute buffer.
    slp("closing-near", 1, { wednesday: [{ open: "08:30", close: "12:20" }] }),
    // No hours: "cannot tell" is not "open".
    slp("unknown-near", 1, null),
    slp("closed-reach", 20, SHUT),
    slp("open-beyond", 360),
    slp("closed-beyond", 30, SHUT),
    // With geo, an unlocated row cannot prove where it is.
    slp("unlocated", null),
  ];
  const tiers = tiersAt(rows, WED_NOON, SLP);
  assertEquals(ids(tiers.strict), ["open-near"]);
  assertEquals(ids(tiers.openReach), ["open-reach"]);
  assertEquals(ids(tiers.closedReach), [
    "closed-near",
    "closing-near",
    "unknown-near",
    "closed-reach",
  ]);
  // Beyond reach is one band, nearest first, open or not.
  assertEquals(ids(tiers.beyond), ["closed-beyond", "open-beyond"]);
  assertEquals(ids(tiers.unplaced), ["unlocated"]);
  assertEquals(swipeTierCount(tiers), rows.length);
});

Deno.test("tiers: no geo means every row is near — there is no radius without a centre", () => {
  const rows = [slp("a", 1), slp("b", 900), slp("c", null)];
  const tiers = tiersAt(rows, WED_NOON, null);
  assertEquals(ids(tiers.strict), ["a", "b", "c"]);
  assertEquals(swipeTierCount(tiers), 3);
});

Deno.test("tiers: THE GUEST'S OWN CITY BEATS AN OPEN BAR IN ANOTHER ONE", async () => {
  // Review finding on the first cut of MESITA-2047: with open-far above
  // closed-near and no ceiling on "far", a guest in SLP at 23:00 was served a
  // CDMX bar and a Tijuana bar before the SLP place still open for 20 minutes.
  const tue2300 = new Date("2026-09-23T05:00:00Z");
  const rows = [
    { ...slp("tijuana-open", 1800), hours: { tuesday: [{ open: "18:00", close: "03:00" }] } },
    { ...slp("cdmx-open", 360), hours: { tuesday: [{ open: "18:00", close: "03:00" }] } },
    slp("slp-closing-in-20", 1, { tuesday: [{ open: "18:00", close: "23:20" }] }),
    slp("slp-closed", 1, { monday: [{ open: "08:30", close: "15:00" }] }),
  ];
  const tiers = tiersAt(rows, tue2300, SLP);
  const { deck } = await fillSwipeDeck(tiers, 50, rankLive(tue2300, SLP));
  const order = ids(deck);
  assertEquals(order.indexOf("slp-closing-in-20") < order.indexOf("cdmx-open"), true);
  assertEquals(order.indexOf("slp-closed") < order.indexOf("cdmx-open"), true);
  // Beyond reach, nearest first.
  assertEquals(order.slice(2), ["cdmx-open", "tijuana-open"]);
  assertEquals(ids(tiers.beyond), ["cdmx-open", "tijuana-open"]);
});

Deno.test("tiers: beyond reach is one band, nearest first, and ranking never reorders it", async () => {
  // Past reach Proximity scores a flat 0 for every row, so distance is the
  // only honest order — and the wider-ask stop rule relies on it.
  const rows = [
    slp("far-90", 90, SHUT),
    { ...slp("far-30-promoting", 30, SHUT), ...PROMO_RATES, plan: "pro" },
    slp("open-60", 60),
    slp("far-45", 45, SHUT),
    slp("open-40", 40),
  ];
  const tiers = tiersAt(rows, WED_NOON, SLP);
  const order = ["far-30-promoting", "open-40", "far-45", "open-60", "far-90"];
  assertEquals(ids(tiers.beyond), order);
  let rankedBeyond = false;
  const { deck } = await fillSwipeDeck(tiers, 50, (band, tier) => {
    if (tier === "beyond") rankedBeyond = true;
    return [...band].reverse();
  });
  assertEquals(rankedBeyond, false);
  assertEquals(ids(deck), order);
});

Deno.test("tiers: an unlocated place never ranks above located ones", async () => {
  // Review finding: Proximity scores a missing place geo 0.35, above any
  // located place past reach (0) and above one at 9 km (~0.3). Its own band,
  // last, is what keeps it there under the REAL blend.
  const rows = [
    slp("unlocated", null),
    slp("far-300", 300),
    slp("reach-9", 9),
    slp("far-40", 40),
  ];
  const tiers = tiersAt(rows, WED_NOON, SLP);
  const { deck } = await fillSwipeDeck(tiers, 50, rankLive(WED_NOON, SLP));
  assertEquals(ids(deck), ["reach-9", "far-40", "far-300", "unlocated"]);
});

Deno.test("fill: a full strict band never reaches, or ranks, a backfill band", async () => {
  const tiers = tiersAt(
    [slp("s1", 1), slp("s2", 2), slp("s3", 3), slp("far", 40)],
    WED_NOON,
    SLP,
  );
  const ranked: string[] = [];
  const { deck, backfilled } = await fillSwipeDeck(tiers, 3, (rows, tier) => {
    ranked.push(tier);
    return rows;
  });
  assertEquals(ids(deck), ["s1", "s2", "s3"]);
  assertEquals(backfilled, 0);
  assertEquals(ranked, ["strict"]);
});

Deno.test("fill: a short strict band is topped up band by band, in band order", async () => {
  const tiers = tiersAt(
    [
      slp("unlocated", null),
      slp("closed-beyond", 40, SHUT),
      slp("open-beyond", 40),
      slp("closed-near", 1, SHUT),
      slp("open-reach", 10),
      slp("strict", 1),
    ],
    WED_NOON,
    SLP,
  );
  const all = await fillSwipeDeck(tiers, 50, (rows) => rows);
  assertEquals(ids(all.deck), [
    "strict",
    "open-reach",
    "closed-near",
    "closed-beyond",
    "open-beyond",
    "unlocated",
  ]);
  assertEquals(all.backfilled, 5);
  const three = await fillSwipeDeck(tiers, 3, (rows) => rows);
  assertEquals(ids(three.deck), ["strict", "open-reach", "closed-near"]);
  assertEquals(SWIPE_TIER_ORDER, [
    "strict",
    "openReach",
    "closedReach",
    "beyond",
    "unplaced",
  ]);
});

Deno.test("fill: THE BAND INVARIANT — a bought slot cannot lift a closed place over an open one", async () => {
  // Slotting every 2nd position, zero weights so merit is incoming order: in
  // one merged ranking the promoting closed place would take slot 2, above an
  // open one. Ranked per band, it waits below every strict row.
  const rows = [
    slp("open-a", 1),
    slp("open-b", 1),
    slp("open-c", 1),
    { ...slp("closed-promoting", 1, SHUT), ...PROMO_RATES, plan: "pro" },
  ];
  const tiers = tiersAt(rows, WED_NOON, SLP);
  const rankBand = (band: TierRow[]) =>
    rankSwipeDeck(band, SLP, ZERO_WEIGHTS, { enabled: true, everyNth: 2 }, PARAMS, {
      now: WED_NOON,
      random: () => 0.5,
    });
  const { deck } = await fillSwipeDeck(tiers, 50, rankBand);
  assertEquals(ids(deck), ["open-a", "open-b", "open-c", "closed-promoting"]);
  // The control: the same rows ranked as ONE list do let money jump the band.
  assertEquals(ids(rankBand(rows)).indexOf("closed-promoting") < 3, true);
});

Deno.test("fill: ranking off still bands (identity rank keeps band order)", async () => {
  const tiers = tiersAt([slp("closed", 1, SHUT), slp("open", 1)], WED_NOON, SLP);
  const { deck } = await fillSwipeDeck(tiers, 50, (rows) => rows);
  assertEquals(ids(deck), ["open", "closed"]);
});

Deno.test("swipeOpenThrough: open through the buffer, and unknown is not open", () => {
  // Wed 14:45 local: open, but 15:00 close is inside a 30-minute buffer.
  const wed1445 = new Date("2026-09-23T20:45:00Z");
  assertEquals(swipeOpenThrough(DOS_AMORES_HOURS, SLP.lng, 30, wed1445), false);
  assertEquals(swipeOpenThrough(DOS_AMORES_HOURS, SLP.lng, 10, wed1445), true);
  assertEquals(swipeOpenThrough(DOS_AMORES_HOURS, SLP.lng, 0, WED_NOON), true);
  assertEquals(swipeOpenThrough(DOS_AMORES_HOURS, SLP.lng, 30, TUE_NIGHT), false);
  assertEquals(swipeOpenThrough(null, SLP.lng, 30, WED_NOON), false);
});

Deno.test("recommend-swipe bands instead of cutting on open-now and radius", async () => {
  // The bug MESITA-2047 fixed was a gate, not a ranking: pin the wiring so a
  // later "cleanup" cannot quietly put the cut back.
  const src = await Deno.readTextFile(
    new URL("../consumer-web-recommend-swipe/index.ts", import.meta.url),
  );
  assertEquals(src.includes("partitionSwipeTiers("), true);
  assertEquals(src.includes("fillSwipeDeck("), true);
  assertEquals(src.includes("swipeReachKm(filters.maxDistanceKm, cfg.params)"), true);
  // The ring loop lives in the tested helper, not inline in the EF.
  assertEquals(src.includes("await widenSwipePool({"), true);
  assertEquals(src.includes("provenWithin"), false);
  assertEquals(src.includes("admitSwipeTiming"), false);
  assertEquals(src.includes("trimToRadius"), false);
  // The frozen Expo shape keeps its two keys; backfilled is additive.
  assertEquals(
    src.includes("summary: { candidates: tiers.strict.length, embedded, backfilled }"),
    true,
  );
});

// ── The wider asks: stop only on bands no farther place can enter ────────────
//
// Re-review of MESITA-2047: the first stop rule counted every admitted row
// inside the searched circle, open or closed, so ten open and forty-five
// closed places inside 5 km "filled" the deck and the reach ask never ran —
// thirty open places 10 km away never reached a guest the band order puts
// them in front of.

type CatalogRow = TierRow & { km: number };

/** A fake pool query over a whole catalog: a box of `km` around the guest. */
function ringOver(catalog: CatalogRow[], asked: number[]) {
  return (km: number) => {
    asked.push(km);
    return Promise.resolve(
      km === 0 ? catalog : catalog.filter((r) => r.km <= km),
    );
  };
}

function catalogOf(groups: Array<[prefix: string, n: number, km: number, hours: unknown]>) {
  const out: CatalogRow[] = [];
  for (const [prefix, n, km, hours] of groups) {
    for (let i = 0; i < n; i++) out.push({ ...slp(`${prefix}-${i}`, km, hours), km });
  }
  return out;
}

async function deckFor(catalog: CatalogRow[], at: Date, limit = 50) {
  const reachKm = swipeReachKm(DEFAULT_SWIPE.radiusKm, PARAMS);
  const first = catalog.filter((r) => r.km <= DEFAULT_SWIPE.radiusKm);
  const asked: number[] = [];
  const tiersOf = (rows: CatalogRow[]) => tiersAt(rows, at, SLP);
  const admitted = await widenSwipePool({
    limit,
    admitted: first,
    seen: new Set(first.map((r) => r.id)),
    radiusKm: DEFAULT_SWIPE.radiusKm,
    reachKm,
    rings: [reachKm, 500, 0],
    fetchRing: ringOver(catalog, asked),
    idOf: (r) => r.id,
    admit: (rows) => rows,
    tiersOf,
    distanceOf: (r) => swipeDistanceKm(SLP, r.lat, r.lng),
  });
  const { deck } = await fillSwipeDeck(tiersOf(admitted), limit, (rows) => rows);
  const count = (prefix: string) =>
    deck.filter((r) => r.id.startsWith(`${prefix}-`)).length;
  return { deck, asked, count };
}

Deno.test("widen: closed places inside the radius do not stop the reach ask", async () => {
  const catalog = catalogOf([
    ["open1", 10, 1, DOS_AMORES_HOURS],
    ["closed2", 45, 2, SHUT],
    ["open10", 30, 10, DOS_AMORES_HOURS],
  ]);
  const { asked, count } = await deckFor(catalog, WED_NOON);
  assertEquals(asked[0], 25);
  assertEquals(count("open1"), 10);
  assertEquals(count("open10"), 30);
  assertEquals(count("closed2"), 10);
});

Deno.test("widen: fifty open places inside the radius ask nothing wider", async () => {
  const catalog = catalogOf([
    ["open1", 50, 1, DOS_AMORES_HOURS],
    ["open10", 30, 10, DOS_AMORES_HOURS],
  ]);
  const { asked, count } = await deckFor(catalog, WED_NOON);
  assertEquals(asked, []);
  assertEquals(count("open1"), 50);
});

Deno.test("widen: a full reach stops before 500 km", async () => {
  const catalog = catalogOf([
    ["open1", 5, 1, DOS_AMORES_HOURS],
    ["closed20", 60, 20, SHUT],
    ["open300", 10, 300, DOS_AMORES_HOURS],
  ]);
  const { asked, count } = await deckFor(catalog, WED_NOON);
  assertEquals(asked, [25]);
  assertEquals(count("open1"), 5);
  assertEquals(count("closed20"), 45);
});

Deno.test("widen: beyond reach, the nearer city fills before the farther one", async () => {
  // 500 km holds 60 places: they are final once 500 km is searched, so the
  // unboxed ask never runs and nothing at 900 km can jump them.
  const catalog = catalogOf([
    ["open1", 3, 1, DOS_AMORES_HOURS],
    ["closed200", 60, 200, SHUT],
    ["open900", 10, 900, DOS_AMORES_HOURS],
  ]);
  const { asked, count } = await deckFor(catalog, WED_NOON);
  assertEquals(asked, [25, 500]);
  assertEquals(count("open1"), 3);
  assertEquals(count("closed200"), 47);
});

Deno.test("widen: the one-place catalog 400 km away is found", async () => {
  const catalog = catalogOf([["dos-amores", 1, 400, DOS_AMORES_HOURS]]);
  const { asked, deck } = await deckFor(catalog, TUE_NIGHT);
  // One row cannot fill fifty, so every ring is asked — three small queries.
  assertEquals(asked, [25, 500, 0]);
  assertEquals(deck.length, 1);
});

Deno.test("widen: an unplaced row only arrives from the unboxed ask, and sorts last", async () => {
  const catalog: CatalogRow[] = [
    { ...slp("unlocated", null), km: Infinity },
    { ...slp("far", 900), km: 900 },
  ];
  const { asked, deck } = await deckFor(catalog, WED_NOON);
  assertEquals(asked, [25, 500, 0]);
  assertEquals(ids(deck), ["far", "unlocated"]);
});

Deno.test("widen: a failed ring keeps what the rings before it found", async () => {
  const catalog = catalogOf([
    ["open1", 2, 1, DOS_AMORES_HOURS],
    ["open10", 3, 10, DOS_AMORES_HOURS],
  ]);
  const asked: number[] = [];
  const admitted = await widenSwipePool({
    limit: 50,
    admitted: catalog.filter((r) => r.km <= 5),
    seen: new Set(catalog.filter((r) => r.km <= 5).map((r) => r.id)),
    radiusKm: 5,
    reachKm: 25,
    rings: [25, 500, 0],
    fetchRing: (km) => {
      asked.push(km);
      return Promise.resolve(km === 25 ? catalog : null);
    },
    idOf: (r) => r.id,
    admit: (rows) => rows,
    tiersOf: (rows) => tiersAt(rows, WED_NOON, SLP),
    distanceOf: (r) => swipeDistanceKm(SLP, r.lat, r.lng),
  });
  assertEquals(asked, [25, 500]);
  assertEquals(admitted.length, 5);
});

Deno.test("settled: short of reach only strict is final; from reach, all of reach plus the searched beyond", () => {
  const catalog = catalogOf([
    ["open1", 2, 1, DOS_AMORES_HOURS],
    ["closed2", 3, 2, SHUT],
    ["open10", 4, 10, DOS_AMORES_HOURS],
    ["far300", 5, 300, SHUT],
  ]);
  const tiers = tiersAt(catalog, WED_NOON, SLP);
  const d = (r: CatalogRow) => swipeDistanceKm(SLP, r.lat, r.lng);
  assertEquals(swipeSettledCount(tiers, 5, 25, d), 2);
  assertEquals(swipeSettledCount(tiers, 25, 25, d), 9);
  assertEquals(swipeSettledCount(tiers, 500, 25, d), 14);
});
