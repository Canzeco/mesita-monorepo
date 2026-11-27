import { assertEquals, assertAlmostEquals } from "jsr:@std/assert@1";
import { explainPlaceScores } from "./place-scores.ts";
import { foursquareBoost, googlePopularity } from "./pipeline-signals.ts";

const BASE = {
  rating: 4,
  reviewCount: 100,
  term: undefined,
  foursquarePopularity: null as number | null,
  foursquareUrl: "https://foursquare.com/v/abc",
  tier: 2,
  googleExp: 0.5,
  foursquareFactor: 1,
  foursquareExponent: 20,
  premierExp: 0,
  history: "Collecting history.",
};

Deno.test("the profile card uses Popular Organic and the same boost as ranking", () => {
  const missing = explainPlaceScores(BASE);
  assertEquals(missing.context, "Popular Organic · the place screen's ranking");
  assertEquals(missing.rows[0].value, explainPlaceScores({ ...BASE, foursquarePopularity: 0 }).rows[0].value);
  const full = explainPlaceScores({ ...BASE, foursquarePopularity: 1 });
  const google = googlePopularity({ rating: 4, reviewCount: 100 }, 0.5);
  assertAlmostEquals(Number(full.rows[0].value), google * foursquareBoost(1, 1, 20), 1e-9);
  assertEquals(full.rows[4].href, "https://foursquare.com/v/abc");
  assertEquals(full.rows[4].detail, "2×");
  const unavailable = explainPlaceScores(BASE);
  assertEquals(unavailable.rows[4].value, "Unavailable");
  assertEquals(unavailable.rows[4].detail, "Unavailable · 1×");
  assertEquals(unavailable.rows[4].href, "https://foursquare.com/v/abc");
  assertEquals(unavailable.rows[5].detail.includes("Your plan is Max"), true);
  assertEquals(unavailable.rows[5].value, "1×");
  assertEquals(unavailable.rows[6].detail, "Distance depends on the guest's location.");
});

Deno.test("seven observed days name the growth, and one snapshot says history is collecting", () => {
  const week = explainPlaceScores({
    ...BASE,
    term: { kind: "grow", elapsedDays: 7, growthBase: 3000 },
    history: "+14 reviews in 7 days · 2/day.",
  });
  assertEquals(week.rows[1].detail, "+14 reviews in 7 days · 2/day.");
  assertEquals(week.rows[3].detail, "recent 34% · lifetime 66%");
  const cold = explainPlaceScores({ ...BASE, history: "Collecting history." });
  assertEquals(cold.rows[1].detail, "Collecting history.");
  // Never a dash: no history yet reads 0 (MESITA-4556).
  assertEquals(cold.rows[1].value, "0");
  assertEquals(cold.rows[3].detail, "recent 0% · lifetime 100%");
});
