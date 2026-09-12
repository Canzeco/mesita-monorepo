import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  applyMapFilters,
  clampMinReviews,
  MAP_PLACES_SCOPE_DEFAULT,
  MAP_FILTER_DEFAULTS,
  MAP_MIN_REVIEW_STOPS,
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
    listing_type: "web",
    ...over,
  } as Place;
}

function filters(over: Partial<MapFilters> = {}): MapFilters {
  return { ...MAP_FILTER_DEFAULTS, ...over };
}

describe("placeMapState", () => {
  it("ladders Google → promoted → partnered → enriched → requested → created", () => {
    expect(placeMapState(place({ googleOnly: true }))).toBe("not_on_mesita");
    expect(placeMapState(place({ from_google: true }))).toBe("not_on_mesita");
    expect(placeMapState(place({ promoting: true, partner: true }))).toBe(
      "promoted",
    );
    expect(placeMapState(place({ partner: true }))).toBe("partnered");
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
  it("names the NARROWEST ring a place is in — enrichment gates both Mesita rings", () => {
    expect(
      placeSearchScope(place({ partner: true, content_state: "ready" })),
    ).toBe("partners");
    expect(placeSearchScope(place({ content_state: "ready" }))).toBe("mesita");
    expect(
      placeSearchScope(place({ enriched_at: "2026-08-01T00:00:00Z" })),
    ).toBe("mesita");
    expect(placeSearchScope(place({ partner: true }))).toBeNull();
    expect(
      placeSearchScope(place({ partner: true, content_state: "queued" })),
    ).toBeNull();
    expect(placeSearchScope(place({ promoting: true }))).toBeNull();
    expect(
      placeSearchScope(place({ promoting: true, content_state: "ready" })),
    ).toBe("mesita");
    expect(placeSearchScope(place({ googleOnly: true }))).toBe("google");
    expect(placeSearchScope(place({ from_google: true }))).toBe("google");
    expect(placeSearchScope(place())).toBeNull();
  });
});

describe("places scope", () => {
  it("captions each ring and resolves anything unknown to the MIDDLE one", () => {
    expect(placesScopeCaption("partners")).toBe("Mesita Partner Places only");
    expect(placesScopeCaption("mesita")).toBe(
      "Mesita Enriched Places, partners included",
    );
    expect(placesScopeCaption("google")).toBe(
      "Google Places, Mesita places included",
    );
    expect(MAP_PLACES_SCOPE_DEFAULT).toBe("mesita");
    expect(parsePlacesScope(undefined)).toBe("mesita");
    expect(parsePlacesScope(null)).toBe("mesita");
    expect(parsePlacesScope("PARTNERS")).toBe("partners");
    expect(parsePlacesScope(1)).toBe("mesita");
    expect(parsePlacesScope(2)).toBe("google");
    expect(parsePlacesScope(0)).toBe("mesita");
  });
});

describe("applyMapFilters", () => {
  const partner = place({
    id: "partner",
    partner: true,
    content_state: "ready",
  });
  const enriched = place({ id: "enriched", content_state: "ready" });
  const created = place({ id: "created" });
  const requested = place({
    id: "requested",
    request_count: 2,
    content_state: "queued",
  });
  const google = place({ id: "google", googleOnly: true });
  const deck = [partner, enriched, created, requested, google];

  it("defaults to Mesita Enriched Places and still drops Created, Requested, and Google", () => {
    expect(MAP_FILTER_DEFAULTS.placesScope).toBe("mesita");
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
    expect(applyMapFilters(deck, filters()).map((p) => p.id)).toEqual([
      "partner",
      "enriched",
    ]);
  });

  it("counts leaving the default ring, each Super Category, or Popularity as one filter", () => {
    expect(mapFilterCount(filters({ placesScope: "google" }))).toBe(1);
    expect(mapFilterCount(filters({ placesScope: "partners" }))).toBe(1);
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

  it("nests Google ⊃ Mesita Enriched ⊃ Mesita Partner, and the rings differ", () => {
    expect(
      applyMapFilters(deck, filters({ placesScope: "partners" })).map(
        (p) => p.id,
      ),
    ).toEqual(["partner"]);
    expect(
      applyMapFilters(deck, filters({ placesScope: "mesita" })).map((p) => p.id),
    ).toEqual(["partner", "enriched"]);
    expect(
      applyMapFilters(deck, filters({ placesScope: "google" })).map((p) => p.id),
    ).toEqual(["partner", "enriched", "google"]);
    const rawPartner = place({ id: "raw-partner", partner: true });
    expect(
      applyMapFilters([rawPartner], filters({ placesScope: "partners" })),
    ).toEqual([]);
    expect(
      applyMapFilters([rawPartner], filters({ placesScope: "google" })),
    ).toEqual([]);
  });

  it("cuts on Super Category only — never a concrete type slug", () => {
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
