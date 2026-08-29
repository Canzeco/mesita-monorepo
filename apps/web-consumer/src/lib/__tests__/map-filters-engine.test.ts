import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import {
  applyMapFilters,
  MAP_FILTER_DEFAULTS,
  mapFilterCount,
  mapFiltersAreActive,
  placeMapStatus,
  type MapFilters,
} from "@/lib/map-filters-engine";

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    listing_type: "web",
    ...over,
  } as Place;
}

function filters(over: Partial<MapFilters> = {}): MapFilters {
  return { ...MAP_FILTER_DEFAULTS, ...over };
}

describe("placeMapStatus", () => {
  it("ladders Google → promoted → partnered → enriched → requested → created", () => {
    expect(placeMapStatus(place({ googleOnly: true }))).toBe("not_on_mesita");
    expect(placeMapStatus(place({ from_google: true }))).toBe("not_on_mesita");
    expect(placeMapStatus(place({ promoting: true, partner: true }))).toBe(
      "promoted",
    );
    expect(placeMapStatus(place({ partner: true }))).toBe("partnered");
    expect(placeMapStatus(place({ content_status: "ready" }))).toBe("enriched");
    expect(placeMapStatus(place({ enriched_at: "2026-08-01T00:00:00Z" }))).toBe(
      "enriched",
    );
    expect(
      placeMapStatus(place({ request_count: 2, content_status: "queued" })),
    ).toBe("requested");
    expect(
      placeMapStatus(place({ request_count: 4, content_status: "ready" })),
    ).toBe("enriched");
    expect(placeMapStatus(place())).toBe("created");
  });
});

describe("applyMapFilters", () => {
  it("is a pass-through when nothing is selected", () => {
    const deck = [place({ id: "a" }), place({ id: "b" })];
    expect(applyMapFilters(deck, filters())).toBe(deck);
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
  });

  it("counts every selected status and Super Category", () => {
    expect(
      mapFilterCount(
        filters({
          statuses: ["created", "enriched"],
          familyKeys: ["restaurants"],
        }),
      ),
    ).toBe(3);
  });

  it("keeps the selected status buckets", () => {
    const google = place({ id: "g", googleOnly: true });
    const created = place({ id: "c" });
    const promoted = place({ id: "p", promoting: true });
    const kept = applyMapFilters(
      [google, created, promoted],
      filters({ statuses: ["not_on_mesita", "promoted"] }),
    );
    expect(kept.map((p) => p.id)).toEqual(["g", "p"]);
  });

  it("cuts on Super Category only — never a concrete type slug", () => {
    const bar = place({
      id: "bar",
      category: "night_club",
      family_keys: ["bars_nightlife"],
    });
    const taco = place({
      id: "taco",
      category: "mexican_restaurant",
      family_keys: ["restaurants"],
    });
    expect(
      applyMapFilters(
        [bar, taco],
        filters({ familyKeys: ["restaurants"] }),
      ).map((p) => p.id),
    ).toEqual(["taco"]);
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("categories");
  });

  it("a category in two Super Categories matches either pill", () => {
    const brunch = place({
      id: "brunch",
      category: "brunch",
      family_keys: ["restaurants", "cafes_bakeries"],
    });
    const karaoke = place({
      id: "karaoke",
      category: "karaoke",
      family_keys: ["bars_nightlife", "experiences"],
    });
    const deck = [brunch, karaoke];
    expect(
      applyMapFilters(deck, filters({ familyKeys: ["restaurants"] })).map(
        (p) => p.id,
      ),
    ).toEqual(["brunch"]);
    expect(
      applyMapFilters(deck, filters({ familyKeys: ["cafes_bakeries"] })).map(
        (p) => p.id,
      ),
    ).toEqual(["brunch"]);
    expect(
      applyMapFilters(deck, filters({ familyKeys: ["bars_nightlife"] })).map(
        (p) => p.id,
      ),
    ).toEqual(["karaoke"]);
    expect(
      applyMapFilters(deck, filters({ familyKeys: ["experiences"] })).map(
        (p) => p.id,
      ),
    ).toEqual(["karaoke"]);
  });
});
