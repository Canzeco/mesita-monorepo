import type { CatalogRail } from "@/lib/api/places";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

/**
 * The Places feed is always one universal rail plus one rail per
 * guest family. A family the server left out is still a rail, with no places.
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
