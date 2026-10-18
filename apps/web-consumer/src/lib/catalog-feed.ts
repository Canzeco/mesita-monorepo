import type { CatalogRail } from "@/lib/api/places";

/**
 * The Places feed is the server's rails in server order: Google Places,
 * Mesita Selected, then one rail per guest family (Selected only). An empty
 * rail is dropped.
 */
export function placesFeed(rails: readonly CatalogRail[]): CatalogRail[] {
  return rails.filter((rail) => rail.places.length > 0);
}
