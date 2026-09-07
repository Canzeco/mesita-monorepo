// Feed's shape is the instruction, not an implementation detail (Pato,
// MESITA-1621: "add places as if they were a feed, 2 wide, occupying almost
// 100% of screen"). Three numbers carry that — two columns, a 2-unit gutter,
// a 2-unit page padding — and all three are Tailwind classes, which means tsc
// cannot see them, the build cannot see them, and a tidy-up that "aligns Feed
// with Favorites" (px-4, gap-2.5, `min-[360px]:grid-cols-2`) would pass every
// other gate while quietly making the grid narrower and single-column on the
// smallest phones.
//
// Source-read rather than rendered, the same way favorites-saves-only and
// ticket-state-drift read theirs: PlaceFeed's first paint is the skeleton
// (`hydrated` is false until localStorage is read), so a static render would
// assert against the loading state, not the grid.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(__dirname, "..", "..", rel), "utf8");
}

describe("Feed is two columns, edge to edge", () => {
  const feed = read("components/consumer/home/PlaceFeed.tsx");

  // UNCONDITIONALLY TWO. Favorites uses `grid-cols-1 min-[360px]:grid-cols-2`
  // — one column below 360px — which is the right call for a bookmark list
  // and the wrong one here: "2 wide" was the instruction, and a 320px phone
  // dropping to a single column is exactly the case that would go unnoticed.
  it("pins grid-cols-2 with no single-column breakpoint", () => {
    expect(feed).toContain("grid grid-cols-2 gap-2");
    expect(feed).not.toContain("grid-cols-1");
    expect(feed).not.toContain("min-[360px]:grid-cols-2");
  });

  // px-2 (8px a side) + gap-2 (8px between) = 359 of a 375px frame, ~96%.
  // Favorites' px-4/gap-2.5 would be 90% and a visibly smaller tile. px-0
  // would be 100% and is NOT what this asks for — a 2xl radius flush against
  // the frame reads as a clipped render.
  it("keeps the tight gutter that makes it near-full-width", () => {
    expect(feed).toContain("px-2 pt-2 pb-6");
    expect(feed).not.toContain("px-4 pt-4 pb-6");
  });

  // The skeleton has to match the grid it replaces, or the tiles jump one
  // gutter width when the hearts hydrate.
  it("paints its skeleton on the same grid", () => {
    const skeletons = feed.match(/grid grid-cols-2 gap-2/g) ?? [];
    expect(skeletons).toHaveLength(2);
  });

  // Feed is a fourth surface showing place tiles (Catalog's rails, Favorites'
  // grid, Pay's list). A Feed-only card would drift from the other three on
  // its own schedule — the heart's hit area, the opening dot, the promo chip.
  it("reuses FavoriteTile rather than minting a card", () => {
    expect(feed).toContain('from "./FavoriteTile"');
    expect(feed).toContain("<FavoriteTile");
  });

  // Feed reads the SHARED deck. Fetching its own would re-run the recommender
  // on every mode switch and could show a different order than Swipe deals
  // from — the two modes are the same deck, seen two ways.
  it("takes the deck as a prop instead of fetching its own", () => {
    const page = read("app/(shell)/discover/feed/page.tsx");
    expect(page).toContain("useHomeDeck()");
    expect(feed).not.toContain("apiListCatalog");
    expect(feed).not.toContain("useBrowserSupabase");
  });
});

// The mock is a scaffold with a removal date (Pato, MESITA-1621: "use mock
// data for the moment"). Two properties keep it from quietly becoming the
// product: real rows always win, and the guest is told when they are looking
// at invented ones. Both are one-line edits away from being lost.
describe("Feed's mock places are a fallback, and say so", () => {
  const feed = read("components/consumer/home/PlaceFeed.tsx");
  const mock = read("lib/mock/feed-places.ts");

  // `places.length === 0` is the whole gate. Anything else — a flag, an env
  // check, an unconditional mock — either shows invented places over real
  // ones or strands the feed empty again once the catalog fills.
  it("falls back only when the real deck is empty", () => {
    expect(feed).toContain("const usingMock = places.length === 0;");
    expect(feed).toContain(
      "const rows = usingMock ? FEED_MOCK_PLACES : places;",
    );
  });

  // All-real or all-mock. A concatenation here would render a grid where the
  // notice strip is true of some tiles and false of others.
  it("never mixes real rows with mock rows", () => {
    expect(feed).not.toContain("...FEED_MOCK_PLACES");
    expect(feed).not.toContain("places.concat");
  });

  // Unlabelled mock data is the failure that outlives the mock: someone
  // reviews Feed, sees eight places, and reports the catalog as populated.
  it("labels the mock on screen whenever it is showing", () => {
    expect(feed).toContain("{usingMock && (");
    expect(feed).toContain("Sample places while the catalog fills up.");
  });

  // A fetch failure still reaches the guest — it changes the strip's wording
  // rather than being swallowed by the fallback.
  it("still says so when the deck FAILED rather than came back empty", () => {
    expect(feed).toContain("Tonight's places didn't load");
  });

  // The marker future greps will find. Every other parked dataset in this app
  // carries one (social-feed-data.ts, credits-mock.ts).
  it("carries the TODO(EF) marker parked datasets are found by", () => {
    expect(mock).toContain("TODO(EF): Feed");
  });
});
