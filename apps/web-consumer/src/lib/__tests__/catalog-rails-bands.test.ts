import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import {
  allPlaces,
  FAVORITES_CHIP,
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
  it("is Favorites, Featured, then every family in server order — no source rows", () => {
    expect(placesChips(RAILS).map((c) => c.label)).toEqual([
      "Favorites",
      "Featured",
      "Coffee",
      "Breakfast",
    ]);
    expect(placesChips(RAILS).map((c) => c.key).slice(0, 2)).toEqual([FAVORITES_CHIP, FEATURED_CHIP]);
    expect(placesChips(RAILS).map((c) => c.key)).not.toContain(GOOGLE_RAIL_KEY);
    expect(placesChips(RAILS).map((c) => c.key)).not.toContain(MESITA_RAIL_KEY);
  });

  it("Featured mixes Mesita Selected first, then Google places, each once", () => {
    expect(allPlaces(RAILS).map((p) => p.id)).toEqual(["m1", "g1"]);
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

  it("searches from the picked location", () => {
    expect(src).toContain("const from = origin ?? coords;");
    expect(src).toContain("apiListCatalog(supabase, from)");
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
