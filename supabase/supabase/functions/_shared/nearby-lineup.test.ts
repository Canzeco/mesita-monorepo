import { assertEquals } from "jsr:@std/assert@1";
import { DISCOVERY_DEFAULTS } from "./discovery-config.ts";
import { mapLineupIntent, mapLineupWeights } from "./nearby-lineup.ts";
import { mergeNearbyCatalog, type NearbyLaneCaps } from "./nearby-places.ts";

const CENTER = { lat: 25.67, lng: -100.3 };
const LANES: NearbyLaneCaps = {
  mesitaCount: 2,
  googleCount: 2,
};

Deno.test("mergeNearbyCatalog stays distance-ordered — lineup is opt-in", () => {
  const close = {
    id: "listed-far-score",
    google_place_id: "ChIJ-close",
    lat: 25.67005,
    lng: -100.30005,
    category: "cafe",
    google_stars_overall: 3.1,
    google_review_count: 4,
  };
  const farther = {
    id: "listed-near-score",
    google_place_id: "ChIJ-far",
    lat: 25.672,
    lng: -100.302,
    category: "restaurant",
    google_stars_overall: 4.9,
    google_review_count: 800,
  };
  const merged = mergeNearbyCatalog([farther, close], [], CENTER, LANES);
  assertEquals(
    merged.filter((x) => x.kind === "listed").map((x) =>
      x.kind === "listed" ? x.row.id : ""
    ),
    ["listed-far-score", "listed-near-score"],
  );
});

Deno.test("Map mask zeros randomness against the blob default", () => {
  assertEquals(mapLineupWeights(DISCOVERY_DEFAULTS).randomness, 0);
  assertEquals(DISCOVERY_DEFAULTS.weights.randomness, 0.35);
});

Deno.test("Category intent is enabled types plus their families", () => {
  const intent = mapLineupIntent(["restaurant", "cafe"]);
  assertEquals(intent.categories, ["restaurant", "cafe"]);
  assertEquals(intent.families.includes("dinner"), true);
  assertEquals(intent.families.includes("coffee"), true);
  assertEquals(intent.families.includes("breakfast"), true);
});

