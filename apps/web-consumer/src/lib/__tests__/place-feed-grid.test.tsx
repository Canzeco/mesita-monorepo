// The place-grid geometry: two columns, a 2-unit gutter, a 2-unit page
// padding. All three are Tailwind classes, which means tsc cannot see them and
// the build cannot see them.
//
// THIS FILE USED TO PIN A SHARING RELATIONSHIP, AND THAT PREMISE IS GONE.
// It was written because Feed and Favs agreed on the tile and disagreed on the
// frame around it: Favs shipped px-4 / gap-2.5 / `grid-cols-1
// min-[360px]:grid-cols-2` while Feed shipped px-2 / gap-2 / two columns
// unconditionally, so the same card was ~9px narrower one pill over and
// collapsed to a single column below 360px. Asserting literals per file is
// what let that happen — both files passed their own test.
//
// MESITA-1697 DELETED THE FEED GRID. Feed is Catalog's rails now, so Favs is
// the only surface left on these constants and the two-surface drift this file
// was built to catch can no longer occur. It is kept, repointed at Favs alone,
// as a plain regression guard: the constants are still invisible to tsc, and a
// future second caller should find a test already here rather than rediscover
// the drift. Do not read the assertions below as evidence that two surfaces
// still share this grid — one does.
//
// Source-read rather than rendered, the same way favorites-saves-only and
// ticket-state-drift read theirs: both surfaces paint a skeleton first
// (`hydrated` is false until localStorage is read), so a static render would
// assert against the loading state, not the grid.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLACE_GRID_CLASS,
  PLACE_GRID_PAGE_CLASS,
  PLACE_TILE_SKELETON_CLASS,
} from "@/lib/ui-classes";

function read(rel: string): string {
  return readFileSync(join(__dirname, "..", "..", rel), "utf8");
}

// ONE surface since MESITA-1697. The array shape stays so the day a second
// grid lands, adding it here is a one-line edit rather than a rewrite.
const SURFACES = [
  ["Favs", "components/consumer/home/FavoritesList.tsx"],
] as const;

