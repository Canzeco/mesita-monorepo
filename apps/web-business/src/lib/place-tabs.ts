// A place's views in the Business app (MESITA-3103) — names, labels, hrefs.
// Client-safe: no server imports.

// Preview is a modal on Profile and Billing a section of Settings (MESITA-3136);
// their old addresses redirect.
export const PLACE_TABS = ["profile", "reviews", "premier", "future", "settings", "internal"] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export function placeTabHref(placeId: string, tab: PlaceTab): string {
  return `/places/${encodeURIComponent(placeId)}/${tab}`;
}

/** Which view a place pathname shows, or null. `/places/<id>/<tab>`. */
export function placeTabFromPathname(pathname: string): PlaceTab | null {
  const parts = pathname.split("/");
  if (parts[1] !== "places") return null;
  const seg = parts[3];
  return (PLACE_TABS as readonly string[]).includes(seg ?? "") ? (seg as PlaceTab) : null;
}

/** The place id in a pathname, or null. */
export function placeIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("/");
  return parts[1] === "places" && parts[2] && parts[2] !== "" ? decodeURIComponent(parts[2]) : null;
}
