import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  blend,
  rankByBlend,
  type SignalWeights,
} from "./discovery-blend.ts";
import {
  ENRICHED_OFF,
  SIGNAL_KEYS,
  type SignalPlace,
} from "./discovery-signals.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  rating: number;
  votes: number;
};

const row = (id: string, rating: number, votes = 500): Row => ({
  id,
  rating,
  votes,
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

const WEIGHTS_OFF: SignalWeights = {
  name: 0,
  proximity: 0,
  timing: 0,
  category: 0,
  popularity: 0,
  enriched: 0,
  randomness: 0,
};

/** Popularity alone, so the earned order is deterministic and legible. */
const WEIGHTS_POPULARITY: SignalWeights = { ...WEIGHTS_OFF, popularity: 1 };

// ── The blend ────────────────────────────────────────────────────────────────

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

Deno.test("the Enriched weight reorders two rows a ranked lane ACTUALLY admits", () => {
  // BOTH ROWS ARE ENRICHED, because that is the only population this signal
  // ever scores: Map admits a listed row only through `isEnrichedListedRow`
  // and Scroll's pool is `.eq("content_state", "ready")`. An `enriched: false`
  // row here would make the assertion green by construction — production
  // never ranks one. What must move the blend is the difference between a
  // thin profile and a finished one, both admitted.
  const w: SignalWeights = { ...WEIGHTS_OFF, enriched: 1 };
  const thin = blend(
    { ...project(row("thin", 4.5)), enriched: true, crenupHighWater: 2 },
    {},
    w,
  );
  const full = blend(
    { ...project(row("full", 4.5)), enriched: true, crenupHighWater: 8 },
    {},
    w,
  );
  assert(full.score > thin.score, `full ${full.score} must beat thin ${thin.score}`);
  assertEquals(full.parts.enriched, 1);
  assertAlmostEquals(thin.parts.enriched, ENRICHED_OFF + (1 - ENRICHED_OFF) * 0.25, 1e-12);
  // The floor still holds at the bottom of the gradient: demote, never delete.
  const created = blend(
    { ...project(row("created", 4.5)), enriched: true, crenupHighWater: 0 },
    {},
    w,
  );
  assertAlmostEquals(created.parts.enriched, ENRICHED_OFF, 1e-12);
});

Deno.test("an empty pool ranks to an empty deck", () => {
  assertEquals(rankByBlend([], project, {}, WEIGHTS_POPULARITY), []);
});
