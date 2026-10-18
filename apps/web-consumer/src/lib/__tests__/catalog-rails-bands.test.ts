import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import {
  FAVORITES_CHIP,
  poolPlaces,
  PLACES_PAGE,
  favoritePlaces,
  FEATURED_CHIP,
  GOOGLE_RAIL_KEY,
  MESITA_RAIL_KEY,
  placesChips,
} from "@/components/consumer/home/CatalogRails";

// Pato (MESITA-2367, MESITA-2383): Places is one location bar over a split —
// a column of Favorites · Featured · families beside ONE column of the chosen
// set. The server's rails are unchanged; a row picks which rail shows.
const src = readFileSync(
  join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
  "utf8",
);

const place = (id: string): Place => ({ id, name: id }) as Place;
const RAILS: CatalogRail[] = [
  { key: GOOGLE_RAIL_KEY, label: "Google Places", emoji: "📍", source: "signal", places: [place("g1")] },
  { key: MESITA_RAIL_KEY, label: "Mesita Selected", emoji: "✨", source: "signal", places: [place("m1")] },
  { key: "coffee", label: "Coffee", emoji: "☕", source: "family", places: [place("m1")] },
  { key: "breakfast", label: "Breakfast", emoji: "🥐", source: "family", places: [place("m2")] },
];

