import { assertEquals } from "jsr:@std/assert@1";
import {
  applyTileRandomness,
  enrichedSignal,
  familySignal,
  nameSignal,
  placesSearchRank,
  popularitySignal,
  proximitySignal,
  rankPlacesSearch,
  tileFlipProbability,
  type PlacesSearchFacts,
} from "./places-search-signals.ts";

const f = (n: number) => n.toFixed(2);

Deno.test("name is the cosine, clamped to -1..1", () => {
  assertEquals(nameSignal(0.86), 0.86);
  assertEquals(nameSignal(2), 1);
  assertEquals(nameSignal(-3), -1);
  assertEquals(nameSignal(Number.NaN), -1);
});

Deno.test("family is a gate, and no ask leaves it open", () => {
  assertEquals(familySignal(["food"], ["food"]), 1);
  assertEquals(familySignal(["drinks"], ["food"]), 0);
  assertEquals(familySignal(["food"], []), 1);
  assertEquals(familySignal(null, null), 1);
});

Deno.test("proximity is a log from 10 at the guest to 0 at 25 km", () => {
  assertEquals(f(proximitySignal(0)), "10.00");
  assertEquals(f(proximitySignal(0.5)), "8.76");
  assertEquals(f(proximitySignal(1)), "7.87");
  assertEquals(f(proximitySignal(5)), "4.50");
  assertEquals(f(proximitySignal(10)), "2.64");
  assertEquals(proximitySignal(25), 0);
  assertEquals(proximitySignal(40), 0);
});

Deno.test("popularity is ln(stars × reviews), capped at 10", () => {
  assertEquals(f(popularitySignal(5, 1)), "1.61");
  assertEquals(f(popularitySignal(4.5, 40)), "5.19");
  assertEquals(f(popularitySignal(4.6, 120)), "6.31");
  assertEquals(f(popularitySignal(4.8, 2000)), "9.17");
  assertEquals(popularitySignal(4.6, 5000), 10);
  assertEquals(popularitySignal(0, 100), 0);
  assertEquals(popularitySignal(null, 100), 0);
});

Deno.test("enriched is binary", () => {
  assertEquals(enrichedSignal(true), 1);
  assertEquals(enrichedSignal(false), 0);
});

Deno.test("a closed gate removes the place; the rank adds the three logs", () => {
  const open: PlacesSearchFacts = {
    cosine: 0.86,
    familyKeys: ["food"],
    km: 0.4,
    enriched: true,
    stars: 4.6,
    reviews: 120,
  };
  assertEquals(f(placesSearchRank(open, { hasGuestGeo: true, families: ["food"] }) ?? 0), "24.58");
  assertEquals(placesSearchRank(open, { hasGuestGeo: true, families: ["drinks"] }), null);
  assertEquals(placesSearchRank({ ...open, enriched: false }, { hasGuestGeo: true }), null);
  // No guest pin: proximity adds nothing, and every place is treated the same.
  const withGeo = placesSearchRank(open, { hasGuestGeo: true }) ?? 0;
  const noGeo = placesSearchRank(open, { hasGuestGeo: false }) ?? 0;
  assertEquals(f(withGeo - noGeo), f(proximitySignal(0.4)));
});

Deno.test("tile coins only move the two ends", () => {
  assertEquals(f(tileFlipProbability(0.08)), "0.47");
  assertEquals(f(tileFlipProbability(3.64)), "0.01");
  const ranked = [0, 1, 2, 3, 4, 5].map((index) => ({
    row: index,
    index,
    rank: 10 - index,
  }));
  // random() = 0 is under every positive probability, so both coins hit.
  const flipped = applyTileRandomness(ranked, () => 0).map((s) => s.row);
  assertEquals(flipped, [1, 0, 2, 3, 5, 4]);
  // random() = 1 is above every flip probability (max is 0.5), so nothing moves.
  const still = applyTileRandomness(ranked, () => 1).map((s) => s.row);
  assertEquals(still, [0, 1, 2, 3, 4, 5]);
});

Deno.test("rankPlacesSearch sorts by the sum, drops gates, then the coins", () => {
  const rows = [
    { id: "far", cosine: 0.9, km: 20, stars: 4, reviews: 10, enriched: true },
    { id: "close", cosine: 0.9, km: 0.2, stars: 4, reviews: 10, enriched: true },
    { id: "raw", cosine: 0.99, km: 0.1, stars: 5, reviews: 5000, enriched: false },
  ];
  const intent = { hasGuestGeo: true };
  const project = (row: (typeof rows)[number]): PlacesSearchFacts => row;
  assertEquals(
    rankPlacesSearch(rows, project, intent, () => 1).map((r) => r.id),
    ["close", "far"],
  );
});
