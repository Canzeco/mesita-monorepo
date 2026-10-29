// MVP test rule (MESITA-2600): only the EF contract guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/api/places";
import {
  poolPlaces,
  PLACES_PAGE,
  savedPlaceList,
  ALL_CHIP,
} from "@/components/consumer/home/CatalogRails";

// Pato (MESITA-2517): under Home's header, two tabs — Places (a chip row
// over full-width tiles) and Social (the feed). It was a category column
// beside the tiles (MESITA-2367 to MESITA-2516).
const src = readFileSync(
  join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
  "utf8",
);

const place = (id: string): Place => ({ id, name: id }) as Place;

describe("Home's tabs and the Places chips (MESITA-2517)", () => {
  it("Near and Popular are the server's pool in its order; a family filters it on area.familyKeys", () => {
    const area = (familyKeys: string[], final: number) => ({
      familyKeys,
      gates: {
        family: 1 as const,
        radius: 1 as const,
        active: 1 as const,
        ready: null,
        reviews: 1 as const,
      },
      signals: { proximity: 1, popularity: 0.5 },
      source: "mesita" as const,
      base: final,
      final,
      formula: "point" as const,
    });
    const pool = {
      kind: "point" as const,
      places: [
        { ...place("a"), area: area(["coffee"], 0.9) },
        { ...place("b"), area: area(["dinner"], 0.8) },
        // The card says breakfast; the gate read coffee — the server wins.
        {
          ...place("c"),
          family_keys: ["breakfast"],
          area: area(["coffee"], 0.7),
        },
      ],
    };
    expect(poolPlaces(pool, ALL_CHIP).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(poolPlaces(pool, "coffee").map((p) => p.id)).toEqual(["a", "c"]);
    expect(poolPlaces(pool, "breakfast")).toEqual([]);
  });

  it("pages from the server: a sentinel asks for the next page at pool.next (MESITA-3044)", () => {
    expect(PLACES_PAGE).toBe(20);
    expect(src).toContain("apiListAreaPool(supabase, from, families, nextOffset)");
    expect(src).toContain("data-places-more");
    expect(src).toContain("new IntersectionObserver(");
    // A kept pool paints without a request.
    expect(src).toContain("const kept = readAreaPool(requestKey);");
    expect(src).toContain("if (!kept) void fetchPool();");
  });

  it("each tile's events carry source, rank and final (the breakdown box is hidden, MESITA-2660)", () => {
    expect(src).not.toContain("<AreaDiagnostics");
    expect(src).toContain('trackEvent(supabase, "home_card_open"');
    expect(src).toContain("...tileFacts(place, rank)");
  });

  it("Favorites lists hearts newest first and skips one with no preview", () => {
    const previews = new Map([
      ["a", place("a")],
      ["b", place("b")],
    ]);
    expect(
      savedPlaceList(new Set(["a", "gone", "b"]), previews).map((p) => p.id),
    ).toEqual(["b", "a"]);
  });
});

describe("the location lives in Home's header (MESITA-2401)", () => {
  it("Places draws no location bar or sheet; it reads the shared active location", () => {
    expect(src).not.toContain("data-places-location-bar");
    expect(src).not.toContain("<LocalSheet");
    expect(src).toContain("const origin = useActiveLocation();");
    // A saved location, else the fix, else the city's centre (MESITA-2472).
    expect(src).toContain(
      "const base = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);",
    );
    expect(src).toContain("apiListAreaPool(supabase, from, families)");
  });

  it("removing the active saved location falls back to Current location", () => {
    // Remove lives in the pin picker's edit screen since MESITA-2501.
    const pin = readFileSync(
      join(__dirname, "../../components/consumer/home/PinPicker.tsx"),
      "utf8",
    );
    expect(pin).toContain(
      "if (activeKey === savedLocationKey(entry.id)) setActiveLocation(null);",
    );
  });
});