describe("the Places column (MESITA-2383)", () => {
  it("is Favorites, Featured, then every guest family — no source rows (MESITA-2384)", () => {
    const labels = placesChips().map((c) => c.label);
    expect(labels.slice(0, 2)).toEqual(["Favorites", "Featured"]);
    expect(labels).toContain("Coffee");
    expect(labels).toContain("Breakfast");
    expect(labels).not.toContain("Undefined");
    expect(placesChips().map((c) => c.key).slice(0, 2)).toEqual([FAVORITES_CHIP, FEATURED_CHIP]);
    expect(placesChips().map((c) => c.key)).not.toContain(GOOGLE_RAIL_KEY);
    expect(placesChips().map((c) => c.key)).not.toContain(MESITA_RAIL_KEY);
  });

  it("Featured is the server's pool in its order; a family filters it on area.familyKeys", () => {
    const area = (familyKeys: string[], final: number) => ({
      familyKeys,
      gates: { family: 1 as const, territory: null, radius: 1 as const, active: 1 as const, ready: null, reviews: 1 as const },
      signals: { proximity: 1, popularity: 0.5 },
      selected: 1,
      source: "selected" as const,
      base: final,
      final,
      formula: "point" as const,
    });
    const pool = {
      shape: "unified" as const,
      kind: "point" as const,
      places: [
        { ...place("a"), area: area(["coffee"], 0.9) },
        { ...place("b"), area: area(["dinner"], 0.8) },
        // The card says breakfast; the gate read coffee — the server wins.
        { ...place("c"), family_keys: ["breakfast"], area: area(["coffee"], 0.7) },
      ],
    };
    expect(poolPlaces(pool, FEATURED_CHIP).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(poolPlaces(pool, "coffee").map((p) => p.id)).toEqual(["a", "c"]);
    expect(poolPlaces(pool, "breakfast")).toEqual([]);
  });

  it("an Edge Function still on the legacy rails is drawn as before", () => {
    const legacy = { shape: "legacy" as const, rails: RAILS };
    expect(poolPlaces(legacy, FEATURED_CHIP).map((p) => p.id)).toEqual(["m1", "g1"]);
    expect(poolPlaces(legacy, "coffee").map((p) => p.id)).toEqual(["m1"]);
    expect(src).toContain("catalog_shape_legacy");
  });

  it("pages after ranking: 20 at a time, a sentinel asks for more, no request", () => {
    expect(PLACES_PAGE).toBe(20);
    expect(src).toContain("list.slice(0, pageCount * PLACES_PAGE)");
    expect(src).toContain("data-places-more");
    expect(src).toContain("new IntersectionObserver(");
    // A kept pool paints without a request.
    expect(src).toContain("const kept = readAreaPool(requestKey);");
    expect(src).toContain('if (!kept) void fetchPool("fresh");');
  });

  it("a family with nothing here says so", () => {
    expect(src).toContain("title={`Nothing in ${label} here yet`}");
  });

  it("each tile carries the temporary breakdown, and its events carry source, rank and final", () => {
    expect(src).toContain("<AreaDiagnostics area={place.area} />");
    expect(src).toContain('trackEvent(supabase, "home_card_open"');
    expect(src).toContain("...tileFacts(place, rank)");
  });

  it("Favorites lists saves newest first and skips a save with no preview", () => {
    const previews = new Map([
      ["a", place("a")],
      ["b", place("b")],
    ]);
    expect(favoritePlaces(new Set(["a", "gone", "b"]), previews).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("holds no location rows: the column is categories only", () => {
    const nav = src.slice(src.indexOf("const categories = ("), src.indexOf("const shell = ("));
    expect(nav).toContain('aria-label="Families"');
    expect(nav).not.toContain("savedLocations");
    expect(nav).not.toContain("data-places-add-location");
    expect(src).not.toContain("nearbyZones");
  });

  it("is a left column, a quarter wide (MESITA-2385), scrolling on its own, and opens on Featured", () => {
    expect(src).toContain("bg-muted scrollbar-hide w-1/4 shrink-0 overflow-y-auto");
    expect(src).toContain("useState<string>(FEATURED_CHIP)");
    // The chosen row: white, bold, an ink bar on its left edge.
    expect(src).toContain('const ROW_ON = "bg-card text-foreground font-semibold";');
    expect(src).toContain("bg-foreground absolute inset-y-0 left-0 w-[3px]");
  });
});

describe("the location bar and sheet (MESITA-2383)", () => {
  it("sits above the split, full width, gray, a line under it, no shadow", () => {
    const shell = src.slice(src.indexOf("const shell = ("), src.indexOf("const tiles = ("));
    expect(shell.indexOf("{locationBar}")).toBeLessThan(shell.indexOf("{categories}"));
    expect(src).toContain(
      'className="bg-muted border-foreground/15 text-foreground flex w-full shrink-0 items-center gap-2 border-b px-3 py-2.5 text-left text-sm font-semibold"',
    );
    const bar = src.slice(src.indexOf("const locationBar = ("), src.indexOf("const sheetRow = ("));
    expect(bar).not.toContain("shadow");
    expect(bar).toContain("<MapPin");
    expect(bar).toContain("<ChevronDown");
    expect(bar).toContain("onClick={() => setPicking(true)}");
  });

  it("opens a sheet: Current location, the saved locations, then Add location", () => {
    const sheet = src.slice(src.indexOf("const locationSheet = ("), src.indexOf("const categoryRow = ("));
    expect(sheet).toContain("<LocalSheet open={picking}");
    expect(sheet.indexOf('"Current location"')).toBeLessThan(sheet.indexOf("savedLocations.map((l)"));
    expect(sheet.indexOf("savedLocations.map((l)")).toBeLessThan(sheet.indexOf("data-places-add-location"));
    expect(sheet).toContain("setAdding(true)");
    expect(src).toContain("<AddLocationSheet");
  });

  it("removing the active saved location falls back to Current location", () => {
    expect(src).toContain("if (origin?.key === `saved:${l.id}`) setOrigin(null);");
  });

  it("searches from the picked location; a saved area sends its bounds", () => {
    expect(src).toContain("const from = origin ?? coords;");
    expect(src).toContain("apiListAreaPool(supabase, from)");
    expect(src).toContain("bounds: l.bounds");
  });
});

describe("the Places grid (MESITA-2366)", () => {
  it("is the right three quarters, one square tile per row with 6px room around, scrolling on its own", () => {
    expect(src).toContain('const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";');
    expect(src).toContain("w-3/4 flex-col overflow-y-auto");
    expect(src).not.toContain("writing-mode");
    expect(src).not.toContain("data-band");
  });

  it("draws a clear line between Home's header and the body (MESITA-2381)", () => {
    const tabs = readFileSync(join(__dirname, "../../components/consumer/ModeTabs.tsx"), "utf8");
    expect(tabs).toContain("border-foreground/20 bg-background/90 sticky top-0 z-20 shrink-0 border-b-2");
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
