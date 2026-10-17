import type { CatalogRail, Place } from "@/lib/api/places";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

/**
 * The Places feed is always one universal carousel plus one carousel per
 * guest family. A family the server left out is still a row, with no places.
 */
export function placesFeed(rails: readonly CatalogRail[]): CatalogRail[] {
  const byKey = new Map(rails.map((rail) => [rail.key, rail]));
  const all = byKey.get("all");
  const universal: CatalogRail = {
    key: "all",
    label: "All",
    source: "family",
    places: all?.places ?? [],
  };
  const families: CatalogRail[] = FILTERABLE_PLACE_FAMILIES.map((family) => ({
    key: family.key,
    label: family.label,
    emoji: family.emoji,
    source: "family",
    places: byKey.get(family.key)?.places ?? [],
  }));
  return [universal, ...families];
}

/**
 * The Places screen is one wall. All's places, once each, in server order.
 * A family rail is not a row: a one-place family would leave a blank cell.
 */
export function catalogWall(rails: readonly CatalogRail[]): Place[] {
  const all = rails.find((rail) => rail.key === "all");
  const source = all ? all.places : rails.flatMap((rail) => rail.places);
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const place of source) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
  }
  return places;
}
