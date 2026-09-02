import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  blend,
  discoveryRank,
  rankByBlend,
  slotPromoted,
  type SignalWeights,
} from "./discovery-blend.ts";
import {
  LEVEL_PARTNER,
  LEVEL_PROMOTING,
  SIGNAL_KEYS,
  type SignalPlace,
} from "./discovery-signals.ts";
import { placePromotingLevel, type PromotingFields } from "./place-promoting.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  rating: number;
  votes: number;
  promo: PromotingFields | null;
};

const row = (id: string, rating: number, votes = 500, promo: PromotingFields | null = null): Row => ({
  id,
  rating,
  votes,
  promo,
});

const project = (r: Row): SignalPlace => ({
  lat: null,
  lng: null,
  hours: null,
  category: null,
  family_keys: null,
  rating: r.rating,
  user_ratings_total: r.votes,
  embedding: null,
});

const promotingOf = (r: Row) => r.promo;

/**
 * A place that genuinely promotes: a paid plan plus a strategy above zero.
 *
 * The rate tuples are the PRESETS in _shared/promo-strategy.ts, exactly —
 * `strategyForRates` matches all four rates or returns null (→ zero rung), so
 * an invented tuple produces a place that does not promote at all and every
 * slotting assertion below would silently pass over an empty queue.
 */
const promoting = (strategy: "conservative" | "aggressive" | "dominant"): PromotingFields => {
  const rates: Record<string, Pick<
    PromotingFields,
    "welcome_free_rate" | "welcome_premium_rate" | "free_rate" | "premium_rate"
  >> = {
    conservative: {
      welcome_free_rate: 20,
      welcome_premium_rate: 30,
      free_rate: 10,
      premium_rate: 20,
    },
    aggressive: {
      welcome_free_rate: 30,
      welcome_premium_rate: 50,
      free_rate: 10,
      premium_rate: 30,
    },
    dominant: {
      welcome_free_rate: 40,
      welcome_premium_rate: 50,
      free_rate: 20,
      premium_rate: 30,
    },
  };
  return {
    plan: "pro",
    strike_count: 0,
    last_strike_at: null,
    promo_paused_until: null,
    plan_forfeited_at: null,
    ...rates[strategy],
  };
};

const WEIGHTS_OFF: SignalWeights = {
  name: 0,
  summary: 0,
  proximity: 0,
  timing: 0,
  category: 0,
  popularity: 0,
  mesita_level: 0,
  randomness: 0,
};

/** Popularity alone, so the earned order is deterministic and legible. */
const WEIGHTS_POPULARITY: SignalWeights = { ...WEIGHTS_OFF, popularity: 1 };

const NOW = new Date("2026-08-19T19:00:00Z");

// ── The blend ────────────────────────────────────────────────────────────────

Deno.test("the promo fixtures actually promote — guards every slotting test below", () => {
  // strategyForRates matches all four rates or returns null, so a mistyped
  // tuple yields a place at the zero rung and an empty slot queue. Every
  // assertion about slotting would then pass by doing nothing.
  for (const s of ["conservative", "aggressive", "dominant"] as const) {
    assert(
      placePromotingLevel(promoting(s), NOW) > 0,
      `the ${s} fixture does not promote — check it against promo-strategy.ts PRESETS`,
    );
  }
  assertEquals(placePromotingLevel(promoting("conservative"), NOW), 1);
  assertEquals(placePromotingLevel(promoting("aggressive"), NOW), 2);
  assertEquals(placePromotingLevel(promoting("dominant"), NOW), 3);
});

Deno.test("every weight at 0 makes every place tie at the identity", () => {
  const r = blend(project(row("a", 3)), {}, WEIGHTS_OFF);
  assertEquals(r.score, 1);
  // Every part is reported, and a disabled signal reports what it CONTRIBUTED
  // — the identity — because it was never called at all.
  assertEquals(Object.keys(r.parts).sort(), [...SIGNAL_KEYS].sort());
  for (const key of SIGNAL_KEYS) assertEquals(r.parts[key], 1);
});

Deno.test("a disabled signal is never called", () => {
  let called = false;
  blend(project(row("a", 3)), { random: () => ((called = true), 0.5) }, WEIGHTS_OFF);
  assert(!called, "Randomness ran despite its exponent being 0");
});

Deno.test("a weight of 0 is genuinely absent, not Math.pow(0,0) = 1 by luck", () => {
  // Proximity returns a hard 0 past its maximum. With w=0 that place must not
  // be deleted from the blend.
  const faraway: SignalPlace = {
    ...project(row("far", 4)),
    lat: 0,
    lng: 0,
  };
  const withOff = blend(faraway, { lat: 19.43, lng: -99.13 }, WEIGHTS_OFF);
  assertEquals(withOff.score, 1);
  const withOn = blend(faraway, { lat: 19.43, lng: -99.13 }, { ...WEIGHTS_OFF, proximity: 1 });
  assertEquals(withOn.score, 0);
});

