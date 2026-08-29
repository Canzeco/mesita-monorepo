import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  applyMapFilters,
  clampResultLimit,
  clampSearchPower,
  MAP_FILTER_DEFAULTS,
  MAP_RESULT_LIMITS,
  mapFilterCount,
  mapFiltersAreActive,
  placeMapStatus,
  placeSearchLane,
  searchPowerCaption,
  takeMapResultLimit,
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
    expect(placeSearchLane(place({ partner: true }))).toBe("places");
    expect(placeSearchLane(place({ promoting: true }))).toBe("places");
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
    expect(searchPowerCaption(1)).toBe("Mesita Places");
    expect(searchPowerCaption(2)).toBe("Mesita Places & Google Places");
    // Legacy persisted 3 (the old Google stop) folds to 2.
    expect(clampSearchPower(99)).toBe(2);
    expect(clampSearchPower(3)).toBe(2);
    expect(clampSearchPower(0)).toBe(1);
    expect(clampSearchPower(undefined)).toBe(1);
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

  it("defaults to Mesita Places and still drops Created, Requested, and Google", () => {
    expect(MAP_FILTER_DEFAULTS.searchPower).toBe(1);
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
    expect(applyMapFilters(deck, filters()).map((p) => p.id)).toEqual([
      "partner",
      "enriched",
    ]);
  });

  it("counts leaving Mesita Places, each Super Category, or How many as one filter", () => {
    expect(mapFilterCount(filters({ searchPower: 2 }))).toBe(1);
    expect(
      mapFilterCount(filters({ searchPower: 1, familyKeys: ["restaurants"] })),
    ).toBe(1);
    expect(mapFilterCount(filters({ resultLimit: 20 }))).toBe(0);
    expect(mapFilterCount(filters({ resultLimit: 40 }))).toBe(1);
    expect(mapFilterCount(filters({ resultLimit: 60 }))).toBe(1);
    // How many is a cap: the sheet opens at the smallest stop.
    expect(MAP_FILTER_DEFAULTS.resultLimit).toBe(20);
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("statuses");
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("categories");
  });

  it("nests Mesita Places ⊂ Google Places — partners ride the Mesita set", () => {
    expect(
      applyMapFilters(deck, filters({ searchPower: 1 })).map((p) => p.id),
    ).toEqual(["partner", "enriched"]);
    expect(
      applyMapFilters(deck, filters({ searchPower: 2 })).map((p) => p.id),
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
        filters({ searchPower: 2, familyKeys: ["cafes_bakeries"] }),
      ).map((p) => p.id),
    ).toEqual(["g-cafe"]);
    expect(
      applyMapFilters(
        [cafe],
        filters({ searchPower: 2, familyKeys: ["restaurants"] }),
      ).map((p) => p.id),
    ).toEqual([]);
  });
});

describe("How many — 20 / 40 / 60", () => {
  it("only those three stops, nothing in between", () => {
    expect(MAP_RESULT_LIMITS).toEqual([20, 40, 60]);
    expect(clampResultLimit(20)).toBe(20);
    expect(clampResultLimit(40)).toBe(40);
    expect(clampResultLimit(60)).toBe(60);
    expect(clampResultLimit(25)).toBe(20);
    expect(clampResultLimit(30)).toBe(40);
    expect(clampResultLimit(50)).toBe(60);
    expect(clampResultLimit(49)).toBe(40);
    expect(clampResultLimit(51)).toBe(60);
    expect(clampResultLimit(99)).toBe(60);
    // Garbage falls back to the default stop, which is the smallest.
    expect(clampResultLimit(undefined)).toBe(20);
  });

  it("keeps the closest N after a distance sort", () => {
    const far = place({ id: "far", distance_km: 12 });
    const mid = place({ id: "mid", distance_km: 4 });
    const near = place({ id: "near", distance_km: 1 });
    expect(
      takeMapResultLimit([far, mid, near], 20).map((p) => p.id),
    ).toEqual(["near", "mid", "far"]);
    const many = Array.from({ length: 45 }, (_, i) =>
      place({ id: `p${i}`, distance_km: 45 - i }),
    );
    const kept = takeMapResultLimit(many, 20);
    expect(kept).toHaveLength(20);
    expect(kept[0]?.id).toBe("p44");
    expect(kept[19]?.id).toBe("p25");
    expect(takeMapResultLimit(many, 40)).toHaveLength(40);
    expect(takeMapResultLimit(many, 60)).toHaveLength(45);
  });
});

describe("PLACE_FAMILIES catalog (final law)", () => {
  it("is eight pills in table order, Other last, text-only labels", () => {
    expect(PLACE_FAMILIES).toHaveLength(8);
    expect(PLACE_FAMILIES.map((f) => f.key)).toEqual([
      "restaurants",
      "cafes_bakeries",
      "bars_nightlife",
      "experiences",
      "culture_arts",
      "sports_fitness",
      "wellness_beauty",
      "undefined",
    ]);
    const last = PLACE_FAMILIES[PLACE_FAMILIES.length - 1]!;
    expect(last.key).toBe("undefined");
    expect(last.label).toBe("Undefined");
    expect(PLACE_FAMILIES.map((f) => f.label)).toContain("Sports & Fitness");
    expect(PLACE_FAMILIES.map((f) => f.label)).toContain("Wellness & Beauty");
  });
});
