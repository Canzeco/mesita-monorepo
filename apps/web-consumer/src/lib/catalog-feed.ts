import type { CatalogRail } from "@/lib/api/places";

/**
 * The Places feed is the server's N + 2 rails in server order: Right Now,
 * Universal, then one rail per guest family. An empty rail is dropped.
 */
export function placesFeed(rails: readonly CatalogRail[]): CatalogRail[] {
  return rails.filter((rail) => rail.places.length > 0);
}
