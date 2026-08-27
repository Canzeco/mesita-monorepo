import { describe, expect, it } from "vitest";
import {
  parseGooglePlaceIds,
  splitSearchBarInput,
} from "./google-place-ids";

describe("parseGooglePlaceIds", () => {
  it("dedupes and pulls IDs out of CSV/whitespace", () => {
    expect(
      parseGooglePlaceIds("ChIJ1234567890abcdef, ChIJ1234567890abcdef\nChIJzzzzzzzzzzzzzzzz"),
    ).toEqual(["ChIJ1234567890abcdef", "ChIJzzzzzzzzzzzzzzzz"]);
  });

  it("ignores short tokens and Mesita UUIDs", () => {
    expect(
      parseGooglePlaceIds("abc 11111111-1111-4111-8111-111111111111"),
    ).toEqual([]);
  });
});

describe("splitSearchBarInput", () => {
  it("treats a free-text line as one query", () => {
    expect(splitSearchBarInput("mezcalerías en Oaxaca")).toEqual({
      placeIds: [],
      queries: ["mezcalerías en Oaxaca"],
    });
  });

  it("accepts Place IDs without a query", () => {
    expect(splitSearchBarInput("ChIJ1234567890abcdef ChIJzzzzzzzzzzzzzzzz")).toEqual({
      placeIds: ["ChIJ1234567890abcdef", "ChIJzzzzzzzzzzzzzzzz"],
      queries: [],
    });
  });

  it("keeps leftover words when mixed with IDs", () => {
    expect(
      splitSearchBarInput("coffee ChIJ1234567890abcdef CDMX"),
    ).toEqual({
      placeIds: ["ChIJ1234567890abcdef"],
      queries: ["coffee CDMX"],
    });
  });

  it("treats each non-empty line as its own query", () => {
    expect(
      splitSearchBarInput(
        "best night clubs in san pedro\nmezcalerías en Oaxaca\n\nCoffee shops in Mexico City",
      ),
    ).toEqual({
      placeIds: [],
      queries: [
        "best night clubs in san pedro",
        "mezcalerías en Oaxaca",
        "Coffee shops in Mexico City",
      ],
    });
  });

  it("dedupes repeated query lines and Place IDs", () => {
    expect(
      splitSearchBarInput("tacos\ntacos\nChIJ1234567890abcdef\nChIJ1234567890abcdef"),
    ).toEqual({
      placeIds: ["ChIJ1234567890abcdef"],
      queries: ["tacos"],
    });
  });
});
