// The Map and Catalog scores and their gates (MESITA-2327; one pool since
// MESITA-2379; points only since Territory was retired, MESITA-2603; split
// into the Map and the Catalog, MESITA-2909).
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  type AreaCandidate,
  type AreaContext,
  areaScore,
  familyGate,
  insideBounds,
  rankArea,
} from "./area-score.ts";

const ANCHOR = { lat: 19.43, lng: -99.13 };
/** Popularity of a 4.0★ place with 100 reviews: (1 + 100 × 4)^0.33 ≈ 7.23,
 *  the cube root (MESITA-3083; ln before it, MESITA-2710). */
const POP = Math.pow(401, 0.33);
const CTX: AreaContext = {
  location: { kind: "point", anchor: ANCHOR, radiusKm: 8 },
  families: [],
  halfKm: 4,
};
const BOUNDS = { low: { lat: 19.4, lng: -99.2 }, high: { lat: 19.5, lng: -99.1 } };
const NONE: AreaContext = { ...CTX, location: { kind: "none" } };
const cand = (over: Partial<AreaCandidate> = {}): AreaCandidate => ({
  id: "a",
  lat: ANCHOR.lat,
  lng: ANCHOR.lng,
  rating: 4.5,
  reviewCount: 1000,
  familyKeys: ["dinner"],
  source: "mesita",
  ...over,
});

Deno.test("point: final = Proximity × Popularity (no exponents, MESITA-2722)", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), CTX);
  assertEquals(s.formula, "point");
  assertEquals(s.signals.proximity, 1);
  assertAlmostEquals(s.signals.popularity!, POP, 1e-12);
  assertAlmostEquals(s.final, 1 * POP, 1e-12);
  assertEquals("weights" in s, false);
  assertEquals(s.gates.family, 1);
  assertEquals(s.gates.radius, 1);
  // Territory is gone from the breakdown (MESITA-2603).
  assertEquals(Object.keys(s.gates).sort(), ["active", "family", "popularity", "radius", "ready", "reviews"]);
});

Deno.test("the source never scores: equal signals score equal, Mesita or Google (MESITA-2703, MESITA-2925)", () => {
  const mes = areaScore(cand({ source: "mesita" }), CTX);
  const goo = areaScore(cand({ source: "google" }), CTX);
  assertEquals(mes.final, goo.final);
  assertEquals("selected" in mes, false);
  // The source stays as provenance.
  assertEquals(goo.source, "google");
  const twin = rankArea([cand({ id: "g", source: "google" }), cand({ id: "s" })], (c) => c, CTX);
  assertEquals(twin.map((r) => r.item.id), ["g", "s"]);
});

Deno.test("insideBounds (the screen radius's cross check): edges included; unknown coordinates are out", () => {
  assertEquals(insideBounds({ lat: 19.4, lng: -99.2 }, BOUNDS), true);
  assertEquals(insideBounds({ lat: 19.5, lng: -99.1 }, BOUNDS), true);
  assertEquals(insideBounds({ lat: 19.51, lng: -99.15 }, BOUNDS), false);
  assertEquals(insideBounds({ lat: null, lng: -99.15 }, BOUNDS), false);
  // A rectangle across the antimeridian.
  const wrap = { low: { lat: -10, lng: 170 }, high: { lat: 10, lng: -170 } };
  assertEquals(insideBounds({ lat: 0, lng: 179 }, wrap), true);
  assertEquals(insideBounds({ lat: 0, lng: 0 }, wrap), false);
});

Deno.test("no location: final = Popularity", () => {
  const s = areaScore(cand({ rating: 4.0, reviewCount: 100 }), NONE);
  assertEquals(s.formula, "none");
  assertEquals(s.signals.proximity, null);
  assertEquals(s.gates.radius, null);
  assertAlmostEquals(s.final, POP, 1e-12);
});

Deno.test("Popularity is null (n/a) when rating or count is missing, and scores as 0", () => {
  const s = areaScore(cand({ rating: null }), CTX);
  assertEquals(s.signals.popularity, null);
  assertEquals(s.final, 0);
  assertEquals(areaScore(cand({ reviewCount: null }), NONE).final, 0);
});

