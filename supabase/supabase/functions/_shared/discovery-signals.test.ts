import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  category,
  clamp01,
  daypartScore,
  NEUTRAL,
  popularity,
  proximity,
  PROXIMITY_MAX_KM,
  randomness,
  name,
  partnership,
  PARTNERSHIP_NONE,
  PARTNERSHIP_PARTNER,
  promotion,
  PROMOTION_NONE,
  PROMOTION_LIVE,
  social,
  summary,
  SIGNAL_BLURBS,
  SIGNAL_KEYS,
  SIGNAL_LABELS,
  SIGNALS,
  timing,
  type SignalPlace,
} from "./discovery-signals.ts";

const place = (over: Partial<SignalPlace> = {}): SignalPlace => ({
  lat: 19.4326,
  lng: -99.1332,
  hours: null,
  category: null,
  family_keys: null,
  rating: null,
  user_ratings_total: null,
  embedding: null,
  ...over,
});

// CDMX centre, and a point ~2.2 km north of it.
const CDMX = { lat: 19.4326, lng: -99.1332 };

// ── The contract every signal shares ─────────────────────────────────────────

Deno.test("every signal returns [0,1] for every shape of garbage", () => {
  const nasty: SignalPlace[] = [
    place(),
    place({ lat: null, lng: null }),
    place({ rating: 99, user_ratings_total: -5 }),
    place({ rating: Number.NaN, user_ratings_total: Number.POSITIVE_INFINITY }),
    place({ hours: "not an object", embedding: "not a vector" }),
    place({ category: "", family_keys: [] }),
  ];
  const intents = [
    {},
    { lat: CDMX.lat, lng: CDMX.lng },
    { lat: Number.NaN, lng: Number.NaN },
    { categories: ["taqueria"], families: ["food"] },
    { queryVector: [1, 0, 0] },
    { queryNameVector: [1, 0, 0] },
  ];
  for (const key of SIGNAL_KEYS) {
    for (const p of nasty) {
      for (const i of intents) {
        const s = SIGNALS[key](p, i);
        assert(
          Number.isFinite(s) && s >= 0 && s <= 1,
          `${key} returned ${s} — outside [0,1]`,
        );
      }
    }
  }
});

Deno.test("the library, the labels and the blurbs name the same ten signals", () => {
  assertEquals(SIGNAL_KEYS.length, 10);
  assertEquals([...SIGNAL_KEYS], [
    "name",
    "summary",
    "proximity",
    "timing",
    "category",
    "popularity",
    "partnership",
    "promotion",
    "randomness",
    "social",
  ]);
  assertEquals(Object.keys(SIGNALS).sort(), [...SIGNAL_KEYS].sort());
  assertEquals(Object.keys(SIGNAL_LABELS).sort(), [...SIGNAL_KEYS].sort());
  assertEquals(Object.keys(SIGNAL_BLURBS).sort(), [...SIGNAL_KEYS].sort());
});

Deno.test("Promotion is a signal; the bought-lane key promoting is not", () => {
  assert((SIGNAL_KEYS as readonly string[]).includes("promotion"));
  assert(!(SIGNAL_KEYS as readonly string[]).includes("promoting"));
  assert(!(SIGNAL_KEYS as readonly string[]).includes("semantic"));
  assert((SIGNAL_KEYS as readonly string[]).includes("social"));
});

Deno.test("social abstains until Social Lineup writes an index", () => {
  assertEquals(social(place()), NEUTRAL);
  assertEquals(social(place(), { lat: CDMX.lat, lng: CDMX.lng }), NEUTRAL);
});

Deno.test("clamp01 turns non-finite into the neutral element, not zero", () => {
  assertEquals(clamp01(Number.NaN), NEUTRAL);
  assertEquals(clamp01(Number.POSITIVE_INFINITY), NEUTRAL);
  assertEquals(clamp01(-1), 0);
  assertEquals(clamp01(2), 1);
  assertEquals(clamp01(0.5), 0.5);
});

// ── Proximity ────────────────────────────────────────────────────────────────

Deno.test("proximity abstains at NEUTRAL when the guest sent no location", () => {
  assertEquals(proximity(place(), {}), NEUTRAL);
  assertEquals(proximity(place(), { lat: 19.4 }), NEUTRAL);
  assertEquals(proximity(place(), { lng: -99.1 }), NEUTRAL);
});

