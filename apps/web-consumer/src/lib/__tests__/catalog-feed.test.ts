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

// The Feed is Google Places · Mesita Selected · one rail per family
// (MESITA-2302); the client keeps the server's order and invents nothing.
describe("places feed", () => {
  it("keeps the server's rails in server order", () => {
    const feed = placesFeed([
      rail("google", "Google Places", ["stub"], "signal"),
      rail("selected", "Mesita Selected", ["cafe", "club"], "signal"),
      rail("coffee", "Coffee", ["cafe"]),
    ]);
    expect(feed.map((row) => row.key)).toEqual([
      "google",
      "selected",
      "coffee",
    ]);
    expect(feed[1]?.places.map((row) => row.id)).toEqual(["cafe", "club"]);
  });

  it("invents no All rail and drops empty rails", () => {
    const feed = placesFeed([
      rail("selected", "Mesita Selected", ["cafe"], "signal"),
      rail("breakfast", "Breakfast", []),
      rail("coffee", "Coffee", ["cafe"]),
    ]);
    expect(feed.map((row) => row.key)).toEqual(["selected", "coffee"]);
    expect(placesFeed([])).toEqual([]);
  });
});