Deno.test("a missing number sinks a place to the bottom, never off the list (MESITA-2428)", () => {
  const unrated = cand({ id: "unrated", rating: null, reviewCount: null, lat: ANCHOR.lat + 0.05 / 111.195 });
  const edge = cand({ id: "edge", rating: 4.9, reviewCount: 5000, lat: ANCHOR.lat + 7.9 / 111.195 });
  const ranked = rankArea([unrated, edge], (c) => c, CTX);
  assertEquals(ranked.map((r) => r.item.id), ["edge", "unrated"]);
  assertEquals(ranked[1].area.final, 0);
});

Deno.test("family gate: no family is always out; any family with no ask; exact match when asked", () => {
  assertEquals(familyGate([], []), 0);
  assertEquals(familyGate(["undefined"], []), 0);
  assertEquals(familyGate(["night_out"], []), 1);
  assertEquals(familyGate(["dinner"], ["dinner", "drinks"]), 1);
  assertEquals(familyGate(["coffee"], ["dinner"]), 0);
  assertEquals(familyGate([], ["dinner"]), 0);
  assertEquals(familyGate(["undefined"], ["dinner"]), 0);
});

Deno.test("a closed gate drops the candidate instead of ranking it at 0", () => {
  const ranked = rankArea(
    [cand({ id: "in" }), cand({ id: "out", familyKeys: ["coffee"] }), cand({ id: "far", lat: ANCHOR.lat + 0.2 })],
    (c) => c,
    { ...CTX, families: ["dinner"] },
  );
  assertEquals(ranked.map((r) => r.item.id), ["in"]);
});

Deno.test("a closed gate zeroes the score itself, not only the ranking", () => {
  assertEquals(areaScore(cand({ familyKeys: ["coffee"] }), { ...CTX, families: ["dinner"] }).final, 0);
  assertEquals(areaScore(cand({ lat: ANCHOR.lat + 0.2 }), CTX).gates.radius, 0);
  assertEquals(areaScore(cand({ lat: ANCHOR.lat + 0.2 }), CTX).final, 0);
});

Deno.test("ties break on distance, then id: deterministic", () => {
  const ranked = rankArea(
    [
      cand({ id: "b", rating: null }),
      cand({ id: "a", rating: null }),
      cand({ id: "far", rating: null, lat: ANCHOR.lat + 0.05 }),
    ],
    (c) => c,
    CTX,
  );
  assertEquals(ranked.map((r) => r.item.id), ["a", "b", "far"]);
});

Deno.test("at the half-distance Proximity is exactly ½, and the score is the plain product", () => {
  const c = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(c, CTX);
  assertAlmostEquals(s.signals.proximity!, 0.5, 1e-3);
  assertAlmostEquals(s.final, 0.5 * POP, 1e-3);
});

Deno.test("the breakdown carries the operational gates the sources applied", () => {
  const google = areaScore(cand({ source: "google", ready: null, reviews: 1 }), CTX);
  assertEquals(google.gates.ready, null);
  assertEquals(google.gates.reviews, 1);
  assertEquals(google.gates.active, 1);
  const mesita = areaScore(cand({ source: "mesita", ready: 1, reviews: null }), CTX);
  assertEquals(mesita.gates.ready, 1);
  assertEquals(mesita.gates.reviews, null);
  assertEquals(mesita.familyKeys, ["dinner"]);
});

Deno.test("non-finite numbers never reach the sort", () => {
  const ranked = rankArea(
    [
      cand({ id: "nan", rating: Number.NaN, reviewCount: 10 }),
      cand({ id: "inf", rating: 4.5, reviewCount: Number.POSITIVE_INFINITY }),
      cand({ id: "ok", rating: 4.0, reviewCount: 50 }),
    ],
    (c) => c,
    NONE,
  );
  for (const r of ranked) assertEquals(Number.isFinite(r.area.final), true, r.item.id);
  assertEquals(ranked[0].item.id, "ok");
});

Deno.test("the Map: the radius gates, Proximity is not read, Popularity orders (MESITA-2909)", () => {
  const map: AreaContext = { ...CTX, location: { kind: "point", anchor: ANCHOR, radiusKm: 3 }, halfKm: null };
  const near = cand({ id: "near", rating: 4.0, reviewCount: 30 });
  const far = cand({ id: "far", lat: ANCHOR.lat + 2.9 / 111.195, rating: 4.6, reviewCount: 1000 });
  const s = areaScore(far, map);
  assertEquals(s.signals.proximity, null);
  assertAlmostEquals(s.final, Math.pow(4601, 0.33), 1e-9);
  // The far, popular place outranks the near, quiet one inside the circle.
  assertEquals(rankArea([near, far], (c) => c, map).map((r) => r.item.id), ["far", "near"]);
  // Past the circle it is gated out.
  assertEquals(areaScore(cand({ lat: ANCHOR.lat + 3.1 / 111.195 }), map).gates.radius, 0);
});

