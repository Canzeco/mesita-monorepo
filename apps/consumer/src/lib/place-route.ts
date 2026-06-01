const RESERVED_PLACE_SEGMENTS = new Set([
  "discover",
  "explore",
  "swipe",
  "map",
  "search",
  "add",
  "saved",
  "place",
  "venues",
  "venue",
]);

export function toCanonicalPlaceHrefOrNull(idOrSlug: string): string | null {
  const normalized = idOrSlug.trim().toLowerCase();
  if (!normalized || RESERVED_PLACE_SEGMENTS.has(normalized)) return null;
  return `/place/${idOrSlug}`;
}
