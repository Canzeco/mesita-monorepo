import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  applyMapFilters,
  clampMinReviews,
  MAP_PLACES_SCOPE_DEFAULT,
  MAP_FILTER_DEFAULTS,
  MAP_MIN_REVIEW_STOPS,
  MAP_SEARCH_STOPS,
  mapFilterCount,
  mapFiltersAreActive,
  placeMapState,
  parsePlacesScope,
  placeSearchScope,
  placesScopeCaption,
  type MapFilters,
} from "@/lib/map-filters-engine";

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    ...over,
  } as Place;
}

function filters(over: Partial<MapFilters> = {}): MapFilters {
  return { ...MAP_FILTER_DEFAULTS, ...over };
}

describe("placeMapState", () => {
  it("ladders Google → enriched → requested → created", () => {
    expect(placeMapState(place({ googleOnly: true }))).toBe("not_on_mesita");
    expect(placeMapState(place({ from_google: true }))).toBe("not_on_mesita");
    expect(placeMapState(place({ content_state: "ready" }))).toBe("enriched");
    expect(placeMapState(place({ enriched_at: "2026-08-01T00:00:00Z" }))).toBe(
      "enriched",
    );
    expect(
      placeMapState(place({ request_count: 2, content_state: "queued" })),
    ).toBe("requested");
    expect(
      placeMapState(place({ request_count: 4, content_state: "ready" })),
    ).toBe("enriched");
    expect(placeMapState(place())).toBe("created");
  });
});

describe("placeSearchScope", () => {
  it("names the ring a place is in — enrichment gates the Mesita ring", () => {
    expect(placeSearchScope(place({ content_state: "ready" }))).toBe("mesita");
    expect(
      placeSearchScope(place({ enriched_at: "2026-08-01T00:00:00Z" })),
    ).toBe("mesita");
    expect(placeSearchScope(place({ content_state: "queued" }))).toBeNull();
    expect(placeSearchScope(place({ googleOnly: true }))).toBe("google");
    expect(placeSearchScope(place({ from_google: true }))).toBe("google");
    expect(placeSearchScope(place())).toBeNull();
  });
});

describe("places scope", () => {
  it("is two stops, Mesita first, and the sheet reads them in that order", () => {
    expect(MAP_SEARCH_STOPS.map((s) => s.key)).toEqual(["mesita", "google"]);
  });

  it("captions each ring and resolves anything unknown to the INNER one", () => {
    expect(placesScopeCaption("mesita")).toBe("Mesita Enriched Places only");
    expect(placesScopeCaption("google")).toBe(
      "Google Places, Mesita places included",
    );
    expect(MAP_PLACES_SCOPE_DEFAULT).toBe("mesita");
    expect(parsePlacesScope(undefined)).toBe("mesita");
    expect(parsePlacesScope(null)).toBe("mesita");
    expect(parsePlacesScope("GOOGLE")).toBe("google");
    // The retired paid ring, still in a persisted v6 blob, lands on the
    // default — never on the wider set.
    expect(parsePlacesScope("partners")).toBe("mesita");
    expect(parsePlacesScope(1)).toBe("mesita");
    expect(parsePlacesScope(2)).toBe("google");
    expect(parsePlacesScope(0)).toBe("mesita");
  });
});

describe("applyMapFilters", () => {
  const enriched = place({ id: "enriched", content_state: "ready" });
  const stamped = place({
    id: "stamped",
    enriched_at: "2026-08-01T00:00:00Z",
  });
  const created = place({ id: "created" });
  const requested = place({
    id: "requested",
    request_count: 2,
    content_state: "queued",
  });
  const google = place({ id: "google", googleOnly: true });
  const deck = [enriched, stamped, created, requested, google];

  it("defaults to Mesita Enriched Places and still drops Created, Requested, and Google", () => {
    expect(MAP_FILTER_DEFAULTS.placesScope).toBe("mesita");
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
    expect(applyMapFilters(deck, filters()).map((p) => p.id)).toEqual([
      "enriched",
      "stamped",
    ]);
  });

  it("counts leaving the default ring, each Family, or Popularity as one filter", () => {
    expect(mapFilterCount(filters({ placesScope: "google" }))).toBe(1);
    expect(
      mapFilterCount(
        filters({ placesScope: "mesita", familyKeys: ["restaurants"] }),
      ),
    ).toBe(1);
    expect(mapFilterCount(filters({ minReviews: 0 }))).toBe(0);
    expect(mapFilterCount(filters({ minReviews: 10 }))).toBe(1);
    expect(mapFilterCount(filters({ minReviews: 10000 }))).toBe(1);
    expect(MAP_FILTER_DEFAULTS.minReviews).toBe(0);
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("resultLimit");
  });

  it("nests Google ⊃ Mesita Enriched, and the rings differ", () => {
    expect(
      applyMapFilters(deck, filters({ placesScope: "mesita" })).map((p) => p.id),
    ).toEqual(["enriched", "stamped"]);
    expect(
      applyMapFilters(deck, filters({ placesScope: "google" })).map((p) => p.id),
    ).toEqual(["enriched", "stamped", "google"]);
    // A thin Mesita stub is in NEITHER ring — not even the widest one.
    expect(
      applyMapFilters([created], filters({ placesScope: "google" })),
    ).toEqual([]);
  });

  it("cuts on Family only — never a concrete type slug", () => {
    const bar = place({
      id: "bar",
      category: "night_club",
      family_keys: ["bars_nightlife"],
      content_state: "ready",
    });
    const taco = place({
      id: "taco",
      category: "mexican_restaurant",
      family_keys: ["restaurants"],
      content_state: "ready",
    });
    expect(
      applyMapFilters(
        [bar, taco],
        filters({ familyKeys: ["restaurants"] }),
      ).map((p) => p.id),
    ).toEqual(["taco"]);
  });

  it("Google stubs match Family from family_keys", () => {
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
        filters({ placesScope: "google", familyKeys: ["cafes_bakeries"] }),
      ).map((p) => p.id),
    ).toEqual(["g-cafe"]);
  });
});

describe("Popularity — 0 / 10 / 100 / 1000 / 10000", () => {
  it("only those five stops, nothing in between", () => {
    expect(MAP_MIN_REVIEW_STOPS).toEqual([0, 10, 100, 1000, 10000]);
    expect(clampMinReviews(0)).toBe(0);
    expect(clampMinReviews(10)).toBe(10);
    expect(clampMinReviews(100)).toBe(100);
    expect(clampMinReviews(1000)).toBe(1000);
    expect(clampMinReviews(10000)).toBe(10000);
    expect(clampMinReviews(5)).toBe(10);
    expect(clampMinReviews(50)).toBe(10);
    expect(clampMinReviews(55)).toBe(100);
    expect(clampMinReviews(500)).toBe(100);
    expect(clampMinReviews(550)).toBe(1000);
    expect(clampMinReviews(undefined)).toBe(0);
    expect(clampMinReviews(-4)).toBe(0);
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
  });
});