Deno.test("the Catalog: no radius gate, Proximity ½ at the half distance (MESITA-2909)", () => {
  const catalog: AreaContext = { ...CTX, location: { kind: "point", anchor: ANCHOR, radiusKm: null }, halfKm: 4 };
  const mid = cand({ lat: ANCHOR.lat + 4 / 111.195, rating: 4.0, reviewCount: 100 });
  const s = areaScore(mid, catalog);
  assertAlmostEquals(s.signals.proximity!, 0.5, 1e-3);
  assertAlmostEquals(s.final, POP / 2, 1e-3);
  assertEquals(s.gates.radius, null);
  // 400 km out is lowered, never cut.
  const far = areaScore(cand({ lat: ANCHOR.lat + 400 / 111.195 }), catalog);
  assertEquals(far.gates.radius, null);
  assertEquals(far.final > 0, true);
});

Deno.test("Popularity is (1 + reviews × stars)^root, never normalized, and the product is never clamped (MESITA-2710, MESITA-3083)", () => {
  const big = areaScore(cand({ rating: 4.6, reviewCount: 1000 }), NONE);
  assertAlmostEquals(big.signals.popularity!, Math.pow(4601, 0.33), 1e-12);
  assertEquals(big.signals.popularity! > 1, true);
  // The score is Popularity itself, no cap at 1.
  assertAlmostEquals(big.final, Math.pow(4601, 0.33) * 1, 1e-9);
  // No reviews: a factor of 1, never 0 (the place still ranks by distance and plan).
  assertEquals(areaScore(cand({ reviewCount: 0 }), NONE).signals.popularity, 1);
  // More reviews at the same stars always rank higher; stars count too.
  const order = rankArea(
    [cand({ id: "few", reviewCount: 30, rating: 4.9 }), cand({ id: "many", reviewCount: 3000, rating: 4.2 })],
    (c) => c,
    NONE,
  );
  assertEquals(order.map((r) => r.item.id), ["many", "few"]);
});

Deno.test("the Popularity floor drops any place under it, Google or Mesita, Premier or not (MESITA-2714)", () => {
  const ctx: AreaContext = { ...CTX, popularityFloor: 2.7 };
  // (1 + 4 × 4)^0.33 ≈ 2.55 < 2.7: out. (1 + 5 × 4)^0.33 ≈ 2.73: in.
  const thin = cand({ id: "thin", rating: 4, reviewCount: 4, premierTier: 2 });
  const ok = cand({ id: "ok", rating: 4, reviewCount: 5, source: "google" });
  const unrated = cand({ id: "unrated", rating: null, reviewCount: null, source: "mesita" });
  assertEquals(areaScore(thin, ctx).gates.popularity, 0);
  assertEquals(areaScore(thin, ctx).final, 0);
  assertEquals(areaScore(ok, ctx).gates.popularity, 1);
  assertEquals(rankArea([thin, ok, unrated], (c) => c, ctx).map((r) => r.item.id), ["ok"]);
  // Off (0 or absent): nothing is screened, the gate reads null.
  assertEquals(areaScore(thin, CTX).gates.popularity, null);
  assertEquals(rankArea([thin, ok], (c) => c, { ...CTX, popularityFloor: 0 }).length, 2);
});

Deno.test("Premier multiplies by its tier, every other place by 1 (MESITA-2925)", () => {
  // One spot, so Popularity alone orders: (1 + 50 × 4)^0.33 ≈ 5.76, × 2 ≈
  // 11.5, under (1 + 3000 × 4.5)^0.33 ≈ 23.1: at the cube root a ×2 plan is
  // worth 8× the reviews, not 60× (MESITA-3083; under ln it won).
  const paid = cand({ id: "paid", rating: 4, reviewCount: 50, premierTier: 1 });
  const loved = cand({ id: "loved", rating: 4.5, reviewCount: 3000, source: "google" });
  const plain = cand({ id: "plain", rating: 4, reviewCount: 50 });
  assertEquals(areaScore(paid, CTX).selectedFactor, 2);
  assertEquals(areaScore(loved, CTX).selectedFactor, 1);
  assertEquals(areaScore(plain, CTX).selectedFactor, 1);
  assertAlmostEquals(areaScore(paid, CTX).final, 2 * areaScore(plain, CTX).final, 1e-9);
  assertEquals(rankArea([loved, plain, paid], (c) => c, CTX).map((r) => r.item.id), ["loved", "paid", "plain"]);
  // No location: Popularity × s.
  assertAlmostEquals(areaScore(paid, NONE).final, 2 * Math.pow(201, 0.33), 1e-9);
  // It never saves a place from the Popularity floor.
  const thin = cand({ id: "thin", rating: 4, reviewCount: 4, premierTier: 2 });
  assertEquals(areaScore(thin, { ...CTX, popularityFloor: 2.7 }).final, 0);
});

