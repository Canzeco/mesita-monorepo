// What the link-preview images share (MESITA-4334, MESITA-4341): Google
// fonts as TrueType for next/og, and the PNG → JPEG step that keeps a photo
// card under WhatsApp's ~300 KB.

import sharp from "sharp";

const DAY = 60 * 60 * 24;

// Google serves TTF to a client that names no browser, which is what Satori
// reads (never woff2). Kept for the instance.
const fonts = new Map<string, Promise<ArrayBuffer | null>>();
export function loadGoogleFont(query: string): Promise<ArrayBuffer | null> {
  let font = fonts.get(query);
  if (!font) {
    font = (async (): Promise<ArrayBuffer | null> => {
      try {
        const css = await fetch(`https://fonts.googleapis.com/css2?${query}&display=swap`).then((r) => r.text());
        const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
        if (!src) return null;
        return await fetch(src).then((r) => r.arrayBuffer());
      } catch {
        return null;
      }
    })();
    fonts.set(query, font);
  }
  return font;
}

/** next/og's PNG as a cached JPEG response; null if the encode failed. */
export async function jpegResponse(png: Response): Promise<Response | null> {
  try {
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": `public, max-age=${DAY}, s-maxage=${DAY}, stale-while-revalidate=${7 * DAY}`,
      },
    });
  } catch {
    return null;
  }
}
