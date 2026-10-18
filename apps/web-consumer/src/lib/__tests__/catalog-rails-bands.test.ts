import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import {
  favoritePlaces,
  FAVORITES_CHIP,
  GOOGLE_RAIL_KEY,
  MESITA_RAIL_KEY,
  placesChips,
} from "@/components/consumer/home/CatalogRails";

// Pato (MESITA-2366, MESITA-2367): Places is a category column — Favorites · Mesita ·
// Google · Location, then the families — beside ONE column of the chosen
// set. The server's rails are unchanged; a chip picks which rail the grid shows.
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

describe("the Places chip row (MESITA-2366)", () => {
  it("leads Favorites · Mesita · Google, then every family in server order", () => {
    expect(placesChips(RAILS).map((c) => c.label)).toEqual([
      "Favorites",
      "Mesita",
      "Google",
      "Coffee",
      "Breakfast",
    ]);
    expect(placesChips(RAILS)[3].emoji).toBe("☕");
  });

  it("puts the Location control after Google, before the families", () => {
    expect(src).toContain("chips.slice(0, 3).map");
    expect(src.indexOf('"Location"')).toBeGreaterThan(src.indexOf("chips.slice(0, 3).map"));
    expect(src.indexOf('"Location"')).toBeLessThan(src.indexOf("chips.slice(3).map"));
  });

  it("is a left column, one third wide, scrolling on its own, and opens on Mesita (MESITA-2367)", () => {
    expect(src).toContain("bg-muted scrollbar-hide w-1/3 shrink-0 overflow-y-auto");
    expect(src).toContain("useState<string>(MESITA_RAIL_KEY)");
    // The chosen row: white, bold, an ink bar on its left edge.
    expect(src).toContain('const ROW_ON = "bg-card text-foreground font-semibold";');
    expect(src).toContain("bg-foreground absolute inset-y-0 left-0 w-[3px]");
  });
});

describe("the Places grid (MESITA-2366)", () => {
  it("is the right two thirds, one square tile per row, scrolling on its own (MESITA-2367)", () => {
    expect(src).toContain('const PLACES_LIST = "grid grid-cols-1 content-start gap-0.5";');
    expect(src).toContain("w-2/3 flex-col overflow-y-auto");
    expect(src).not.toContain("writing-mode");
    expect(src).not.toContain("data-band");
  });

  it("Favorites resolves saves against the live rails first, then the previews", () => {
    const previews = new Map([["old", place("old")], ["m1", { ...place("m1"), name: "stale" }]]);
    const out = favoritePlaces(new Set(["m1", "old", "gone"]), RAILS, previews);
    expect(out.map((p) => p.id)).toEqual(["m1", "old"]);
    expect(out[0].name).toBe("m1");
    expect(FAVORITES_CHIP).toBe("favorites");
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
