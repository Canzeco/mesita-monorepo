import { describe, expect, it } from "vitest";
import type { CatalogRail, Place } from "@/lib/api/places";
import { placesFeed } from "@/lib/catalog-feed";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

function place(id: string): Place {
  return { id, name: id } as Place;
}

function rail(key: string, label: string, ids: string[]): CatalogRail {
  return {
    key,
    label,
    source: "family",
    places: ids.map(place),
  };
}

describe("places feed", () => {
  it("is always All plus one rail per guest family", () => {
    const feed = placesFeed([
      rail("all", "All", ["cafe", "club"]),
      rail("coffee", "Coffee", ["cafe"]),
    ]);
    expect(feed.map((row) => row.key)).toEqual([
      "all",
      ...FILTERABLE_PLACE_FAMILIES.map((family) => family.key),
    ]);
    expect(feed).toHaveLength(FILTERABLE_PLACE_FAMILIES.length + 1);
  });

  it("keeps every place on All and leaves a short family empty", () => {
    const feed = placesFeed([
      rail("all", "All", ["cafe", "club"]),
      rail("coffee", "Coffee", ["cafe"]),
    ]);
    expect(feed[0]?.places.map((row) => row.id)).toEqual(["cafe", "club"]);
    expect(feed.find((row) => row.key === "coffee")?.places.map((row) => row.id)).toEqual([
      "cafe",
    ]);
    expect(feed.find((row) => row.key === "breakfast")?.places).toEqual([]);
    expect(feed.find((row) => row.key === "coffee")?.emoji).toBe("☕");
    expect(feed.find((row) => row.key === "night_out")?.emoji).toBe("🌙");
  });
});
