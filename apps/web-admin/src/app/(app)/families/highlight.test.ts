import { describe, expect, it } from "vitest";
import { highlightFamilies, type FamiliesMap } from "./highlight";

const map: FamiliesMap = {
  families: [
    { slug: "restaurants", label: "Restaurants", emoji: "🍽️", sortOrder: 1 },
    { slug: "cafes_bakeries", label: "Cafés & Desserts", emoji: "☕", sortOrder: 2 },
  ],
  categories: [
    { slug: "brunch", label: "Brunch", familyKeys: ["restaurants", "cafes_bakeries"] },
    { slug: "tacos", label: "Tacos", familyKeys: ["restaurants"] },
  ],
  googleTypes: [
    { slug: "restaurant", family: "restaurants" },
    { slug: "cafe", family: "cafes_bakeries" },
    { slug: "accounting", family: "undefined" },
  ],
};

describe("highlightFamilies", () => {
  it("fans a family out to its google types and categories", () => {
    const hit = highlightFamilies(map, { kind: "family", slug: "restaurants" });
    expect([...hit.google]).toEqual(["restaurant"]);
    expect([...hit.categories].sort()).toEqual(["brunch", "tacos"]);
  });

  it("walks a google type to its family and that family's categories", () => {
    const hit = highlightFamilies(map, { kind: "google", slug: "cafe" });
    expect(hit.families.has("cafes_bakeries")).toBe(true);
    expect(hit.categories.has("brunch")).toBe(true);
    expect(hit.categories.has("tacos")).toBe(false);
  });

  it("walks a category to both families and does not store a direct google link", () => {
    const hit = highlightFamilies(map, { kind: "category", slug: "brunch" });
    expect([...hit.families].sort()).toEqual(["cafes_bakeries", "restaurants"]);
    expect(hit.google.has("restaurant")).toBe(true);
    expect(hit.google.has("cafe")).toBe(true);
    expect(hit.google.has("accounting")).toBe(false);
  });

  it("highlights the google types that land on undefined", () => {
    const hit = highlightFamilies(map, { kind: "family", slug: "undefined" });
    expect([...hit.google]).toEqual(["accounting"]);
    expect(hit.categories.size).toBe(0);
  });
});
