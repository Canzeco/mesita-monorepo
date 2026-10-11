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
// Source-read rather than rendered: the surface paints a skeleton first
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

  // Favs' grid shows place tiles. A surface-only
  // card would drift from the other on its own schedule — the heart's hit
  // area, the opening dot.
  it.each(SURFACES)("%s reuses FavoriteTile rather than minting a card", (
    _label,
    rel,
  ) => {
    const src = read(rel);
    expect(src).toContain('from "./FavoriteTile"');
    expect(src).toContain("<FavoriteTile");
  });
});

// Scroll reads the SHARED deck; Favs resolves saves against it. Scroll adds
// ONE fetch of its own and that is deliberate — HomeDeckBoundary sends no
// coordinates, so without it Proximity would contribute nothing to Home.
describe("Scroll rides the shared deck", () => {
  const scroll = read("components/consumer/home/scroll/ScrollDeck.tsx");

  it("takes the deck as a prop", () => {
    const page = read("app/(shell)/(discovery)/discover/scroll/page.tsx");
    expect(page).toContain("useHomeDeck()");
    expect(scroll).not.toContain("apiListCatalog");
  });

  it("re-fetches when coordinates or filters would change the server's answer", () => {
    expect(scroll).toContain("apiRecommendDeck");
    expect(scroll).toContain("toDeckRequest");
  });

  // MESITA-2047: the one real place sat behind "No places yet" all Tuesday.
  // The engine now backfills closed and far places, and the client must not
  // undo either half of that.
  it("an empty located answer never blanks the shared deck when no filter is set", () => {
    expect(scroll).toContain(
      "geoDeck && (geoDeck.length > 0 || hasDiscoveryPredicates(filters))",
    );
    expect(scroll).not.toContain("geoDeck ?? places");
  });

  it("keeps the engine's banded order — the client never re-sorts the deck", () => {
    // A client float here lifts a CLOSED backfill card above open ones. The
    // engine ranks; both the deck and the boundary that fetches it hand the
    // rows on in the order they arrived. Comments are stripped first, so a
    // note explaining this rule cannot trip it — only a real call can.
    const code = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const boundary = read("components/consumer/home/HomeDeckBoundary.tsx");
    expect(boundary).toContain("await apiRecommendDeck(supabase");
    for (const [name, src] of [
      ["ScrollDeck.tsx", scroll],
      ["HomeDeckBoundary.tsx", boundary],
    ] as const) {
      expect(code(src), name).not.toMatch(/\.(sort|toSorted|reverse|toReversed)\(/);
    }
  });

  it("records the located key when its answer lands, not when it is asked", () => {
    // Recording at request time dropped the located deck whenever the effect
    // re-ran on the same key mid-flight.
    expect(scroll).toContain("settledKeyRef.current = requestKey;");
    expect(scroll).not.toContain("requestKeyRef");
  });
});

// ONE MOCK, ONE SWITCH, SCROLL ONLY (MESITA-2105). From 2026-09-08 Discovery
// invented nothing (Pato: "don't put shitty mock data") and Scroll cycled the
// real rows. On 2026-10-10 Pato reversed that for Scroll alone: "for the
// moment use mock data written in the frontend". The design review bounded the
// reversal, and these pins hold the bounds — Scroll's only mock is the shared
// scroll-places file behind SCROLL_USES_MOCK, it replaces the WHOLE source
// rather than padding the real one, it never asks the server while on, and
// Home and Favs still invent nothing. MESITA-2095 flips the switch off and
// restores the old absolute pin.
describe("Discovery invents no places", () => {
  const scroll = read("components/consumer/home/scroll/ScrollDeck.tsx");
  const favs = read("components/consumer/home/FavoritesList.tsx");

  it.each([
    ["Favs", "components/consumer/home/FavoritesList.tsx"],
  ])("%s ships no mock deck", (_label, rel) => {
    const src = read(rel);
    expect(src).not.toContain("mock/scroll-places");
  });

  it("Scroll's only mock is the shared file, behind the switch", () => {
    const mockImports = scroll.match(/from "@\/lib\/mock\/[^"]+"/g) ?? [];
    expect(mockImports.sort()).toEqual([
      'from "@/lib/mock/enrich-overview"',
      'from "@/lib/mock/scroll-places"',
    ]);
    // The switch replaces the whole source; fake and real never share a feed.
    expect(scroll).toContain(
      "const source = SCROLL_USES_MOCK ? scrollMockPlaces() : (located ?? places);",
    );
  });

  it("the located re-fetch never runs while the mock is on", () => {
    const effect = scroll.slice(scroll.indexOf("useEffect(() => {"));
    const firstStatement = effect
      .split("\n")
      .slice(1)
      .find((line) => line.trim() && !line.trim().startsWith("//"));
    expect(firstStatement?.trim()).toBe("if (SCROLL_USES_MOCK) return;");
  });

  // The deck is a fixed 50, cycled from its one source (the mock, or the real
  // rows once MESITA-2095 flips the switch) — never left at length 1 where the
  // gesture cannot happen.
  it("Scroll cycles its rows to a full deck", () => {
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
