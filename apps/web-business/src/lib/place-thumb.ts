// Thumbnail URLs for console place rows.
//
// A place photo is a FULL-RESOLUTION ORIGINAL in the `place-images` bucket,
// whose per-object ceiling is 8MB. Both console lists render up to
// business-web-list-places' MAX_LIMIT = 100 rows, so a row must never point
// an <img> at the original: one scroll of Public Places would pull ~100
// multi-MB objects, and `loading="lazy"` defers that fetch without bounding
// it (MESITA-1553).
//
// Supabase image transforms ARE enabled on this project — that was the
// unverified assumption which deferred the thumb in the first place.
// Measured against the live singleton on 2026-09-06:
//
//   /object/public/place-images/images/…577b.jpg              274,524 bytes
//   /render/image/public/…?width=96&height=96&resize=cover      3,106 bytes
//
// 88x smaller, so 100 rows cost ~300KB instead of ~27MB. The transform
// endpoint is the same public path with /object/ swapped for /render/image/.
//
// A URL that is not a Supabase storage object is returned UNCHANGED. Photos
// also arrive from the Google Places CDN and from Firecrawl-scraped sites;
// there is nothing to rewrite on those hosts, and inventing a transform path
// for one would 404 into a broken image.

const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/**
 * A square thumbnail URL for `photoUrl`, or null when there is no photo.
 *
 * `size` is the rendered box in CSS pixels; the request asks for 2x so the
 * thumb stays sharp on a retina panel and still costs single-digit KB.
 */
export function placeThumbUrl(
  photoUrl: string | null | undefined,
  size = 48,
): string | null {
  if (typeof photoUrl !== "string") return null;
  const url = photoUrl.trim();
  if (url === "") return null;
  if (!url.includes(OBJECT_SEGMENT)) return url;

  const px = Math.max(1, Math.round(size * 2));
  const transformed = url.replace(OBJECT_SEGMENT, RENDER_SEGMENT);
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${px}&height=${px}&resize=cover&quality=70`;
}
