// The Mesita gallery Render may send. Only http(s) links, ten at most. The
// write copies the bytes into place-images and stores durable URLs on
// mesita_photos; legacy `photos` on the patch is accepted only in flight.

const CAP = 10;

export function mesitaGalleryFromPatch(patch: Record<string, unknown>): string[] {
  return galleryUrls(patch.mesita_photos ?? patch.photos);
}

/** Drop unified and split photo catalogs so the commit does not rewrite them. */
export function patchWithoutPhotoCatalogs(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const { photos: _legacy, mesita_photos: _mesita, ...rest } = patch;
  return rest;
}

export function galleryUrls(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  const out: string[] = [];
  for (const item of photos) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!url.startsWith("https://") && !url.startsWith("http://")) continue;
    if (out.includes(url)) continue;
    out.push(url);
    if (out.length === CAP) break;
  }
  return out;
}
