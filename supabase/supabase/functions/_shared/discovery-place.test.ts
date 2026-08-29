import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  BOUGHT_LANE_COLUMNS,
  DISCOVERY_EXTRA_COLUMNS,
  EARNED_LANE_COLUMNS,
  toLineupPlace,
  toPromotingFields,
  toSignalPlace,
} from "./discovery-place.ts";
import { PLACE_PUBLIC_COLUMNS } from "./place-columns.ts";
import { popularity } from "./discovery-signals.ts";
import { placePromotingLevel } from "./place-promoting.ts";

/** A row shaped the way `profiles` actually returns one. */
const ROW: Record<string, unknown> = {
  id: "p1",
  lat: 19.4326,
  lng: -99.1332,
  hours: { monday: [{ open: "09:00", close: "22:00" }] },
  category: "taqueria",
  family_keys: ["food"],
  // The Google-named columns — the whole point of the translation layer.
  google_stars_overall: 4.6,
  google_review_count: 900,
  embedding: "[0.1,0.2]",
  name_embedding: "[0.3,0.4]",
  // Bought lane.
  plan: "pro",
  welcome_free_rate: 40,
  welcome_premium_rate: 50,
  free_rate: 20,
  premium_rate: 30,
  strike_count: 0,
  last_strike_at: null,
  promo_paused_until: null,
  plan_forfeited_at: null,
};

Deno.test("every column the two lanes read is actually selectable", () => {
  // The failure this guards is silent: rename or drop a column and Popularity
  // reads null forever, falls back to the prior, and scores the whole deck
  // identically while looking healthy. PLACE_PUBLIC_COLUMNS is what every
  // engine SELECTs, so the lanes' columns must live in it — except the
  // embedding, which is deliberately outside the public projection and added
  // per-query.
  const selected = new Set(PLACE_PUBLIC_COLUMNS.split(",").map((c) => c.trim()));
  for (const col of EARNED_LANE_COLUMNS) {
    if (col === DISCOVERY_EXTRA_COLUMNS) continue;
    assert(selected.has(col), `earned lane reads "${col}", which no engine selects`);
  }
  for (const col of BOUGHT_LANE_COLUMNS) {
    assert(selected.has(col), `bought lane reads "${col}", which no engine selects`);
  }
  // And the embedding is genuinely NOT public — if it ever joins that list,
  // a 1536-float vector is riding on every consumer payload.
  assert(
    !selected.has(DISCOVERY_EXTRA_COLUMNS),
    "the embedding is in PLACE_PUBLIC_COLUMNS — it is now on every consumer payload",
  );
});

Deno.test("the lanes are disjoint — no column feeds both", () => {
  const earned = new Set<string>(EARNED_LANE_COLUMNS);
  const overlap = BOUGHT_LANE_COLUMNS.filter((c) => earned.has(c));
  assertEquals(overlap, [], `these columns feed both lanes: ${overlap.join(", ")}`);
});

Deno.test("toSignalPlace maps Google's column names onto the signal contract", () => {
  const p = toSignalPlace(ROW);
  assertEquals(p.rating, 4.6);
  assertEquals(p.user_ratings_total, 900);
  assertEquals(p.lat, 19.4326);
  assertEquals(p.category, "taqueria");
  assertEquals(p.family_keys, ["food"]);
  assertEquals(p.embedding, "[0.1,0.2]");
});

Deno.test("a mapped row moves Popularity off the prior — the dead-signal guard", () => {
  // This is the assertion that would have caught reading `row.rating`, which
  // does not exist on `places`.
  const mapped = popularity(toSignalPlace(ROW));
  const bare = popularity(toSignalPlace({ ...ROW, google_stars_overall: null, google_review_count: null }));
  assert(
    mapped !== bare,
    "Popularity scored a rated place identically to an unrated one — the rating columns are not reaching the signal",
  );
  assert(mapped > bare, `a 4.6 across 900 reviews (${mapped}) should beat the prior (${bare})`);
});

Deno.test("toLineupPlace adds nameEmbedding, plan, and promoting; toSignalPlace still omits them", () => {
  const earned = toSignalPlace(ROW) as unknown as Record<string, unknown>;
  assertEquals(earned.nameEmbedding, undefined);
  assertEquals(earned.plan, undefined);
  assertEquals(earned.promoting, undefined);
  const lineup = toLineupPlace(ROW);
  assertEquals(lineup.nameEmbedding, "[0.3,0.4]");
  assertEquals(lineup.plan, "pro");
  assertEquals(lineup.promoting, true);
  assertEquals(lineup.rating, 4.6);
  assertEquals(toLineupPlace({ ...ROW, plan: "free" }).promoting, false);
});

Deno.test("toSignalPlace carries no promo field, whatever the row holds", () => {
  const p = toSignalPlace(ROW) as unknown as Record<string, unknown>;
  for (const col of BOUGHT_LANE_COLUMNS) {
    assertEquals(p[col], undefined, `"${col}" leaked into the earned lane`);
  }
});

Deno.test("toPromotingFields preserves what the bought lane needs", () => {
  // The dominant preset on a paid plan with an open lane.
  assertEquals(placePromotingLevel(toPromotingFields(ROW), new Date("2026-08-19T19:00:00Z")), 3);
});

Deno.test("junk numbers degrade to null rather than poisoning a score", () => {
  const p = toSignalPlace({
    ...ROW,
    lat: "19.4",
    google_stars_overall: Number.NaN,
    google_review_count: Number.POSITIVE_INFINITY,
  });
  assertEquals(p.lat, null);
  assertEquals(p.rating, null);
  assertEquals(p.user_ratings_total, null);
});
