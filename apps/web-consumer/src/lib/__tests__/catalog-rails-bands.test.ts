import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import {
  nearbyZones,
  GOOGLE_RAIL_KEY,
  MESITA_RAIL_KEY,
  placesChips,
} from "@/components/consumer/home/CatalogRails";

// Pato (MESITA-2366, MESITA-2367, MESITA-2368): Places is a category column — Mesita ·
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
  it("leads Google Places · Mesita Featured, then every family in server order (MESITA-2368)", () => {
    expect(placesChips(RAILS).map((c) => c.label)).toEqual([
      "Google Places",
      "Mesita Featured",
      "Coffee",
      "Breakfast",
    ]);
    expect(placesChips(RAILS).map((c) => c.emoji)).toEqual(["📍", "⭐", "☕", "🥐"]);
  });

  it("puts WHERE above WHAT: a location group, a hairline, then the categories (MESITA-2378)", () => {
    expect(src).toContain('aria-label="Location" data-places-location');
    expect(src).toContain('aria-label="Category"');
    expect(src.indexOf("data-places-location")).toBeLessThan(src.indexOf('aria-label="Category"'));
    expect(src).toContain('"Current location"');
    expect(src).toContain('"Use my location"');
    // Picking a zone searches from its centre.
    expect(src).toContain("const from = origin ?? coords;");
    expect(src).toContain("apiListCatalog(supabase, from)");
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
  it("is the right two thirds, one square tile per row with 6px room around, scrolling on its own (MESITA-2367, MESITA-2370)", () => {
    expect(src).toContain('const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";');
    expect(src).toContain("w-2/3 flex-col overflow-y-auto");
    expect(src).not.toContain("writing-mode");
    expect(src).not.toContain("data-band");
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});

describe("the three nearby zones (MESITA-2378)", () => {
  const at = (id: string, zone: string | null, lat: number, lng: number): Place =>
    ({ id, name: id, zone, lat, lng }) as Place;
  const rails: CatalogRail[] = [
    {
      key: MESITA_RAIL_KEY,
      label: "Mesita Selected",
      source: "signal",
      places: [
        at("a", "Tecnologico", 25.65, -100.29),
        at("b", "Tecnologico", 25.66, -100.29),
        at("c", "Del Valle", 25.65, -100.36),
        at("d", "Centro", 25.67, -100.31),
        at("e", "Cumbres", 25.73, -100.4),
        at("f", null, 25.7, -100.3),
      ],
    },
    // The same place on a family rail counts once.
    { key: "coffee", label: "Coffee", source: "family", places: [at("a", "Tecnologico", 25.65, -100.29)] },
  ];

  it("takes the three nearest to the guest, each centred on its places", () => {
    const zones = nearbyZones(rails, { lat: 25.651, lng: -100.29 });
    expect(zones.map((z) => z.name)).toEqual(["Tecnologico", "Centro", "Del Valle"]);
    expect(zones[0].count).toBe(2);
    expect(zones[0].lat).toBeCloseTo(25.655, 3);
  });

  it("without a location, takes the busiest, then by name", () => {
    expect(nearbyZones(rails, null).map((z) => z.name)).toEqual([
      "Tecnologico",
      "Centro",
      "Cumbres",
    ]);
  });

  it("is empty when no place carries a zone", () => {
    expect(nearbyZones([{ ...rails[0], places: [at("x", null, 1, 1)] }], null)).toEqual([]);
  });
});