Deno.test("proximity scores 1 at zero distance and 0 past the maximum", () => {
  assertAlmostEquals(proximity(place(CDMX), CDMX), 1, 1e-9);
  // ~1.2 degrees of latitude ≈ 133 km, well past PROXIMITY_MAX_KM.
  assertEquals(proximity(place({ lat: CDMX.lat + 1.2, lng: CDMX.lng }), CDMX), 0);
});

Deno.test("proximity is monotonically decreasing in distance", () => {
  const deltas = [0, 0.005, 0.01, 0.05, 0.1, 0.15, 0.2];
  const scores = deltas.map((d) =>
    proximity(place({ lat: CDMX.lat + d, lng: CDMX.lng }), CDMX)
  );
  for (let i = 1; i < scores.length; i += 1) {
    assert(
      scores[i] <= scores[i - 1],
      `not monotonic at ${deltas[i]}°: ${scores[i]} > ${scores[i - 1]}`,
    );
  }
});

Deno.test("proximity's curve is logarithmic — a km near the guest costs far more than a km far away", () => {
  // The shape Docs §A asks for: "rewards very close hard and far gently". The
  // property is MARGINAL cost per kilometre, not the cost of a whole stretch —
  // 10→25 km spans fifteen kilometres and naturally costs more in total than
  // one does. Per km is where the curvature actually lives.
  const at = (km: number) => {
    // ~111 km per degree of latitude.
    const d = km / 111;
    return proximity(place({ lat: CDMX.lat + d, lng: CDMX.lng }), CDMX);
  };
  const nearPerKm = at(0) - at(1);
  const farPerKm = (at(10) - at(PROXIMITY_MAX_KM)) / (PROXIMITY_MAX_KM - 10);
  assert(
    nearPerKm > farPerKm * 5,
    `expected the first km (${nearPerKm}/km) to cost far more than a km out at range (${farPerKm}/km)`,
  );
});

Deno.test("an unlocated place is demoted, never deleted", () => {
  const s = proximity(place({ lat: null, lng: null }), CDMX);
  assert(s > 0 && s < 1, `expected a middling score, got ${s}`);
});

Deno.test("proximity hyperparameters change the curve and the missing-geo floor", () => {
  assertEquals(proximity(place({ lat: null, lng: null }), CDMX, { missingGeo: 0.1 }), 0.1);
  const farDefault = proximity(place({ lat: CDMX.lat + 0.2, lng: CDMX.lng }), CDMX);
  const farTight = proximity(place({ lat: CDMX.lat + 0.2, lng: CDMX.lng }), CDMX, {
    maxKm: 5,
    kneeKm: 0.2,
  });
  assert(farTight < farDefault, `tighter max/knee should punish far more: ${farTight} vs ${farDefault}`);
});

// ── Timing ───────────────────────────────────────────────────────────────────

const HOURS_ALWAYS = {
  monday: [{ open: "00:00", close: "23:59" }],
  tuesday: [{ open: "00:00", close: "23:59" }],
  wednesday: [{ open: "00:00", close: "23:59" }],
  thursday: [{ open: "00:00", close: "23:59" }],
  friday: [{ open: "00:00", close: "23:59" }],
  saturday: [{ open: "00:00", close: "23:59" }],
  sunday: [{ open: "00:00", close: "23:59" }],
};
const HOURS_NEVER = {
  monday: [{ open: "03:00", close: "03:30" }],
  tuesday: [{ open: "03:00", close: "03:30" }],
  wednesday: [{ open: "03:00", close: "03:30" }],
  thursday: [{ open: "03:00", close: "03:30" }],
  friday: [{ open: "03:00", close: "03:30" }],
  saturday: [{ open: "03:00", close: "03:30" }],
  sunday: [{ open: "03:00", close: "03:30" }],
};

// 2026-08-19 19:00Z ≈ 13:00 in CDMX (UTC-6) — inside the lunch daypart.
const MIDDAY = new Date("2026-08-19T19:00:00Z");

Deno.test("timing ranks open above closed, and closed above nothing", () => {
  const open = timing(place({ hours: HOURS_ALWAYS }), { now: MIDDAY });
  const closed = timing(place({ hours: HOURS_NEVER }), { now: MIDDAY });
  assert(open > closed, `open (${open}) should beat closed (${closed})`);
  assert(closed > 0, "closed must be demoted, not deleted");
});