describe("one place-grid geometry, shared", () => {
  // The values themselves, asserted once. px-2 + gap-2 puts the grid at 359 of
  // a 375px frame (~96%) with tiles at ~176px — the near-full-bleed
  // measurement Feed was asked for. `grid-cols-2` carries no breakpoint: a
  // 320px phone must still show two.
  it("pins the constants", () => {
    expect(PLACE_GRID_CLASS).toBe("grid grid-cols-2 gap-2");
    expect(PLACE_GRID_PAGE_CLASS).toBe("px-2 pt-2 pb-6");
    expect(PLACE_GRID_CLASS).not.toContain("min-[");
    expect(PLACE_GRID_CLASS).not.toContain("grid-cols-1");
    // 2:3 = the two stacked 4:3 boxes the real tile is built from. The
    // skeleton approximates the card; the card is never built from this.
    expect(PLACE_TILE_SKELETON_CLASS).toContain("aspect-[2/3]");
  });

  it.each(SURFACES)("%s reads the constants, not literals", (_label, rel) => {
    const src = read(rel);
    // The import may be one line or several — check the symbols and the
    // module, not the formatting Prettier happens to choose today.
    expect(src).toContain('from "@/lib/ui-classes"');
    expect(src).toContain("className={PLACE_GRID_CLASS}");
    expect(src).toContain("PLACE_GRID_PAGE_CLASS");
    expect(src).toContain("PLACE_TILE_SKELETON_CLASS");
  });

  // A surface that spells the geometry out again has forked it, whatever the
  // constant next to it says. This is the assertion that would have caught the
  // original drift.
  it.each(SURFACES)("%s spells no grid geometry of its own", (_label, rel) => {
    const src = read(rel);
    // Strip comments: both files EXPLAIN the old classes in prose, and a bare
    // substring match would false-fail against that explanation.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/grid-cols-\d/);
    expect(code).not.toContain("min-[360px]:");
    expect(code).not.toContain("gap-2.5");
    expect(code).not.toContain("px-4 pt-4 pb-6");
  });

  // The skeleton has to sit on the same grid it replaces, or the tiles jump
  // one gutter width when the real rows arrive.
  it.each(SURFACES)("%s paints its skeleton on that grid too", (_label, rel) => {
    const uses = read(rel).match(/className=\{PLACE_GRID_CLASS\}/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
  });

  // …and on the tile's ratio, or the grid reflows the moment the rows land,
  // which reads as a broken render rather than a load.
  it.each(SURFACES)("%s sizes its skeleton like a real tile", (_label, rel) => {
    expect(read(rel)).toContain("className={PLACE_TILE_SKELETON_CLASS}");
  });

  // Three surfaces show place tiles (Feed's rails, Favs' grid, Pay's list).
  // A surface-only card would drift from the others on its own schedule —
  // the heart's hit area, the opening dot, the promo chip.
  it.each(SURFACES)("%s reuses FavoriteTile rather than minting a card", (
    _label,
    rel,
  ) => {
    const src = read(rel);
    expect(src).toContain('from "./FavoriteTile"');
    expect(src).toContain("<FavoriteTile");
  });

  // Feed's rails are deliberately NOT a caller — horizontal rails under
  // category headings answer a different question from a vertical grid, even
  // now that Feed is the tab wrapping them. If they ever adopt the constants
  // this line is the deliberate edit that says so.
  it("leaves Feed's rails alone", () => {
    const rails = read("components/consumer/home/CatalogRails.tsx");
    expect(rails).not.toContain("PLACE_GRID_CLASS");
    expect(rails).toContain("overflow-x-auto");
  });
});

// Scroll reads the SHARED deck; Favs resolves saves against it. Scroll adds
// ONE fetch of its own and that is deliberate — HomeDeckBoundary sends no
// coordinates, so without it Proximity would contribute nothing to Home.
describe("Scroll rides the shared deck", () => {
  const scroll = read("components/consumer/home/scroll/ScrollDeck.tsx");

  it("takes the deck as a prop", () => {
    const page = read("app/(shell)/discover/scroll/page.tsx");
    expect(page).toContain("useHomeDeck()");
    expect(scroll).not.toContain("apiListCatalog");
  });

  it("re-fetches when coordinates or filters would change the server's answer", () => {
    expect(scroll).toContain("apiRecommendDeck");
    expect(scroll).toContain("toDeckRequest");
  });
});

// NO MOCK DATA ANYWHERE IN DISCOVERY (Pato, live, 2026-09-08: "don't put
// shitty mock data"). `lib/mock/feed-places.ts` is deleted, not parked — it
// was the last caller's only consumer, and a plausible-looking place you
// cannot visit teaches a reviewer nothing while quietly becoming the thing
// everyone demos.
//
// Scroll fills its 50-card deck by CYCLING the real rows instead. With one
// place in the catalog that is the same place fifty times, which is honest by
// construction: every card is tappable, savable, and can start a real visit.
describe("Discovery invents no places", () => {
  const scroll = read("components/consumer/home/scroll/ScrollDeck.tsx");
  const favs = read("components/consumer/home/FavoritesList.tsx");

  it.each([
    ["Scroll", "components/consumer/home/scroll/ScrollDeck.tsx"],
    ["Favs", "components/consumer/home/FavoritesList.tsx"],
  ])("%s ships no mock deck", (_label, rel) => {
    const src = read(rel);
    expect(src).not.toContain("FEED_MOCK_PLACES");
    expect(src).not.toContain("mock/feed-places");
  });

  // The deck is a fixed 50 cycled from whatever is real — never padded with
  // invented rows, and never left at length 1 where the gesture cannot happen.
  it("Scroll cycles the real rows to a full deck", () => {
    expect(scroll).toContain("const DECK_SIZE = 50;");
    expect(scroll).toContain("rows[i % rows.length]");
  });

  // An empty saved list is a real, meaningful state — you have saved nothing.
  it("Favs keeps its real empty state", () => {
    expect(favs).toContain("Nothing saved yet");
  });
});

// "cards must be 4/3 + 4/3, to display lots of info" (Pato, MESITA-1624).
// The card's shape IS the instruction, and it is two Tailwind classes deep in
// one component — nothing else in the app would notice them changing.
describe("the place tile is a 4:3 photo over a 4:3 body", () => {
  const tile = read("components/consumer/home/FavoriteTile.tsx");
  const code = tile
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  // TWO boxes, both 4:3 — and the old whole-card 3:4 gone, not merely
  // outnumbered. That ratio was a deliberate 2026-08-10 call this change
  // overturns on instruction, so its absence is the thing worth asserting.
  it("carries exactly two 4:3 boxes and no whole-card ratio", () => {
    expect(code.match(/aspect-\[4\/3\]/g) ?? []).toHaveLength(2);
    expect(code).not.toContain("aspect-[3/4]");
  });

  // The photo is FIXED; the body is a floor that grows. Reversed — a
  // `shrink-0` body under a flexing photo — large accessibility text would
  // crop a row instead of lengthening the card.
  it("fixes the photo and lets the body grow", () => {
    expect(code).toContain('className="bg-muted relative aspect-[4/3] w-full shrink-0');
    expect(code).toContain('className="flex aspect-[4/3] min-w-0 flex-col justify-between');
  });

  // The height was bought to carry facts. A body that gained the space and
  // not the rows is the failure this change would silently become.
  it("spends the body on rating, price and category", () => {
    expect(tile).toContain("formatRating(place.google_rating)");
    expect(tile).toContain("formatPlacePriceLevelSymbols(place.price_level)");
    expect(tile).toContain("place.category_label ?? place.category");
    expect(tile).toContain("{reviewCount}");
  });

  // Nothing is invented for a sparse row: every added fact is null-guarded,
  // the same rule enrichPlaceOverview follows.
  it("hides each added fact rather than printing an empty cell", () => {
    expect(tile).toContain("{ratingLabel && (");
    expect(tile).toContain("{typeLine && (");
    expect(tile).toContain("{subtitle && (");
  });
});