// NO REACH (MESITA-3015, money: Premier is sold). The reach (MESITA-2920)
// went with the log curve: under the reciprocal the Premier factor counts
// at any distance on every surface, and distance alone keeps a paid place
// in another city off a guest's Home.
const KM = 1 / 111.195;
const CATALOG: AreaContext = {
  location: { kind: "point", anchor: ANCHOR, radiusKm: null },
  families: [],
  halfKm: 1,
};
const TIERS: Array<{ label: string; over: Partial<AreaCandidate>; s: number }> = [
  { label: "Premier 2X", over: { source: "mesita", premierTier: 1 }, s: 2 },
  { label: "Premier 5X", over: { source: "mesita", premierTier: 2 }, s: 5 },
];

Deno.test("every surface keeps the full Premier factor at any distance (MESITA-3015)", () => {
  const map: AreaContext = { ...CATALOG, location: { kind: "point", anchor: ANCHOR, radiusKm: 50 }, halfKm: null };
  const chat: AreaContext = { ...CATALOG, location: { kind: "point", anchor: ANCHOR, radiusKm: 50 } };
  const none: AreaContext = { ...CATALOG, location: { kind: "none" } };
  for (const { label, over, s } of TIERS) {
    for (const km of [0.5, 9.9, 40]) {
      const far = cand({ ...over, lat: ANCHOR.lat + km * KM });
      const plain = cand({ source: "mesita", lat: ANCHOR.lat + km * KM });
      for (const [name, ctx] of [["catalog", CATALOG], ["map", map], ["chat", chat], ["none", none]] as const) {
        assertEquals(areaScore(far, ctx).selectedFactor, s, `${label} ${name} ${km}`);
        assertAlmostEquals(areaScore(far, ctx).final, s * areaScore(plain, ctx).final, 1e-9, `${label} ${name} ${km}`);
      }
    }
  }
  // No coordinates keeps the factor too; Proximity (0) is what zeroes it.
  const noPoint = areaScore(cand({ premierTier: 2, lat: null, lng: null }), CATALOG);
  assertEquals(noPoint.selectedFactor, 5);
  assertEquals(noPoint.final, 0);
});

Deno.test("Catalog: distance alone keeps a Premier 5X in another city off Home (MESITA-3015)", () => {
  // The worst case: the catalog's most popular place, paid 5X, 300 km
  // away, against a modest local one 2 km away.
  const farPaid = cand({ id: "far", source: "mesita", premierTier: 2, lat: ANCHOR.lat + 300 * KM, rating: 4.7, reviewCount: 10_000 });
  const local = cand({ id: "local", source: "mesita", lat: ANCHOR.lat + 2 * KM, rating: 4.0, reviewCount: 100 });
  assertEquals(rankArea([farPaid, local], (c) => c, CATALOG).map((r) => r.item.id), ["local", "far"]);
  // The ad still works across town: the same 5X at 10 km tops it.
  const nearPaid = cand({ ...farPaid, id: "near", lat: ANCHOR.lat + 10 * KM });
  assertEquals(rankArea([nearPaid, local], (c) => c, CATALOG).map((r) => r.item.id), ["near", "local"]);
});

Deno.test("one list: equal scores keep one stable order, so pages never repeat or skip (MESITA-3041)", () => {
  const twins = ["c", "a", "b"].map((id) => cand({ id, source: "mesita", lat: ANCHOR.lat + 2 * KM, rating: 4.5, reviewCount: 100 }));
  const first = rankArea(twins, (c) => c, CATALOG).map((r) => r.item.id);
  const again = rankArea([...twins].reverse(), (c) => c, CATALOG).map((r) => r.item.id);
  assertEquals(first, ["a", "b", "c"]);
  assertEquals(again, first);
});
