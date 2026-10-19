// The Places grid: categories left, ONE column of square tiles right
// (MESITA-2367). Favorites moved into that column (MESITA-2383), so the old
// two-column saved grid and its FavoriteTile are gone, with the constants
// that kept the two grids in step.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(__dirname, "..", "..", rel), "utf8");
}

// Places is a split (MESITA-2367): categories left, ONE column of square
// tiles right, 2px gaps. Favorites is a row of the same column (MESITA-2383).
describe("Places is one grid", () => {
  it("lays the chosen set out one square tile per row (MESITA-2367)", () => {
    const rails = read("components/consumer/home/CatalogRails.tsx");
    const tile = read("components/consumer/home/CatalogTile.tsx");
    expect(rails).toContain("placesFeed");
    expect(rails).toContain('const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";');
    expect(rails).not.toContain("cardWidth");
    expect(rails).not.toContain("FavoriteTile");
    expect(rails).not.toContain("ArrowUpDown");
    expect(rails).not.toContain('type="range"');
    // The tile: a square, no border, clearly rounded (Pato, MESITA-2409
    // "just a bit", MESITA-2413 "a bit more", MESITA-2423 "make the borders
    // rounded").
    expect(tile).toContain("relative isolate aspect-square min-w-0 overflow-hidden rounded-2xl");
    // A backdrop-blur layer escapes its parent's rounded clip: the photo, the
    // band and the blur layer round themselves (MESITA-2429).
    expect(tile).toContain("h-[60%] overflow-hidden rounded-t-2xl");
    expect(tile).toContain("h-[40%] overflow-hidden rounded-b-2xl");
    expect(tile).toContain("bg-paper/80 absolute inset-0 rounded-b-2xl backdrop-blur-sm");
    expect(tile).not.toMatch(/rounded-(sm|md|lg|xl|3xl)\b/);
    expect(tile).not.toContain("border-border");
    expect(tile).toContain("formatRating");
    expect(tile).not.toContain("place.zone");
    expect(tile).not.toContain("aspect-[1/2]");
    expect(tile).not.toContain("aspect-[2/3]");
  });
});

// NO MOCK DATA ANYWHERE IN DISCOVERY (Pato, live, 2026-09-08: "don't put
// shitty mock data"). `lib/mock/feed-places.ts` is deleted, not parked — it
// was the last caller's only consumer, and a plausible-looking place you
// cannot visit teaches a reviewer nothing while quietly becoming the thing
// everyone demos. MESITA-2105 brought a sample deck back for one day;
// MESITA-2095 deleted it with `lib/mock/` once Pato began creating real
// places, and this pin is absolute again. Social has no data and says so
// rather than painting sample people.
describe("Discovery invents no places", () => {
  const rails = read("components/consumer/home/CatalogRails.tsx");

  it.each([
    ["Places", "components/consumer/home/CatalogRails.tsx"],
    ["the place lookup", "lib/api/places.ts"],
  ])("%s ships no mock deck", (_label, rel) => {
    const src = read(rel);
    expect(src).not.toContain("FEED_MOCK_PLACES");
    expect(src).not.toContain("mock/feed-places");
    expect(src).not.toContain("lib/mock/");
    expect(src).not.toMatch(/SCROLL_USES_MOCK|scrollMockPlaces|isMockPlace|mockPlaceDetail/);
    expect(src).not.toMatch(/["'`]mock-/);
  });

  // An empty saved list is a real, meaningful state — you have saved nothing.
  it("Favorites keeps its real empty state (MESITA-2383)", () => {
    expect(rails).toContain("Nothing saved yet");
  });
});
