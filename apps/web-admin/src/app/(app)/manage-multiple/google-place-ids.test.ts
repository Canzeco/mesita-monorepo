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
      query: "mezcalerías en Oaxaca",
    });
  });

  it("accepts Place IDs without a query", () => {
    expect(splitSearchBarInput("ChIJ1234567890abcdef ChIJzzzzzzzzzzzzzzzz")).toEqual({
      placeIds: ["ChIJ1234567890abcdef", "ChIJzzzzzzzzzzzzzzzz"],
      query: null,
    });
  });

  it("keeps leftover words when mixed with IDs", () => {
    expect(
      splitSearchBarInput("coffee ChIJ1234567890abcdef CDMX"),
    ).toEqual({
      placeIds: ["ChIJ1234567890abcdef"],
      query: "coffee CDMX",
    });
  });
});
