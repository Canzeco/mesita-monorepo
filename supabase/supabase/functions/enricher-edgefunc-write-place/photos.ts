// The gallery Render may send. Only http(s) links, ten at most. The write
// copies the bytes into place-images and stores durable URLs on `photos`, the
// one gallery (MESITA-2794): Enrich overwrites it. `mesita_photos` on the
// patch is accepted only in flight, from a Render build older than the merge.

const CAP = 10;

export function galleryFromPatch(patch: Record<string, unknown>): string[] {
  return galleryUrls(patch.photos ?? patch.mesita_photos);
}

/** Drop every gallery key so the commit writes `photos` only on purpose. */
export function patchWithoutGallery(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const { photos: _photos, mesita_photos: _mesita, google_photos: _google, ...rest } = patch;
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
