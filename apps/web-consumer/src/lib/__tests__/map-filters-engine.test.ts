import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import {
  applyMapFilters,
  clampSearchPower,
  MAP_FILTER_DEFAULTS,
  mapFilterCount,
  mapFiltersAreActive,
  placeMapStatus,
  placeSearchLane,
  searchPowerCaption,
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

describe("placeSearchLane", () => {
  it("maps Partners / enriched Places / Google; Created and Requested are out", () => {
    expect(placeSearchLane(place({ partner: true }))).toBe("partners");
    expect(placeSearchLane(place({ promoting: true }))).toBe("partners");
    expect(placeSearchLane(place({ content_status: "ready" }))).toBe("places");
    expect(
      placeSearchLane(place({ enriched_at: "2026-08-01T00:00:00Z" })),
    ).toBe("places");
    expect(placeSearchLane(place({ googleOnly: true }))).toBe("google");
    expect(placeSearchLane(place({ from_google: true }))).toBe("google");
    expect(placeSearchLane(place())).toBeNull();
    expect(
      placeSearchLane(place({ request_count: 3, content_status: "queued" })),
    ).toBeNull();
  });
});

describe("search power", () => {
  it("captions the cumulative union and clamps missing values to + Places", () => {
    expect(searchPowerCaption(1)).toBe("Mesita Partners");
    expect(searchPowerCaption(2)).toBe("Mesita Partners & Mesita Places");
    expect(searchPowerCaption(3)).toBe(
      "Mesita Partners & Mesita Places & Google Places",
    );
    expect(clampSearchPower(99)).toBe(3);
    expect(clampSearchPower(0)).toBe(1);
    expect(clampSearchPower(undefined)).toBe(2);
  });
});

describe("applyMapFilters", () => {
  const partner = place({ id: "partner", partner: true });
  const enriched = place({ id: "enriched", content_status: "ready" });
  const created = place({ id: "created" });
  const requested = place({
    id: "requested",
    request_count: 2,
    content_status: "queued",
  });
  const google = place({ id: "google", googleOnly: true });
  const deck = [partner, enriched, created, requested, google];

  it("defaults to + Places and still drops Created, Requested, and Google", () => {
    expect(MAP_FILTER_DEFAULTS.searchPower).toBe(2);
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
    expect(applyMapFilters(deck, filters()).map((p) => p.id)).toEqual([
      "partner",
      "enriched",
    ]);
  });

  it("counts leaving + Places, or each Super Category, as one filter", () => {
    expect(mapFilterCount(filters({ searchPower: 1 }))).toBe(1);
    expect(mapFilterCount(filters({ searchPower: 3 }))).toBe(1);
    expect(
      mapFilterCount(filters({ searchPower: 2, familyKeys: ["restaurants"] })),
    ).toBe(1);
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("statuses");
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("categories");
  });

  it("nests Partners ⊂ + Places ⊂ + Google", () => {
    expect(
      applyMapFilters(deck, filters({ searchPower: 1 })).map((p) => p.id),
    ).toEqual(["partner"]);
    expect(
      applyMapFilters(deck, filters({ searchPower: 2 })).map((p) => p.id),
    ).toEqual(["partner", "enriched"]);
    expect(
      applyMapFilters(deck, filters({ searchPower: 3 })).map((p) => p.id),
    ).toEqual(["partner", "enriched", "google"]);
  });

  it("cuts on Super Category only — never a concrete type slug", () => {
    const bar = place({
      id: "bar",
      category: "night_club",
      family_keys: ["bars_nightlife"],
      content_status: "ready",
    });
    const taco = place({
      id: "taco",
      category: "mexican_restaurant",
      family_keys: ["restaurants"],
      content_status: "ready",
    });
    expect(
      applyMapFilters(
        [bar, taco],
        filters({ familyKeys: ["restaurants"] }),
      ).map((p) => p.id),
    ).toEqual(["taco"]);
  });

  it("each Mesita category matches exactly one Super Category", () => {
    const brunch = place({
      id: "brunch",
      category: "brunch",
      family_keys: ["restaurants"],
      content_status: "ready",
    });
    const karaoke = place({
      id: "karaoke",
      category: "karaoke",
      family_keys: ["bars_nightlife"],
      content_status: "ready",
    });
    const set = [brunch, karaoke];
    expect(
      applyMapFilters(set, filters({ familyKeys: ["restaurants"] })).map(
        (p) => p.id,
      ),
    ).toEqual(["brunch"]);
    expect(
      applyMapFilters(set, filters({ familyKeys: ["cafes_bakeries"] })).map(
        (p) => p.id,
      ),
    ).toEqual([]);
    expect(
      applyMapFilters(set, filters({ familyKeys: ["bars_nightlife"] })).map(
        (p) => p.id,
      ),
    ).toEqual(["karaoke"]);
    expect(
      applyMapFilters(set, filters({ familyKeys: ["experiences"] })).map(
        (p) => p.id,
      ),
    ).toEqual([]);
    expect(
      applyMapFilters(
        [
          place({
            id: "unk",
            category: "undefined",
            family_keys: ["undefined"],
            content_status: "ready",
          }),
        ],
        filters({ familyKeys: ["undefined"] }),
      ).map((p) => p.id),
    ).toEqual(["unk"]);
  });

  it("Google stubs match Super Category from family_keys", () => {
    const cafe = place({
      id: "g-cafe",
      googleOnly: true,
      name: "Random café",
      family_keys: ["cafes_bakeries"],
    });
    const hotel = place({
      id: "g-hotel",
      googleOnly: true,
      family_keys: [],
    });
    expect(
      applyMapFilters(
        [cafe, hotel],
        filters({ searchPower: 3, familyKeys: ["cafes_bakeries"] }),
      ).map((p) => p.id),
    ).toEqual(["g-cafe"]);
    expect(
      applyMapFilters(
        [cafe],
        filters({ searchPower: 3, familyKeys: ["restaurants"] }),
      ).map((p) => p.id),
    ).toEqual([]);
  });
});
