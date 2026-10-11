import type { CatalogRail } from "@/lib/api/places";

// Catalog's header line and its one sort (MESITA-2135), ported from the
// deleted mobile app's CatalogTab: "N places · X open now", then Suggested
// (the server's order) or Open first.
//
// A PLACE IS COUNTED ONCE. The same place can sit on several rails (a
// category rail and a vibe rail), so summing rail lengths over-counts; the
// header counts distinct ids.

export type CatalogSort = "suggested" | "open";

export function summarizeCatalog(rails: readonly CatalogRail[]): {
  total: number;
  openNow: number;
} {
  const byId = new Map<string, boolean>();
  for (const rail of rails) {
    for (const place of rail.places) {
      byId.set(place.id, byId.get(place.id) === true || place.open_now === true);
    }
  }
  let openNow = 0;
  for (const open of byId.values()) if (open) openNow += 1;
  return { total: byId.size, openNow };
}

/**
 * Suggested keeps the server's order untouched. Open first lifts the open
 * places inside each rail and keeps every group in server order (the sort is
 * stable), so a rail never trades its ranking for anything but open-ness.
 */
export function sortCatalogRails(
  rails: readonly CatalogRail[],
  sort: CatalogSort,
): CatalogRail[] {
  if (sort === "suggested") return [...rails];
  return rails.map((rail) => ({
    ...rail,
    places: [...rail.places].sort(
      (a, b) => Number(b.open_now === true) - Number(a.open_now === true),
    ),
  }));
}
