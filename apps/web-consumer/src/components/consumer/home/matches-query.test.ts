import { describe, expect, it } from "vitest";
import { matchesQuery } from "./CatalogRails";

// The Places tab's bar filters Home's list by name (MESITA-2402).
describe("matchesQuery", () => {
  const place = { name: "Café Brújula Centro" };
  it("keeps everything on an empty query", () => {
    expect(matchesQuery(place, "  ")).toBe(true);
  });
  it("matches every word, any order, any case", () => {
    expect(matchesQuery(place, "centro café")).toBe(true);
    expect(matchesQuery(place, "BRÚJ")).toBe(true);
  });
  it("drops a place missing one word", () => {
    expect(matchesQuery(place, "café norte")).toBe(false);
  });
});
