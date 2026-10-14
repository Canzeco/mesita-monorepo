// The gallery Render may send. Only http(s) links, ten at most. The write
// copies the bytes and stores the durable URLs; these links are not kept.

const CAP = 10;

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
