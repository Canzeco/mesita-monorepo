// The picker's filter, and the one number that turns it on (MESITA-1803).
import { describe, expect, it } from "vitest";
import { PLACE_SEARCH_MIN, filterPlaces, placeSearchApplies } from "./place-search";

const rows = [
  { id: "1", name: "Bar Alameda" },
  { id: "2", name: "Café Cañón" },
  { id: "3", name: "Cafetería del Sol" },
  { id: "4", name: "Zócalo" },
];

describe("the threshold is one number", () => {
  it("is 8, and the issue's boundary is exactly 7 vs 8", () => {
    // The digit is asserted HERE and nowhere else. shell-chrome.test.ts
    // proves the rail reads the constant instead of retyping it.
    expect(PLACE_SEARCH_MIN).toBe(8);
    expect(placeSearchApplies(8)).toBe(true);
    expect(placeSearchApplies(9)).toBe(true);
  });

  it("AT SEVEN PLACES THERE IS NO FIELD", () => {
    // The inert half of the feature, stated as its own case because it is the
    // half nobody notices breaking: below the threshold the picker must be
    // the menu it was before this issue existed.
    expect(placeSearchApplies(7)).toBe(false);
    expect(placeSearchApplies(2)).toBe(false);
    expect(placeSearchApplies(0)).toBe(false);
  });
});

describe("the filter runs over the rows already in hand", () => {
  it("an empty query is not a filter", () => {
    expect(filterPlaces(rows, "")).toBe(rows);
    expect(filterPlaces(rows, "   ")).toBe(rows);
  });

  it("ignores case", () => {
    expect(filterPlaces(rows, "BAR").map((p) => p.id)).toEqual(["1"]);
  });

  it("ignores accents, because the names are Spanish", () => {
    // "cafe" must find "Café", and "canon" must find "Cañón", or the field is
    // broken for exactly the operator it was built for.
    expect(filterPlaces(rows, "cafe").map((p) => p.id)).toEqual(["2", "3"]);
    expect(filterPlaces(rows, "canon").map((p) => p.id)).toEqual(["2"]);
    expect(filterPlaces(rows, "zocalo").map((p) => p.id)).toEqual(["4"]);
  });

  it("matches anywhere in the name, not just the head", () => {
    expect(filterPlaces(rows, "sol").map((p) => p.id)).toEqual(["3"]);
  });

  it("keeps the order it was given — the EF already sorted by name", () => {
    expect(filterPlaces(rows, "a").map((p) => p.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("answers an empty list, not the whole list, when nothing matches", () => {
    expect(filterPlaces(rows, "taquería")).toEqual([]);
  });
});