Deno.test("timing abstains on the open half when there are no usable hours", () => {
  const unknown = timing(place({ hours: null }), { now: MIDDAY });
  const open = timing(place({ hours: HOURS_ALWAYS }), { now: MIDDAY });
  // No hours data behaves exactly like "open" at midday, because both halves
  // are then at their maximum — the place is never penalised for the gap.
  assertEquals(unknown, open);
});

Deno.test("daypart is coarse but ordered: dead hours lose to meal windows", () => {
  assert(daypartScore(4) < daypartScore(9));
  assert(daypartScore(9) <= daypartScore(13));
  assertEquals(daypartScore(13), 1);
  assertEquals(daypartScore(20), 1);
  for (let h = 0; h < 24; h += 1) {
    const s = daypartScore(h);
    assert(s >= 0 && s <= 1, `daypart(${h}) = ${s}`);
  }
});

Deno.test("timing and daypart read operator params", () => {
  assertEquals(daypartScore(4, { dead: 0.05 }), 0.05);
  const closedDefault = timing(place({ hours: HOURS_NEVER }), { now: MIDDAY });
  const closedHarsh = timing(place({ hours: HOURS_NEVER }), { now: MIDDAY }, {
    closedFloor: 0.01,
    openShare: 1,
  });
  assert(closedHarsh < closedDefault, `harsher closed floor should score lower: ${closedHarsh} vs ${closedDefault}`);
});

// ── Category ─────────────────────────────────────────────────────────────────

Deno.test("category abstains when the guest asked for nothing", () => {
  assertEquals(category(place({ category: "taqueria" }), {}), NEUTRAL);
  assertEquals(category(place({ category: "taqueria" }), { categories: [] }), NEUTRAL);
});

Deno.test("category ranks exact above family above miss", () => {
  const p = place({ category: "taqueria", family_keys: ["food"] });
  const exact = category(p, { categories: ["taqueria"] });
  const fam = category(p, { families: ["food"] });
  const miss = category(p, { categories: ["sushi"], families: ["nightlife"] });
  assert(exact > fam, `exact ${exact} should beat family ${fam}`);
  assert(fam > miss, `family ${fam} should beat miss ${miss}`);
  assert(miss > 0, "a wrong category is demoted, not deleted");
});

Deno.test("an uncategorised place is treated as an enrichment gap, not a miss", () => {
  const bare = category(place(), { categories: ["taqueria"] });
  const wrong = category(place({ category: "sushi", family_keys: ["food"] }), {
    categories: ["taqueria"],
    families: ["nightlife"],
  });
  assert(bare > wrong, `unknown (${bare}) should beat a known mismatch (${wrong})`);
});

// ── Popularity ───────────────────────────────────────────────────────────────

Deno.test("popularity shrinks a thin 5.0 below a thick 4.6", () => {
  const thin = popularity(place({ rating: 5, user_ratings_total: 3 }));
  const thick = popularity(place({ rating: 4.6, user_ratings_total: 900 }));
  assert(thick > thin, `900×4.6 (${thick}) should beat 3×5.0 (${thin})`);
});

Deno.test("popularity is monotonic in rating at a fixed volume", () => {
  const at = (r: number) => popularity(place({ rating: r, user_ratings_total: 500 }));
  assert(at(3.0) < at(4.0));
  assert(at(4.0) < at(4.5));
  assert(at(4.5) < at(5.0));
});

Deno.test("an unrated place gets the prior, not an abstention", () => {
  const unrated = popularity(place());
  assert(unrated > 0 && unrated < 1, `expected the catalog mean, got ${unrated}`);
  assert(unrated < NEUTRAL, "abstaining would hand a bare row a free 1");
});

Deno.test("popularity prior is an operator knob", () => {
  const low = popularity(place(), {}, { priorRating: 3.1, floorRating: 3, confidence: 60 });
  const high = popularity(place(), {}, { priorRating: 4.8, floorRating: 3, confidence: 60 });
  assert(high > low, `higher prior should lift an unrated place: ${high} vs ${low}`);
});

// ── Name ─────────────────────────────────────────────────────────────────────

Deno.test("name abstains without a name query vector", () => {
  assertEquals(name(place({ nameEmbedding: [1, 0, 0] }), {}), NEUTRAL);
  assertEquals(name(place({ nameEmbedding: [1, 0, 0] }), { queryNameVector: [] }), NEUTRAL);
  // Sharing Summary's query vector is not a Name query.
  assertEquals(name(place({ nameEmbedding: [1, 0, 0] }), { queryVector: [1, 0, 0] }), NEUTRAL);
});

