/** Google's primary type on the place row — slug plus the readable label sync writes. */

function readableSlug(slug: string): string {
  return slug.replaceAll("_", " ");
}

export function googleCategoryDisplay(
  slug: string | null | undefined,
  label: string | null | undefined,
): string {
  const s = (slug ?? "").trim();
  const lab = (label ?? "").trim();
  if (s && s !== "undefined") {
    return lab || readableSlug(s);
  }
  return "—";
}
