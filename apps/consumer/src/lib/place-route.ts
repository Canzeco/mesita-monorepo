import { placePath, type PlaceSurface } from "@/lib/consumer-route-contract";

const RESERVED_PLACE_SEGMENTS = new Set([
  "discover",
  "explore",
  "swipe",
  "map",
  "search",
  "add",
  "saved",
  "place",
  "places",
  "place",
]);

export function toCanonicalPlaceHrefOrNull(
  idOrSlug: string,
  surface: PlaceSurface = "explore",
): string | null {
  const normalized = idOrSlug.trim().toLowerCase();
  if (!normalized || RESERVED_PLACE_SEGMENTS.has(normalized)) return null;
  return placeHref(idOrSlug, surface);
}

export function placeHref(
  idOrSlug: string,
  surface: PlaceSurface = "explore",
): string {
  return placePath(idOrSlug, surface);
}