Deno.test("a bigger exponent is harsher — s^2 sits below s for s in (0,1)", () => {
  const p = project(row("a", 4.0, 500));
  const at1 = blend(p, {}, { ...WEIGHTS_OFF, popularity: 1 }).score;
  const at2 = blend(p, {}, { ...WEIGHTS_OFF, popularity: 2 }).score;
  const atHalf = blend(p, {}, { ...WEIGHTS_OFF, popularity: 0.5 }).score;
  assert(at2 < at1, `w=2 (${at2}) must be harsher than w=1 (${at1})`);
  assert(atHalf > at1, `w=0.5 (${atHalf}) must be softer than w=1 (${at1})`);
  assertAlmostEquals(at2, at1 * at1, 1e-9);
});

Deno.test("the blend is the product of the parts raised to their weights", () => {
  const w: SignalWeights = { ...WEIGHTS_OFF, popularity: 2, randomness: 1 };
  const p = project(row("a", 4.4, 800));
  const r = blend(p, { random: () => 0.5 }, w);
  const expected = Math.pow(r.parts.popularity, 2) * Math.pow(r.parts.randomness, 1);
  assertAlmostEquals(r.score, expected, 1e-12);
});

Deno.test("blend passes operator params into each signal", () => {
  const p = project(row("a", 4.0, 500));
  const defaulted = blend(p, {}, { ...WEIGHTS_OFF, popularity: 1 }).score;
  const floored = blend(
    p,
    {},
    { ...WEIGHTS_OFF, popularity: 1 },
    { popularity: { floorRating: 4.5, priorRating: 4.2, confidence: 60 } },
  ).score;
  assert(floored < defaulted, `a higher floor should shrink the same rating: ${floored} vs ${defaulted}`);
});

Deno.test("rankByBlend sorts best-first and breaks ties on incoming order", () => {
  const rows = [row("c", 4.0), row("a", 4.8), row("b", 4.4)];
  const ranked = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  assertEquals(ranked.map((r) => r.row.id), ["a", "b", "c"]);

  // Identical inputs → the pool's own order survives, every time.
  const tied = [row("x", 4.2), row("y", 4.2), row("z", 4.2)];
  for (let i = 0; i < 20; i += 1) {
    const r = rankByBlend(tied, project, {}, WEIGHTS_POPULARITY);
    assertEquals(r.map((v) => v.row.id), ["x", "y", "z"]);
  }
});

// ── The bought lane ──────────────────────────────────────────────────────────

Deno.test("THE INVARIANT: rank is never for sale", () => {
  // Strip the promoted rows out of the served order, and what remains must be
  // the earned order, untouched. This is the machine-checkable form of the
  // two-lane decision (MESITA-1196) — if a future change lets money influence
  // a SCORE rather than a POSITION, this is what catches it.
  const rows = [
    row("a", 4.9),
    row("b", 4.8, 500, promoting("conservative")),
    row("c", 4.7),
    row("d", 4.6, 500, promoting("dominant")),
    row("e", 4.5),
    row("f", 4.4),
    row("g", 4.3, 500, promoting("aggressive")),
    row("h", 4.2),
    row("i", 4.1),
    row("j", 4.0),
  ];

  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  const earnedOrder = earned.map((r) => r.row.id);

  const served = slotPromoted(earned, promotingOf, { enabled: true, everyNth: 3 }, NOW);
  const servedIds = served.map((r) => r.row.id);

  // Nobody is lost, nobody is duplicated.
  assertEquals([...servedIds].sort(), [...earnedOrder].sort());
  assertEquals(new Set(servedIds).size, servedIds.length);

  // And the un-bought places keep their exact relative order.
  const promotedIds = new Set(rows.filter((r) => r.promo).map((r) => r.id));
  assertEquals(
    servedIds.filter((id) => !promotedIds.has(id)),
    earnedOrder.filter((id) => !promotedIds.has(id)),
  );
});

Deno.test("a popularity-only blend ignores promoting — Promotion is its own weight", () => {
  const plain = row("plain", 4.5);
  const bought = row("bought", 4.5, 500, promoting("dominant"));
  const a = blend(project(plain), {}, WEIGHTS_POPULARITY);
  const b = blend(project(bought), {}, WEIGHTS_POPULARITY);
  assertEquals(a.score, b.score);
  assertEquals(a.parts, b.parts);
});

Deno.test("Mesita Level weight lifts a live discount without reading rates", () => {
  const w: SignalWeights = { ...WEIGHTS_OFF, mesita_level: 1 };
  const quiet = blend(
    { ...project(row("quiet", 4.5)), plan: "pro", promoting: false },
    {},
    w,
  );
  const live = blend(
    { ...project(row("live", 4.5)), plan: "pro", promoting: true },
    {},
    w,
  );
  assert(live.score > quiet.score, `live ${live.score} must beat quiet ${quiet.score}`);
  assertEquals(quiet.parts.mesita_level, LEVEL_PARTNER);
  assertEquals(live.parts.mesita_level, LEVEL_PROMOTING);
});