Deno.test("name ranks a matching vector above an opposing one", () => {
  const q = [1, 0, 0];
  const same = name(place({ nameEmbedding: [1, 0, 0] }), { queryNameVector: q });
  const orth = name(place({ nameEmbedding: [0, 1, 0] }), { queryNameVector: q });
  const opp = name(place({ nameEmbedding: [-1, 0, 0] }), { queryNameVector: q });
  assertAlmostEquals(same, 1, 1e-9);
  assertAlmostEquals(orth, 0.5, 1e-9);
  assertAlmostEquals(opp, 0, 1e-9);
});

// ── Summary ──────────────────────────────────────────────────────────────────

Deno.test("summary abstains without a query vector", () => {
  assertEquals(summary(place({ embedding: [1, 0, 0] }), {}), NEUTRAL);
  assertEquals(summary(place({ embedding: [1, 0, 0] }), { queryVector: [] }), NEUTRAL);
  assertEquals(summary(place({ embedding: [1, 0, 0] }), { queryNameVector: [1, 0, 0] }), NEUTRAL);
});

Deno.test("summary ranks a matching vector above an opposing one", () => {
  const q = [1, 0, 0];
  const same = summary(place({ embedding: [1, 0, 0] }), { queryVector: q });
  const orth = summary(place({ embedding: [0, 1, 0] }), { queryVector: q });
  const opp = summary(place({ embedding: [-1, 0, 0] }), { queryVector: q });
  assertAlmostEquals(same, 1, 1e-9);
  assertAlmostEquals(orth, 0.5, 1e-9);
  assertAlmostEquals(opp, 0, 1e-9);
});

Deno.test("summary reads a pgvector string as readily as an array", () => {
  const fromString = summary(place({ embedding: "[1,0,0]" }), { queryVector: [1, 0, 0] });
  assertAlmostEquals(fromString, 1, 1e-9);
});

Deno.test("an unembedded place loses to an embedded one without being deleted", () => {
  const q = [1, 0, 0];
  const gap = summary(place({ embedding: null }), { queryVector: q });
  const hit = summary(place({ embedding: [1, 0, 0] }), { queryVector: q });
  assert(gap > 0 && gap < hit, `expected 0 < ${gap} < ${hit}`);
  // A dimension mismatch is the same kind of gap, never a crash.
  assertEquals(summary(place({ embedding: [1, 0] }), { queryVector: q }), gap);
});

Deno.test("summary unembedded floor is an operator knob", () => {
  const q = [1, 0, 0];
  assertEquals(summary(place({ embedding: null }), { queryVector: q }, { unembedded: 0.2 }), 0.2);
});

// ── Partnership ──────────────────────────────────────────────────────────────

Deno.test("partnership scores paid above free and never reads a promo field", () => {
  assertEquals(partnership(place()), PARTNERSHIP_NONE);
  assertEquals(partnership(place({ plan: "free" })), PARTNERSHIP_NONE);
  assertEquals(partnership(place({ plan: "pro" })), PARTNERSHIP_PARTNER);
  assertEquals(partnership(place({ plan: "PRO" })), PARTNERSHIP_PARTNER);
  assertEquals(
    partnership(place({ plan: "free", promoting: true })),
    PARTNERSHIP_NONE,
  );
  assert(PARTNERSHIP_NONE > 0, "free is demoted, not deleted");
});

Deno.test("promotion scores a live discount above the none floor", () => {
  assertEquals(promotion(place()), PROMOTION_NONE);
  assertEquals(promotion(place({ promoting: false })), PROMOTION_NONE);
  assertEquals(promotion(place({ promoting: true })), PROMOTION_LIVE);
  assertEquals(
    promotion(place({ plan: "pro", promoting: false })),
    PROMOTION_NONE,
  );
  assert(PROMOTION_NONE > 0, "not promoting is demoted, not deleted");
});

// ── Randomness ───────────────────────────────────────────────────────────────

Deno.test("randomness reads nothing about the place", () => {
  const rich = place({ rating: 5, user_ratings_total: 9999, category: "taqueria" });
  const bare = place();
  const fixed = () => 0.42;
  assertEquals(randomness(rich, { random: fixed }), randomness(bare, { random: fixed }));
});

Deno.test("randomness stays inside [0,1] across the RNG's whole range", () => {
  for (const r of [0, 0.5, 0.999999]) {
    const s = randomness(place(), { random: () => r });
    assert(s >= 0 && s <= 1, `randomness(${r}) = ${s}`);
  }
});
