import { assert, assertEquals } from "jsr:@std/assert@1";
import { name, proximity, PROXIMITY_MAX_KM } from "./discovery-signals.ts";
import {
  previewEnrichment,
  previewFamily,
  previewName,
  previewPopularity,
  previewProximity,
  previewRandomness,
  previewTiming,
} from "./discovery-signal-preview.ts";

Deno.test("proximity preview uses the live distance function", () => {
  const seen = previewProximity(PROXIMITY_MAX_KM, [
    0,
    1,
    PROXIMITY_MAX_KM,
    PROXIMITY_MAX_KM + 10,
  ]);
  assertEquals(
    seen.curve[0].score,
    proximity(
      {
        lat: 19.4326,
        lng: -99.1332,
        hours: null,
        category: null,
        rating: null,
        user_ratings_total: null,
        embedding: null,
      },
      { lat: 19.4326, lng: -99.1332 },
      { maxKm: PROXIMITY_MAX_KM },
    ),
  );
  assert(seen.curve[seen.curve.length - 1].score === 0);
  assert(seen.curve[1].score > seen.curve[2].score);
  assertEquals(seen.rows[1].score, 1);
});

Deno.test("name preview uses the live name function", () => {
  const same = [1, 0, 0];
  const other = [0, 1, 0];
  const rows = previewName(same, [
    { label: "Same", vector: same },
    { label: "Other", vector: other },
    { label: "Missing", vector: null },
  ]);
  assertEquals(
    rows[0].score,
    name(
      {
        lat: null,
        lng: null,
        hours: null,
        category: null,
        rating: null,
        user_ratings_total: null,
        embedding: null,
        nameEmbedding: same,
      },
      { queryNameVector: same },
    ),
  );
  assert(rows[0].score > rows[1].score);
});

Deno.test("family preview reports membership, and timing demotes a closed place", () => {
  const family = previewFamily("coffee", [
    { label: "In", family: "coffee" },
    { label: "Out", family: "drinks" },
  ]);
  assertEquals(family[0].note, "In coffee.");
  assertEquals(family[1].note, "Not in coffee.");
  assert(family[0].score > family[1].score);

  const timing = previewTiming(0.2);
  assert(timing[0].score > timing[1].score);
  assert(timing[1].score > 0);
});

Deno.test("popularity, enrichment, and randomness previews call the live functions", () => {
  const popular = previewPopularity([
    { label: "Few", rating: 5, reviews: 3 },
    { label: "Many", rating: 4.6, reviews: 900 },
    { label: "None", rating: null, reviews: 0 },
  ]);
  assertEquals(popular.length, 3);
  assert(popular[1].score > popular[0].score);

  const gate = previewEnrichment([
    { label: "Ready", enriched: true, ready: true },
    { label: "Created", enriched: false, ready: true },
  ]);
  assertEquals(gate[0].note, "Admitted.");
  assertEquals(gate[1].note, "Held out.");
  assert(gate[0].score > gate[1].score);

  const draws = previewRandomness(7, 4);
  assertEquals(draws.length, 4);
  assertEquals(
    previewRandomness(7, 4).map((row) => row.score),
    draws.map((row) => row.score),
  );
});
