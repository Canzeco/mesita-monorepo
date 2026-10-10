import { describe, expect, it } from "vitest";
import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";
import {
  autocompleteToLite,
  classifyLookup,
  filterCatalog,
  googleOnMesita,
  MAX_NAME_MATCHES,
  matchesPlace,
  nearbyAnchor,
} from "./single-place-lookup";

const GID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

function hit(over: Partial<PlaceHit>): PlaceHit {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Café Nin",
    google_name: "Cafe Nin",
    address: "Calle Havre 73, Juárez",
    slug: "cafe-nin",
    ...over,
  } as PlaceHit;
}

describe("classifyLookup", () => {
  it("reads one Place ID token as a Google Place ID", () => {
    expect(classifyLookup(`  ${GID} `)).toEqual({ kind: "google_place_id", id: GID });
  });
  it("reads words, or a token beside words, as a name", () => {
    expect(classifyLookup("Café Nin")).toEqual({ kind: "name", query: "Café Nin" });
    expect(classifyLookup(`Café ${GID}`)).toEqual({ kind: "name", query: `Café ${GID}` });
  });
  it("never reads a Mesita uuid as a Google Place ID", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    expect(classifyLookup(uuid)).toEqual({ kind: "name", query: uuid });
  });
  it("is empty on blank", () => {
    expect(classifyLookup("   ")).toEqual({ kind: "empty" });
  });
});

describe("matchesPlace", () => {
  it("ignores case and accents across name, google name, address and slug", () => {
    const h = hit({});
    expect(matchesPlace(h, "cafe")).toBe(true);
    expect(matchesPlace(h, "JUAREZ")).toBe(true);
    expect(matchesPlace(h, "cafe-nin")).toBe(true);
    expect(matchesPlace(h, "taquería")).toBe(false);
  });
  it("matches nothing on a blank query", () => {
    expect(matchesPlace(hit({}), "  ")).toBe(false);
  });
});

describe("filterCatalog", () => {
  it(`caps at ${MAX_NAME_MATCHES}`, () => {
    const many = Array.from({ length: MAX_NAME_MATCHES + 5 }, (_, i) =>
      hit({ id: `id-${i}`, name: `Café ${i}` }),
    );
    expect(filterCatalog(many, "café")).toHaveLength(MAX_NAME_MATCHES);
  });
});

describe("googleOnMesita", () => {
  const place = {
    id: GID,
    displayName: "Cafe Nin",
    formattedAddress: "Calle Havre 73",
    lat: null,
    lng: null,
    rating: null,
    userRatingCount: null,
    existsInMesita: false,
    createdAt: null,
    updatedAt: null,
  };
  const none = new Set<string>();
  it("is false only when no witness holds it", () => {
    expect(googleOnMesita(place, none, none)).toBe(false);
  });
  it("takes any one witness: the EF join, the catalog, or this page's Adds", () => {
    expect(googleOnMesita({ ...place, existsInMesita: true }, none, none)).toBe(true);
    expect(googleOnMesita(place, new Set([GID]), none)).toBe(true);
    expect(googleOnMesita(place, none, new Set([GID]))).toBe(true);
  });
});

describe("autocompleteToLite", () => {
  const row = {
    placeId: GID,
    mainText: "Dos Amores Brunch & Meal",
    secondaryText: "Parque Central, San Luis Potosí",
    state: "not_in_mesita" as const,
  };
  it("draws an Autocomplete row with no rating, keyed by its Google Place ID", () => {
    expect(autocompleteToLite(row)).toMatchObject({
      id: GID,
      displayName: "Dos Amores Brunch & Meal",
      formattedAddress: "Parque Central, San Luis Potosí",
      rating: null,
      userRatingCount: null,
      existsInMesita: false,
    });
  });
  it("reads On Mesita off the EF's resolve: a state or a Mesita id", () => {
    expect(autocompleteToLite({ ...row, state: "web_listed" }).existsInMesita).toBe(true);
    expect(autocompleteToLite({ ...row, mesitaId: "0f3a" }).existsInMesita).toBe(true);
  });
});

describe("nearbyAnchor", () => {
  const at = (id: string, lat: number | null, lng: number | null) => ({
    id,
    displayName: id,
    formattedAddress: "",
    lat,
    lng,
    rating: null,
    userRatingCount: null,
    existsInMesita: false,
    createdAt: null,
    updatedAt: null,
  });
  it("searches around the first Text Search hit that has a point", () => {
    const a = nearbyAnchor([at("no-point", null, null), at("first", 22.15, -100.98), at("second", 1, 2)]);
    expect(a).toMatchObject({ lat: 22.15, lng: -100.98 });
    expect(a?.place.id).toBe("first");
  });
  it("is null when no hit has a point — no Nearby", () => {
    expect(nearbyAnchor([])).toBeNull();
    expect(nearbyAnchor([at("x", null, 3), at("y", Number.NaN, 1)])).toBeNull();
  });
});
