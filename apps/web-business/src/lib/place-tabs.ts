// A place's views in the Business app (MESITA-3103) — names, labels, hrefs.
// Client-safe: no server imports.

export const PLACE_TABS = ["profile", "reviews", "preview", "premier", "settings", "internal"] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

export const PLACE_TAB_LABEL: Record<PlaceTab, string> = {
  profile: "Profile",
  reviews: "Reviews",
  preview: "Preview",
  premier: "Premier",
  settings: "Settings",
  internal: "Internal",
};

/** Mesita staff only: Reviews (Sync calls paid scrapers) and Internal
 *  (state, Enrich, embedding, reports, owners). The server refuses their data
 *  to anyone else; this list only decides what is drawn. */
export const STAFF_TABS: readonly PlaceTab[] = ["reviews", "internal"];

export function tabsFor(role: "owner" | "superadmin"): PlaceTab[] {
  return role === "superadmin" ? [...PLACE_TABS] : PLACE_TABS.filter((t) => !STAFF_TABS.includes(t));
}

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
