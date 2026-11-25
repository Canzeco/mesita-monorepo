export type Point = { lat: number; lng: number };
export type ActiveLocation = Point & { name: string };

export type CatalogPlace = { id: string; name: string; category: string | null; photo: string | null; isAd: boolean };

export const PAGE = 24;

/** The ranked ids of one page after the first. */
export function pageIds(order: readonly string[], firstPage: number, page: number): string[] {
  const from = firstPage + (page - 1) * PAGE;
  return order.slice(from, from + PAGE);
}

/** Each place once, whatever the pages repeat. */
export function uniquePlaces(pages: readonly (readonly CatalogPlace[])[]): CatalogPlace[] {
  return [...new Map(pages.flat().map((p) => [p.id, p])).values()];
}

export function readActiveLocation(raw: string | null): ActiveLocation | null {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<ActiveLocation> | null;
    if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") return null;
    return { lat: v.lat, lng: v.lng, name: typeof v.name === "string" ? v.name : "Your location" };
  } catch {
    return null;
  }
}
