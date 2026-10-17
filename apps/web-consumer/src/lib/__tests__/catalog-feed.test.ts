import { describe, expect, it } from "vitest";
import type { CatalogRail, Place } from "@/lib/api/places";
import { placesFeed } from "@/lib/catalog-feed";

function place(id: string): Place {
  return { id, name: id } as Place;
}

function rail(
  key: string,
  label: string,
  ids: string[],
  source: CatalogRail["source"] = "family",
): CatalogRail {
  return {
    key,
    label,
    source,
    places: ids.map(place),
  };
}

describe("places feed", () => {
  it("keeps the server's rails in server order", () => {
    const feed = placesFeed([
      rail("right_now", "Right Now", ["club"], "signal"),
      rail("universal", "Universal", ["cafe", "club"], "signal"),
      rail("coffee", "Coffee", ["cafe"]),
    ]);
    expect(feed.map((row) => row.key)).toEqual([
      "right_now",
      "universal",
      "coffee",
    ]);
    expect(feed[1]?.places.map((row) => row.id)).toEqual(["cafe", "club"]);
  });

  it("invents no All rail and drops empty rails", () => {
    const feed = placesFeed([
      rail("universal", "Universal", ["cafe"], "signal"),
      rail("breakfast", "Breakfast", []),
      rail("coffee", "Coffee", ["cafe"]),
    ]);
    expect(feed.map((row) => row.key)).toEqual(["universal", "coffee"]);
    expect(placesFeed([])).toEqual([]);
  });
});