Deno.test("slotting off is a no-op", () => {
  const rows = [row("a", 4.9), row("b", 4.0, 500, promoting("dominant")), row("c", 4.5)];
  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  const served = slotPromoted(earned, promotingOf, { enabled: false, everyNth: 2 }, NOW);
  assertEquals(served.map((r) => r.row.id), earned.map((r) => r.row.id));
});

Deno.test("a promoting place is MOVED forward, never duplicated", () => {
  const rows = [
    row("a", 4.9),
    row("b", 4.8),
    row("c", 4.7),
    row("d", 4.6),
    row("weak", 3.2, 500, promoting("dominant")),
  ];
  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  assertEquals(earned.map((r) => r.row.id).at(-1), "weak");

  const served = slotPromoted(earned, promotingOf, { enabled: true, everyNth: 2 }, NOW);
  const ids = served.map((r) => r.row.id);
  // Slot at position 2 (1-based) — the weakest place, bought forward.
  assertEquals(ids[1], "weak");
  assertEquals(ids.filter((i) => i === "weak").length, 1);
  assertEquals(ids.length, rows.length);
});

Deno.test("tier decides who takes a slot first; merit decides inside a tier", () => {
  const rows = [
    row("filler1", 5.0),
    row("filler2", 4.9),
    row("filler3", 4.8),
    row("filler4", 4.7),
    row("consv", 4.6, 500, promoting("conservative")),
    row("domHigh", 4.5, 500, promoting("dominant")),
    row("domLow", 4.4, 500, promoting("dominant")),
    row("aggr", 4.3, 500, promoting("aggressive")),
  ];
  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  const served = slotPromoted(earned, promotingOf, { enabled: true, everyNth: 2 }, NOW);
  const ids = served.map((r) => r.row.id);

  // Slots are positions 2, 4, 6, 8 (1-based).
  const slotted = [ids[1], ids[3], ids[5], ids[7]];
  // Dominant first (better-ranked dominant before the weaker one), then
  // aggressive, then conservative.
  assertEquals(slotted, ["domHigh", "domLow", "aggr", "consv"]);
});

Deno.test("a slot with nobody left to fill it falls back to merit, never a gap", () => {
  const rows = [
    row("a", 4.9),
    row("b", 4.8),
    row("only", 4.0, 500, promoting("dominant")),
    row("c", 4.7),
    row("d", 4.6),
    row("e", 4.5),
  ];
  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  const served = slotPromoted(earned, promotingOf, { enabled: true, everyNth: 2 }, NOW);
  assertEquals(served.length, rows.length);
  assertEquals(new Set(served.map((r) => r.row.id)).size, rows.length);
});

Deno.test("a paused or unpaid promo is not a bought lane at all", () => {
  const forfeited: PromotingFields = { ...promoting("dominant"), plan: "free" };
  const paused: PromotingFields = {
    ...promoting("dominant"),
    promo_paused_until: "2099-01-01T00:00:00Z",
  };
  const rows = [row("a", 4.9), row("b", 4.8), row("x", 3.0, 500, forfeited), row("y", 3.0, 500, paused)];
  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  const served = slotPromoted(earned, promotingOf, { enabled: true, everyNth: 2 }, NOW);
  // Nothing to slot → the earned order stands.
  assertEquals(served.map((r) => r.row.id), earned.map((r) => r.row.id));
});

Deno.test("everyNth is floored at 2 — bought slots can never be every card", () => {
  const rows = [
    row("a", 4.9),
    row("p1", 4.0, 500, promoting("dominant")),
    row("b", 4.8),
    row("p2", 3.9, 500, promoting("dominant")),
  ];
  const earned = rankByBlend(rows, project, {}, WEIGHTS_POPULARITY);
  for (const everyNth of [1, 0, -5]) {
    const served = slotPromoted(earned, promotingOf, { enabled: true, everyNth }, NOW);
    assertEquals(served.length, rows.length);
    // Position 1 is always earned — the top of the deck is never for sale.
    assertEquals(served[0].row.id, "a");
  }
});

// ── The pipeline ─────────────────────────────────────────────────────────────

Deno.test("discoveryRank runs earned then bought, and only in that order", () => {
  const rows = [
    row("a", 4.9),
    row("b", 4.8),
    row("weak", 3.0, 500, promoting("dominant")),
    row("c", 4.7),
  ];
  const viaPipeline = discoveryRank(
    rows,
    project,
    promotingOf,
    { now: NOW },
    WEIGHTS_POPULARITY,
    { enabled: true, everyNth: 2 },
  );
  const byHand = slotPromoted(
    rankByBlend(rows, project, { now: NOW }, WEIGHTS_POPULARITY),
    promotingOf,
    { enabled: true, everyNth: 2 },
    NOW,
  );
  assertEquals(viaPipeline.map((r) => r.row.id), byHand.map((r) => r.row.id));
});

Deno.test("an empty pool ranks to an empty deck", () => {
  assertEquals(
    discoveryRank([], project, promotingOf, {}, WEIGHTS_POPULARITY, {
      enabled: true,
      everyNth: 5,
    }),
    [],
  );
});
